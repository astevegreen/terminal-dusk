// The sprint's cue: `/sprint-start [hours]` opens the window when it runs, instead of on dates fixed at planning,
// and `/sprint-stop` closes it. The window and the scheduled tasks' ids live on this computer (local-state.mjs);
// this answers where now falls against the window, records the triggers the supervisor creates, and names
// night-shift work still in flight, so the night shift and the sprint's lanes never build at once.
import { inWindow } from "./sprint-doc.mjs";
import { readTriggers, readWindow, recordTrigger, writeWindow } from "./local-state.mjs";
import { wakePlan } from "./wake.mjs";

export const DEFAULT_HOURS = 38;
export const MAX_HOURS = 96;
const TITLE = /^TD (lane|plan): ([a-z]+)$/;
const TRIGGER_ID = /^trig_\w+$/;
const ENVIRONMENT_ID = /^env_\w+$/;
const IDS = ["supervisor", "archiver", "wake"];

const iso = (d) => new Date(d).toISOString().replace(/:\d{2}\.\d{3}Z$/, "Z");

// "Wed 28 Oct 20:00", the owner's clock.
export function eastern(d) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("hour")}:${get("minute")}`;
}

// The window from now, to the minute, for `hours` hours.
export function newWindow(now, hours = DEFAULT_HOURS) {
  const h = Number(hours);
  if (!Number.isInteger(h) || h < 1 || h > MAX_HOURS)
    throw new Error(`the window is a whole number of hours from 1 to ${MAX_HOURS}, not "${hours}"`);
  const start = new Date(Math.floor(now.getTime() / 60000) * 60000);
  return { start: start.toISOString(), end: new Date(start.getTime() + h * 3600000).toISOString() };
}

// docs/sprint.md's facts with this computer's window, when /sprint-start opened one, in place of its Window line.
export function withLocalWindow(doc, dir) {
  const w = readWindow(dir);
  if (!w) return { ...doc, supervisor: null, archiver: null, wake: null, stoppedBy: null };
  return {
    ...doc,
    window: { start: new Date(w.start), end: new Date(w.end) },
    environment: w.environment ?? doc.environment,
    supervisor: w.supervisor ?? null,
    archiver: w.archiver ?? null,
    wake: w.wake ?? null,
    stoppedBy: w.stoppedBy ?? null,
  };
}

// Where now falls: "none" (no window yet), "before", "open" or "after"; with the lanes, the sprint log issue,
// the scheduled tasks' ids, and "sprint-stop" in stoppedBy when /sprint-stop ended the window early.
export function windowState(doc, now) {
  const w = doc.window;
  let state = "none";
  if (w?.start && w?.end) {
    if (inWindow(doc, now)) state = "open";
    else state = now < w.start ? "before" : "after";
  }
  return {
    state,
    ...(w?.start && { start: iso(w.start), end: iso(w.end), eastern: `${eastern(w.start)} to ${eastern(w.end)}` }),
    lanes: doc.lanes,
    log: doc.logIssue,
    supervisor: doc.supervisor ?? null,
    archiver: doc.archiver ?? null,
    wake: doc.wake ?? null,
    stoppedBy: doc.stoppedBy ?? null,
  };
}

// The night shift's tasks in flight: `in-progress` issues outside every lane. It finishes the one it holds and
// then stands down, since `next night` gives it nothing inside the window.
export function nightShiftWork(S) {
  const building = S.issues
    .filter(
      (i) => i.state === "OPEN" && i.labels.includes("in-progress") && !i.labels.some((l) => l.startsWith("lane:")),
    )
    .map((i) => ({ number: i.number, title: i.title }));
  const numbers = building.map((i) => `#${i.number}`).join(", ");
  return {
    active: building.length > 0,
    building,
    reason: building.length
      ? `the night shift is building ${numbers}; it stops after that task`
      : "no night-shift task in progress",
  };
}

// The trigger the supervisor created last for each session title since the window opened (null: none yet);
// with `all`, every one since the window opened, newest first, for the archiver.
export function sessions(doc, dir, { all = false } = {}) {
  const since = doc.window?.start?.getTime() ?? Infinity;
  const recent = readTriggers(dir)
    .filter((t) => new Date(t.at).getTime() >= since)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  if (all) return recent;
  const titles = doc.lanes.flatMap((l) => [`TD lane: ${l}`, `TD plan: ${l}`]);
  return Object.fromEntries(titles.map((title) => [title, recent.find((t) => t.title === title)?.id ?? null]));
}

