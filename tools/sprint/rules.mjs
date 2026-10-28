// The sprint queue's rules as pure functions of a snapshot: open issues and pull requests with their labels,
// comments and checks, plus docs/sprint.md. queue.mjs loads the snapshot from GitHub and prints the answers;
// nothing here calls gh. Every rule the sprint-supervisor, sprint-lane and night-shift skills used to spell
// out in prose lives here once, so the supervisor's "has work" and the lane's "what next" can't drift apart.
import { inWindow, taskId } from "./sprint-doc.mjs";
import { decisionsAnswer, isSprint, ms, newest, ownerReply } from "./comments.mjs";

export { DECISIONS, DIGEST, decisionsAnswer, isDigest, newest, newestSprint, ownerReply } from "./comments.mjs";

export const OWNER = "astevegreen";
export const MEMORY_FLOOR_MB = 4096;
export const REQUIRED_CHECKS = ["gate", "tools-windows"]; // the ruleset on main
export const SONAR_CHECK = "SonarCloud Code Analysis";
// Sonar findings the owner accepts in SonarCloud: they never make work, and never stop a merge.
export const ACCEPTED_SONAR = [/^Do not add `then` to an object\b/, /^Remove this redundant type alias\b/];
// `move <pr> held --conflict` starts its comment with this; the lane retries such a hold once main moves on.
export const HELD_CONFLICT = "Held: merge conflict with main only.";
// `move <pr> held --rail` starts its comment with this: agy's rail audit says the change loosens a rail (P4).
export const HELD_RAIL = "Held: rail audit:";
// Every agent comment that blocks an issue on a question starts with this; the owner's next comment answers it.
export const BLOCKED = "Blocked:";
// `move <n> ready --note` starts its comment with this: a machine failure (a time-out, out of memory, host load, an
// Actions or billing outage) stopped the task, not the change. It retries by itself after an hour (P2).
export const MACHINE = "Machine failure:";
export const RETRY_AFTER_MIN = 60;
export const FIX_PASSES = 2; // per lane or night-shift session
const PLAN_TARGET = 3; // a plan session tops its lane up to this many ready issues
const PLANNING_DAY_TARGET = 6; // outside the window, the planning day specs each lane's first six
const NIGHT_STOP = [3 * 60 + 30, 17 * 60]; // the night shift stops between 03:30 and 17:00 local time

export const has = (item, label) => item.labels.includes(label);
export const byNumber = (a, b) => a.number - b.number;
export const laneOf = (item) => item.labels.find((l) => l.startsWith("lane:"))?.slice(5) ?? null;

// --- Holds and retries (who counts as speaking is in comments.mjs) ----------------------------------

// Why a pull request is held, from the newest sprint comment starting "Held:": "conflict", "rail", "blocker", or
// "minor" when it names [minor] concerns and no [blocker]. P1: only a [blocker] holds, so a minor hold is released
// and the pull request merges; its concerns are already on it as a note. Any other hold comment, or none, holds.
export function holdKind(pr, S) {
  const h = newest(pr.comments, (c) => isSprint(c, S.owner) && c.body.startsWith("Held:"));
  if (!h) return "unknown";
  if (h.body.startsWith(HELD_CONFLICT)) return "conflict";
  if (h.body.startsWith(HELD_RAIL)) return "rail";
  if (/\[blocker\]/i.test(h.body)) return "blocker";
  return /\[minor\]/i.test(h.body) ? "minor" : "unknown";
}

