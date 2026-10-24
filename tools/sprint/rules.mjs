// The sprint queue's rules as pure functions of a snapshot: open issues and pull requests with their labels,
// comments and checks, plus docs/sprint.md. queue.mjs loads the snapshot from GitHub and prints the answers;
// nothing here calls gh. Every rule the sprint-supervisor, sprint-lane and night-shift skills used to spell
// out in prose lives here once, so the supervisor's "has work" and the lane's "what next" can't drift apart.
import { inWindow, taskId } from "./sprint-doc.mjs";

export const OWNER = "astevegreen";
export const MEMORY_FLOOR_MB = 4096;
export const REQUIRED_CHECKS = ["gate", "tools-windows"]; // the ruleset on main
export const SONAR_CHECK = "SonarCloud Code Analysis";
// Sonar findings the owner accepts in SonarCloud: they never make work, and never stop a merge.
export const ACCEPTED_SONAR = [/^Do not add `then` to an object\b/, /^Remove this redundant type alias\b/];
// `move <pr> held --conflict` starts its comment with this; the lane retries such a hold once main moves on.
export const HELD_CONFLICT = "Held: merge conflict with main only.";
export const FIX_PASSES = 2; // per lane or night-shift session
const PLAN_TARGET = 3; // a plan session tops its lane up to this many ready issues
const NIGHT_STOP = [3 * 60 + 30, 17 * 60]; // the night shift stops between 03:30 and 17:00 local time

const has = (item, label) => item.labels.includes(label);
const ms = (s) => new Date(s).getTime();
const byNumber = (a, b) => a.number - b.number;
const laneOf = (item) => item.labels.find((l) => l.startsWith("lane:"))?.slice(5) ?? null;

// --- Comments: whose words count -------------------------------------------------------------------

const isAudit = (c) => c.body.startsWith("<!-- gemini-audit -->");
// A sprint or night-shift comment: anything the agents' account wrote except a Gemini audit or Sonar's own.
const isSprint = (c, owner) => c.author !== owner && !isAudit(c) && !/sonar/i.test(c.author);
const newest = (comments, keep) =>
  comments.filter(keep).reduce((a, c) => (!a || ms(c.createdAt) >= ms(a.createdAt) ? c : a), null);

// The owner's own comment, newer than the last sprint comment. An answer the agents relayed doesn't count:
// only the owner's GitHub account speaks for the owner.
export function ownerReply(item, owner) {
  const o = newest(item.comments, (c) => c.author === owner);
  const s = newest(item.comments, (c) => isSprint(c, owner));
  return o && (!s || ms(o.createdAt) > ms(s.createdAt)) ? o : null;
}

function conflictRetry(pr, S) {
  const s = newest(pr.comments, (c) => isSprint(c, S.owner));
  return Boolean(s?.body.startsWith(HELD_CONFLICT) && S.mainChangedAt && ms(S.mainChangedAt) > ms(s.createdAt));
}

// --- Dependencies -----------------------------------------------------------------------------------