const refuse = (error, todo) => ({ code: 1, value: { error, do: todo } });

// The cue's commands: { value, code } for `window …`, `started`, `sessions` and `wake`; undefined for any other.
// `window archived` is the archiver's last step: once it is off, the next `window start` may go ahead.
export function cueCommand(argv, { doc, dir, now, option }) {
  const [cmd, sub, arg] = argv;
  const needDir = () => {
    if (!dir) throw new Error("no local state folder: --doc and --fixture answer from the document alone");
  };
  if (cmd === "window" && (!sub || sub.startsWith("--"))) return { value: windowState(doc, now) };
  if (cmd === "window" && sub === "start") {
    needDir();
    const hours = arg && !arg.startsWith("--") ? arg : DEFAULT_HOURS;
    const environment = option(argv, "--environment") ?? null;
    if (environment !== null && !ENVIRONMENT_ID.test(environment))
      throw new Error(`--environment "${environment}" is not an environment id`);
    const w = newWindow(now, hours);
    if (inWindow(doc, now))
      return refuse(`a window is already open, until ${iso(doc.window.end)}`, "Report it; /sprint-stop ends it.");
    // The last window's archiver clears its id when it switches itself off; until then its sessions may still run.
    const last = readWindow(dir);
    if (last?.archiver)
      return refuse(
        `the last window's archiver ${last.archiver} is still on record, so its sessions may still be running`,
        "RemoteTrigger get it. Disabled: run `window archived`, then start again. Enabled: report it; it switches itself off once none of them runs.",
      );
    // The wake is one standing trigger: the supervisor moves it, so it carries over to the next window.
    const next = { ...w, environment, supervisor: null, archiver: null, wake: last?.wake ?? null, stoppedBy: null };
    if (!argv.includes("--dry-run")) writeWindow(dir, next);
    return { value: windowState({ ...doc, ...next, window: { start: new Date(w.start), end: new Date(w.end) } }, now) };
  }
  if (cmd === "window" && sub === "ids") {
    needDir();
    const w = readWindow(dir);
    if (!w || !inWindow(doc, now)) return refuse("no window is open", "Run `window start` first.");
    for (const name of IDS) {
      const id = option(argv, `--${name}`);
      if (id === undefined) continue;
      if (!TRIGGER_ID.test(id)) throw new Error(`--${name} "${id}" is not a trigger id`);
      w[name] = id;
    }
    writeWindow(dir, w);
    return { value: windowState(withLocalWindow(doc, dir), now) };
  }
  if (cmd === "window" && sub === "stop") {
    needDir();
    const w = readWindow(dir);
    if (!w || !inWindow(doc, now)) return refuse("no window is open", "Nothing to stop; report it.");
    const end = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
    writeWindow(dir, { ...w, end, stoppedBy: "sprint-stop" });
    return { value: windowState(withLocalWindow(doc, dir), now) };
  }
  if (cmd === "window" && sub === "archived") {
    needDir();
    const w = readWindow(dir);
    if (w && inWindow(doc, now)) return refuse("the window is still open", "Leave the archiver on until it ends.");
    if (w?.archiver) writeWindow(dir, { ...w, archiver: null });
    return { value: windowState(withLocalWindow(doc, dir), now) };
  }
  if (cmd === "window")
    throw new Error(`unknown window command "${sub}": use window, window start, ids, stop or archived`);
  if (cmd === "wake") return { value: wakePlan(readWindow(dir), now, option(argv, "--resets-at")) };
  if (cmd === "started") {
    needDir();
    const m = TITLE.exec(sub ?? "");
    if (!m || !doc.lanes.includes(m[2]))
      throw new Error(`"${sub}" is not a sprint session title with a lane from docs/sprint.md`);
    if (!TRIGGER_ID.test(arg ?? "")) throw new Error(`"${arg ?? ""}" is not a trigger id`);
    if (!inWindow(doc, now)) return refuse("no window is open", "Start no sessions; report it.");
    const entry = { title: sub, id: arg, at: now.toISOString() };
    recordTrigger(dir, entry);
    return { value: { recorded: entry } };
  }
  if (cmd === "sessions") return { value: sessions(doc, dir, { all: argv.includes("--all") }) };
  return undefined;
}