// A ready issue whose last try hit a machine failure waits an hour, so a busy computer isn't hit again at once.
export function machineWait(issue, S) {
  const c = newest(issue.comments, (x) => isSprint(x, S.owner));
  return Boolean(c?.body.startsWith(MACHINE) && ms(S.now) - ms(c.createdAt) < RETRY_AFTER_MIN * 60_000);
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
// An issue's open pull request: from its branch task/<n> (or a later attempt, task/<n>-2), or one that closes it.
export const taskPr = (n, S) =>
  S.prs.find((p) => p.state === "OPEN" && (new RegExp(`^task/${n}(-\\d+)?$`).test(p.head) || p.closes.includes(n)));

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
export function prJob(pr, S, fixesLeft, { heldOnly = false } = {}) {
  const job = { pr: pr.number, issue: pr.closes[0] ?? null, branch: pr.head, base: pr.base };
  const fix = (concerns, reason) => (fixesLeft > 0 ? { mode: "fix", ...job, concerns, reason } : null);
  const minor = has(pr, "held") && holdKind(pr, S) === "minor";
  if (has(pr, "held")) {
    const reply = ownerReply(pr, S.owner);
    if (reply) return fix(reply.body.slice(0, 1500), "held, and the owner replied");
    if (!heldOnly && conflictRetry(pr, S))
      return fix("Merge conflict with main.", "held only for a merge conflict, and main has moved on since");
    if (!minor) return null;
  }
  if (heldOnly && !minor) return null;
  const c = checkState(pr, S);
  const conflict = pr.mergeable === "CONFLICTING";
  if (c.requiredFailed.length || conflict || c.otherFailed.length || c.sonarOpen.length) {
    const what = [
      ...c.requiredFailed.map((n) => `the ${n} check failed`),
      ...(conflict ? ["it conflicts with its base"] : []),
      ...c.otherFailed.map((n) => `the ${n} check failed`),
      ...c.sonarOpen.map((t) => `Sonar: ${t}`),
    ];
    return fix(what.join("; "), what.length > 1 ? `${what.length} problems` : what[0]);
  }
  if (pr.base !== "main") return null; // stacked: it waits for its base to merge first
  // A merge job needs the required checks green; any other failure was a fix above. Stacked drafts too.
  if (!c.requiredGreen) return null;
  if (pr.isDraft && pr.title.startsWith("[stacked on"))
    return { mode: "merge", ...job, reason: "its dependency merged, so GitHub moved it onto main" };
  if (minor) return { mode: "merge", ...job, reason: "held only for [minor] concerns, which merge with a note (P1)" };
  if (!pr.isDraft && !pr.autoMerge) return { mode: "merge", ...job, reason: "checks green, auto-merge not yet on" };
  return null;
}

// --- Issues -----------------------------------------------------------------------------------------

const adoptJob = (issue, pr, reason) => ({
  mode: "adopt",
  issue: issue.number,
  pr: pr.number,
  branch: pr.head,
  base: pr.base,
  draft: pr.isDraft,
  reason,
});

// sprint-lane step 2: an in-progress issue at the start of a lane session was left by one that stopped.
function staleJob(issue, S) {
  const pr = taskPr(issue.number, S);
  if (pr)
    return adoptJob(
      issue,
      pr,
      pr.isDraft
        ? "a stopped session left it in progress; its pull request is still a draft"
        : "a stopped session left it in progress; its pull request is open",
    );
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

// The owner's answer to the question an agent asked on a blocked issue: the newest sprint comment starts with
// "Blocked:" (the implementer's question, or `move blocked --note`), and the owner commented after it, on the
// issue or on the Decisions issue naming it. The issue is work again, and the answer is part of its spec. Any
// other newest sprint comment ("Re-queued", "Unblocked", a plan audit note) asks nothing, so an issue the owner
// blocked himself, or the plan blocked with its question in the body, stays blocked whatever the owner writes.
export function ownerAnswer(issue, S) {
  if (!has(issue, "blocked")) return null;
  const ask = newest(issue.comments, (c) => isSprint(c, S.owner));
  if (!ask?.body.startsWith(BLOCKED)) return null;
  return ownerReply(issue, S.owner) ?? decisionsAnswer(issue, ask, S);
}

// A blocked issue the owner answered, or a ready one: build it, or adopt the pull request a ready one already has.
function issueJob(issue, S, lane) {
  const answer = ownerAnswer(issue, S);
  if (!answer) {
    const pr = taskPr(issue.number, S);
    if (pr) return adoptJob(issue, pr, `ready, but pull request #${pr.number} already exists for it`);
  }
  const job = buildJob(issue, S, lane);
  if (!job || !answer) return job;
  return {
    ...job,
    answer: answer.body.slice(0, 1500),
    reason: job.stackOn ? `the owner answered; ${job.reason}` : "blocked, and the owner answered",
  };
}

function backlogKey(issue, doc, lane) {
  const id = taskId(issue.title);
  const at = id ? (doc.backlog[lane] ?? []).indexOf(id.base) : -1;
  return [at < 0 ? Infinity : at, id?.part ?? "", issue.number];
}
const compareKeys = (a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || a[2] - b[2];

export const openWith = (S, ...labels) => S.issues.filter((i) => i.state === "OPEN" && labels.every((l) => has(i, l)));

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
  const order = (list) => list.sort((a, b) => compareKeys(backlogKey(a, doc, lane), backlogKey(b, doc, lane)));
  const answered = order(openWith(S, L, "blocked").filter((i) => ownerAnswer(i, S)));
  const ready = order(openWith(S, L, "sprint-ready").filter((i) => !has(i, "blocked") && !machineWait(i, S)));
  for (const issue of [...answered, ...ready]) {
    const job = issueJob(issue, S, lane);
    if (job) return job;
  }
  return null;
}

// The night shift's next job: held pull requests outside the sprint with an owner reply, then blocked issues
// outside the sprint that the owner answered, then `ready` issues.
export function nextNight(S, doc, { fixesDone = 0 } = {}) {
  if (inWindow(doc, S.now)) return null; // the sprint's lanes have the night
  if (S.localMinutes >= NIGHT_STOP[0] && S.localMinutes < NIGHT_STOP[1]) return null;
  for (const pr of S.prs.filter((p) => p.state === "OPEN" && has(p, "held") && !laneOf(p)).sort(byNumber)) {
    const job = prJob(pr, S, FIX_PASSES - fixesDone, { heldOnly: true });
    if (job) return job;
  }
  const answered = openWith(S, "blocked").filter((i) => !laneOf(i) && !has(i, "in-progress") && ownerAnswer(i, S));
  const ready = openWith(S, "ready").filter((i) => !has(i, "blocked") && !has(i, "in-progress") && !machineWait(i, S));
  for (const issue of [...answered.sort(byNumber), ...ready.sort(byNumber)]) {
    const job = issueJob(issue, S, null);
    if (job) return job;
  }
  return null;
}

// A backlog ID is done once an issue title starts `[task] <ID>:` or `[task] <ID><letter>:`.
export const doneIds = (S) => new Set(S.issues.map((i) => taskId(i.title)?.base).filter(Boolean));

// A lane's open sprint-ready issues, how many a plan session aims for, and its backlog IDs with no issue yet.
export function backlog(S, doc, lane) {
  const done = doneIds(S);
  const planningDay = !inWindow(doc, S.now); // no window yet, before it or after it
  return {
    ready: openWith(S, `lane:${lane}`, "sprint-ready").length,
    target: planningDay ? PLANNING_DAY_TARGET : PLAN_TARGET,
    todo: (doc.backlog[lane] ?? []).filter((id) => !done.has(id)),
  };
}

// Whether the supervisor should start the session with this title.
export function hasWork(S, doc, title) {
  const m = /^TD (lane|plan): ([a-z]+)$/.exec(title);
  if (!m || !doc.lanes.includes(m[2]))
    throw new Error(
      `unknown session title "${title}": use "TD lane: <lane>" or "TD plan: <lane>" with a lane from docs/sprint.md (${doc.lanes.join(", ")})`,
    );
  const [, kind, lane] = m;
  if (!inWindow(doc, S.now)) return { start: false, reason: "outside the sprint window" };
  if (S.freeMb < MEMORY_FLOOR_MB)
    return { start: false, reason: `${S.freeMb} MB free, under the ${MEMORY_FLOOR_MB} MB floor` };
  if (kind === "lane") {
    const job = next(S, doc, lane);
    if (job) return { start: true, reason: `${job.mode} ${job.pr ? `#${job.pr}` : `#${job.issue}`}: ${job.reason}` };
    const ready = openWith(S, `lane:${lane}`, "sprint-ready").filter((i) => !has(i, "blocked"));
    const retrying = ready.filter((i) => machineWait(i, S));
    const waiting = ready.filter((i) => !machineWait(i, S));
    if (retrying.length && !waiting.length)
      return {
        start: false,
        reason: `${retrying.map((i) => `#${i.number}`).join(" ")} retries after a machine failure, an hour after it`,
      };
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
  const { ready, todo } = backlog(S, doc, lane);
  if (ready >= PLAN_TARGET) return { start: false, reason: `${ready} ready issues already` };
  if (!todo.length) return { start: false, reason: "every backlog ID has an issue" };
  return { start: true, reason: `${ready} ready; not yet specified: ${todo.join(", ")}` };
}