// Every #<n> in an issue's "Depends on" field: issues and pull requests alike.
export const depRefs = (text) => [...new Set([...String(text ?? "").matchAll(/#(\d+)/g)].map((m) => Number(m[1])))];

export function index(S) {
  if (!S.byNumber) S.byNumber = new Map([...S.issues, ...S.prs].map((x) => [x.number, x]));
  return S.byNumber;
}
// An item the snapshot doesn't hold closed before the snapshot's oldest item: it counts as closed.
const isOpen = (n, S) => index(S).get(n)?.state === "OPEN";
const taskPr = (n, S) => S.prs.find((p) => p.state === "OPEN" && (p.head === `task/${n}` || p.closes.includes(n)));

// The open tasks an issue waits for, each as its issue number (a pull request counts as the issue it closes).
export function openDeps(issue, S) {
  const tasks = depRefs(issue.deps)
    .filter((n) => n !== issue.number && isOpen(n, S))
    .map((n) => index(S).get(n).closes?.[0] ?? n);
  return [...new Set(tasks)];
}

// --- Pull requests ----------------------------------------------------------------------------------

export function checkState(pr, S) {
  const state = new Map(pr.checks.map((c) => [c.name, c.state]));
  const sonarFailed = state.get(SONAR_CHECK) === "FAILURE";
  const sonarOpen = sonarFailed
    ? (S.sonar?.[pr.number] ?? []).filter((t) => !ACCEPTED_SONAR.some((r) => r.test(t)))
    : [];
  return {
    requiredFailed: REQUIRED_CHECKS.filter((n) => state.get(n) === "FAILURE"),
    requiredGreen: REQUIRED_CHECKS.every((n) => state.get(n) === "SUCCESS"),
    otherFailed: pr.checks
      .filter((c) => c.state === "FAILURE" && !REQUIRED_CHECKS.includes(c.name) && c.name !== SONAR_CHECK)
      .map((c) => c.name),
    sonarOpen,
  };
}

// Open, on main, ready, not held, green and mergeable: only the owner's approval is missing.
export function waitsOnlyForOwner(pr, S) {
  const c = checkState(pr, S);
  return (
    pr.state === "OPEN" &&
    pr.base === "main" &&
    !pr.isDraft &&
    !has(pr, "held") &&
    c.requiredGreen &&
    !c.otherFailed.length &&
    !c.sonarOpen.length &&
    pr.mergeable !== "CONFLICTING" &&
    pr.reviewRequired
  );
}

// sprint-lane step 1, and night-shift step 1 (held only).
function prJob(pr, S, fixesLeft, { heldOnly = false } = {}) {
  const job = { pr: pr.number, issue: pr.closes[0] ?? null, branch: pr.head, base: pr.base };
  const fix = (concerns, reason) => (fixesLeft > 0 ? { mode: "fix", ...job, concerns, reason } : null);
  if (has(pr, "held")) {
    const reply = ownerReply(pr, S.owner);
    if (reply) return fix(reply.body.slice(0, 1500), "held, and the owner replied");
    if (!heldOnly && conflictRetry(pr, S))
      return fix("Merge conflict with main.", "held only for a merge conflict, and main has moved on since");
    return null;
  }
  if (heldOnly) return null;
  const c = checkState(pr, S);
  const conflict = pr.mergeable === "CONFLICTING";
  if (c.requiredFailed.length || conflict || c.sonarOpen.length) {
    const what = [
      ...c.requiredFailed.map((n) => `the ${n} check failed`),
      ...(conflict ? ["it conflicts with its base"] : []),
      ...c.sonarOpen.map((t) => `Sonar: ${t}`),
    ];
    return fix(what.join("; "), what.length > 1 ? `${what.length} problems` : what[0]);
  }
  if (pr.base !== "main") return null; // stacked: it waits for its base to merge first
  if (pr.isDraft && pr.title.startsWith("[stacked on"))
    return { mode: "merge", ...job, reason: "its dependency merged, so GitHub moved it onto main" };
  if (!pr.isDraft && !pr.autoMerge && c.requiredGreen && !c.otherFailed.length)
    return { mode: "merge", ...job, reason: "checks green, auto-merge not yet on" };
  return null;
}

// --- Issues -----------------------------------------------------------------------------------------

// sprint-lane step 2: an in-progress issue at the start of a lane session was left by one that stopped.
function staleJob(issue, S) {
  const pr = taskPr(issue.number, S);
  if (pr)
    return {
      mode: "adopt",
      issue: issue.number,
      pr: pr.number,
      branch: pr.head,
      base: pr.base,
      draft: pr.isDraft,
      reason: pr.isDraft
        ? "a stopped session left it in progress; its pull request is still a draft"
        : "a stopped session left it in progress; its pull request is open",
    };
  if (has(issue, "blocked"))
    return { mode: "settle", issue: issue.number, reason: "a stopped session left it in progress and blocked" };
  return {
    mode: "requeue",
    issue: issue.number,
    reason: "a stopped session left it in progress, with no pull request",
  };
}

// sprint-lane step 3 and night-shift step 2: ready, not blocked, and nothing it depends on still open,
// except that lane online may stack on one dependency whose pull request waits only for the owner.
function buildJob(issue, S, lane) {
  const open = openDeps(issue, S);
  const job = { mode: "build", issue: issue.number };
  if (!open.length) return { ...job, reason: "ready, and nothing it depends on is open" };
  const depPr = open.length === 1 && lane === "online" ? taskPr(open[0], S) : null;
  if (depPr && waitsOnlyForOwner(depPr, S))
    return {
      ...job,
      stackOn: depPr.head,
      stackPr: depPr.number,
      reason: `stacks on #${depPr.number}, which waits only for the owner's approval`,
    };
  return null;
}

function backlogKey(issue, doc, lane) {
  const id = taskId(issue.title);
  const at = id ? (doc.backlog[lane] ?? []).indexOf(id.base) : -1;
  return [at < 0 ? Infinity : at, id?.part ?? "", issue.number];
}
const compareKeys = (a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || a[2] - b[2];

const openWith = (S, ...labels) => S.issues.filter((i) => i.state === "OPEN" && labels.every((l) => has(i, l)));

// --- The commands -----------------------------------------------------------------------------------

// The lane's next job, in the order of the sprint-lane skill: pull requests, stale work, ready issues.
export function next(S, doc, lane, { fixesDone = 0 } = {}) {
  if (!inWindow(doc, S.now)) return null;
  const L = `lane:${lane}`;
  for (const pr of S.prs.filter((p) => p.state === "OPEN" && has(p, L)).sort(byNumber)) {
    const job = prJob(pr, S, FIX_PASSES - fixesDone);
    if (job) return job;
  }
  const stale = openWith(S, L, "in-progress").sort(byNumber)[0];
  if (stale) return staleJob(stale, S);
  const ready = openWith(S, L, "sprint-ready")
    .filter((i) => !has(i, "blocked"))
    .sort((a, b) => compareKeys(backlogKey(a, doc, lane), backlogKey(b, doc, lane)));
  for (const issue of ready) {
    const job = buildJob(issue, S, lane);
    if (job) return job;
  }
  return null;
}

// The night shift's next job: held pull requests outside the sprint with an owner reply, then `ready` issues.
export function nextNight(S, doc, { fixesDone = 0 } = {}) {
  if (inWindow(doc, S.now)) return null; // the sprint's lanes have the night
  if (S.localMinutes >= NIGHT_STOP[0] && S.localMinutes < NIGHT_STOP[1]) return null;
  for (const pr of S.prs.filter((p) => p.state === "OPEN" && has(p, "held") && !laneOf(p)).sort(byNumber)) {
    const job = prJob(pr, S, FIX_PASSES - fixesDone, { heldOnly: true });
    if (job) return job;
  }
  for (const issue of openWith(S, "ready")
    .filter((i) => !has(i, "blocked") && !has(i, "in-progress"))
    .sort(byNumber)) {
    const job = buildJob(issue, S, null);
    if (job) return job;
  }
  return null;
}

// A backlog ID is done once an issue title starts `[task] <ID>:` or `[task] <ID><letter>:`.
export const doneIds = (S) => new Set(S.issues.map((i) => taskId(i.title)?.base).filter(Boolean));

// Whether the supervisor should start the session with this title.
export function hasWork(S, doc, title) {
  const m = /^Sprint (lane|plan): ([a-z]+)$/.exec(title);
  if (!m || !doc.lanes.includes(m[2]))
    throw new Error(
      `unknown session title "${title}": use "Sprint lane: <lane>" or "Sprint plan: <lane>" with a lane from docs/sprint.md (${doc.lanes.join(", ")})`,
    );
  const [, kind, lane] = m;
  if (!inWindow(doc, S.now)) return { start: false, reason: "outside the sprint window" };
  if (S.freeMb < MEMORY_FLOOR_MB)
    return { start: false, reason: `${S.freeMb} MB free, under the ${MEMORY_FLOOR_MB} MB floor` };
  if (kind === "lane") {
    const job = next(S, doc, lane);
    if (job) return { start: true, reason: `${job.mode} ${job.pr ? `#${job.pr}` : `#${job.issue}`}: ${job.reason}` };
    const waiting = openWith(S, `lane:${lane}`, "sprint-ready").filter((i) => !has(i, "blocked"));
    return {
      start: false,
      reason: waiting.length
        ? `${waiting.length} ready, all waiting on open dependencies (${waiting
            .map(
              (i) =>
                `#${i.number} on ${openDeps(i, S)
                  .map((d) => `#${d}`)
                  .join(" ")}`,
            )
            .join("; ")})`
        : "nothing ready, in progress or to fix",
    };
  }
  const ready = openWith(S, `lane:${lane}`, "sprint-ready").length;
  const done = doneIds(S);
  const todo = (doc.backlog[lane] ?? []).filter((id) => !done.has(id));
  if (ready >= PLAN_TARGET) return { start: false, reason: `${ready} ready issues already` };
  if (!todo.length) return { start: false, reason: "every backlog ID has an issue" };
  return { start: true, reason: `${ready} ready; not yet specified: ${todo.join(", ")}` };
}

// The status block: counts per lane, the last merge, free memory and what needs the owner.
export function status(S, doc, { merged = [], lastMain = null, need = [], oldBody = "" } = {}) {
  const lines = [`Updated ${new Date(S.now).toISOString().slice(0, 16)}Z`, ""];
  for (const lane of doc.lanes) {
    const L = `lane:${lane}`;
    const count = (...labels) => openWith(S, L, ...labels).length;
    const held = S.prs.filter((p) => p.state === "OPEN" && has(p, L) && has(p, "held")).length;
    const landed = merged.filter((p) => has(p, L)).length;
    lines.push(
      `- ${lane}: ${openWith(S, L, "sprint-ready").filter((i) => !has(i, "blocked")).length} ready, ${count("in-progress")} building, ${held} held, ${count("blocked")} blocked, ${landed} merged since the window opened`,
    );
  }
  if (lastMain)
    lines.push(
      "",
      `Last merge to main: #${lastMain.number} ${lastMain.title} (${lastMain.mergedAt}); CI: ${lastMain.ci ?? "unknown"}`,
    );
  lines.push(`Free memory: ${S.freeMb} MB`);
  const needs = [
    ...S.issues
      .filter((i) => i.state === "OPEN" && laneOf(i) && has(i, "blocked"))
      .sort(byNumber)
      .map((i) => `#${i.number} ${i.title}: blocked on a question`),
    ...S.prs
      .filter((p) => p.state === "OPEN" && p.reviewRequired)
      .sort(byNumber)
      .map((p) => `#${p.number} ${p.title}: waits for your approval`),
    ...S.prs
      .filter((p) => p.state === "OPEN" && has(p, "held") && !prJob(p, S, 1))
      .sort(byNumber)
      .map((p) => `#${p.number} ${p.title}: held; its last comment says why`),
    ...need,
  ];
  lines.push("", "## Needs you", ...(needs.length ? needs.map((n) => `- ${n}`) : ["- nothing"]));
  const before = new Set(
    String(oldBody)
      .split(/\r?\n/)
      .map((l) => l.trim()),
  );
  return { body: lines.join("\n"), needsYou: needs, newNeeds: needs.filter((n) => !before.has(`- ${n}`)) };
}
