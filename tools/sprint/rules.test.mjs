// Tests for the sprint queue's rules: October's sprint replayed from its recorded issues and pull requests,
// plus small made-up cases for the rules October's record can't show (checks, Sonar, held comments).
// fixtures/october.jsonl: TD's issues and pull requests from 19-23 Oct with their label, draft, merge and
// review timelines (exported once with gh; comments cut to 200 characters). fixtures/october-sprint.md is
// docs/sprint.md as it stood after the sprint, so later sprints can rewrite docs/sprint.md freely.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HELD_CONFLICT, MEMORY_FLOOR_MB, backlog, hasWork, next, nextNight } from "./rules.mjs";
import { status } from "./status.mjs";
import { readFixture, snapshotAt } from "./replay.mjs";
import { readSprintDoc, taskId } from "./sprint-doc.mjs";

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const DOC = readSprintDoc(readFileSync(path.join(FIXTURES, "october-sprint.md"), "utf8"));
const OCTOBER = readFixture(readFileSync(path.join(FIXTURES, "october.jsonl"), "utf8"));
const at = (time, opts) => snapshotAt(OCTOBER, time, opts);

// A made-up snapshot inside the window: lane rules with whatever issues and pull requests a test needs.
const NOW = "2026-10-21T12:00:00Z";
const issue = (number, labels, extra = {}) => ({
  number,
  title: `[task] R${number}: x`,
  state: "OPEN",
  labels,
  deps: null,
  comments: [],
  ...extra,
});
const pr = (number, extra = {}) => ({
  number,
  title: `R${number}`,
  state: "OPEN",
  isDraft: false,
  head: `task/${number - 100}`,
  base: "main",
  labels: ["lane:rules"],
  mergeable: "MERGEABLE",
  autoMerge: false,
  closes: [number - 100],
  reviewRequired: false,
  reviewers: [],
  comments: [],
  checks: [
    { name: "gate", state: "SUCCESS" },
    { name: "tools-windows", state: "SUCCESS" },
  ],
  ...extra,
});
const comment = (author, createdAt, body) => ({ author, createdAt, body });
const snap = ({ issues = [], prs = [], ...rest } = {}) => ({
  now: new Date(NOW),
  freeMb: 16000,
  localMinutes: 0,
  owner: "astevegreen",
  mainChangedAt: "2026-10-21T11:00:00Z",
  sonar: {},
  issues,
  prs,
  ...rest,
});

test("docs/sprint.md gives the window, the lanes, every backlog ID (several to a line) and no log issue while it's a placeholder", () => {
  assert.equal(DOC.window.start.toISOString(), "2026-10-21T00:00:00.000Z");
  assert.equal(DOC.window.end.toISOString(), "2026-10-22T14:00:00.000Z");
  assert.deepEqual(DOC.lanes, ["rules", "app", "online", "research"]);
  assert.deepEqual(DOC.backlog.rules.slice(0, 4), ["R1", "R2", "R3", "R4"]);
  assert.deepEqual(DOC.backlog.online.at(-1), "O9");
  assert.equal(DOC.logIssue, null);
  assert.deepEqual(taskId("[task] R12b: Content"), { id: "R12b", base: "R12", part: "b" });
  assert.equal(taskId("O3: Supabase"), null);
});

// --- October, replayed --------------------------------------------------------------------------------

test("October: with R8-R13 all blocked at 13:19 on 21 Oct, the rules lane builds R6d and the status block lists the six", () => {
  const S = at("2026-10-21T13:19:00Z");
  assert.deepEqual(next(S, DOC, "rules"), {
    mode: "build",
    issue: 192,
    reason: "ready, and nothing it depends on is open",
  });
  const { needsYou } = status(S, DOC);
  assert.deepEqual(
    needsYou
      .filter((n) => n.endsWith("blocked on a question (in the daily Decisions digest)"))
      .map((n) => n.split(" ")[0]),
    ["#199", "#200", "#201", "#202", "#203", "#204"],
  );
});

test("October: O7b-O7e waited on O7a (#210), so the online lane had no work and the supervisor starts none", () => {
  const S = at("2026-10-22T01:20:00Z");
  assert.equal(next(S, DOC, "online"), null);
  const r = hasWork(S, DOC, "TD lane: online");
  assert.equal(r.start, false);
  assert.match(
    r.reason,
    /4 ready, all waiting on open dependencies \(#211 on #210; #214 on #211; #215 on #210 #211; #216 on #211 #214\)/,
  );
});

test("October: the supervisor's old test saw 4 ready online issues at 08:00 on 21 Oct, but each waited on an open one", () => {
  const S = at("2026-10-21T08:00:00Z");
  // The prose test ("an open sprint-ready issue without blocked") said start; the lane would have found nothing.
  assert.equal(
    S.issues.filter(
      (i) =>
        i.state === "OPEN" &&
        i.labels.includes("lane:online") &&
        i.labels.includes("sprint-ready") &&
        !i.labels.includes("blocked"),
    ).length,
    4,
  );
  assert.equal(hasWork(S, DOC, "TD lane: online").start, false);
});

test("October: lane online had work while no supervisor ran on 22 Oct (TD-P3)", () => {
  assert.deepEqual(hasWork(at("2026-10-22T09:00:00Z"), DOC, "TD lane: online"), {
    start: true,
    reason: "build #253: ready, and nothing it depends on is open",
  });
});

test("October: O4a stacks on O3 while O3 waits only for the owner's approval", () => {
  const job = next(at("2026-10-21T02:00:00Z"), DOC, "online");
  assert.deepEqual(job, {
    mode: "build",
    issue: 157,
    stackOn: "task/136",
    stackPr: 160,
    reason: "stacks on #160, which waits only for the owner's approval",
  });
});

test("October: a stacked pull request (#177 on task/136) is never merged by the lane (TD-P9)", () => {
  const S = at("2026-10-21T11:00:00Z");
  const p177 = S.prs.find((p) => p.number === 177);
  assert.equal(p177.base, "task/136");
  for (const lane of DOC.lanes) assert.notEqual(next(S, DOC, lane)?.pr, 177);
  // Released, it would still never be a merge job while its base is task/136.
  p177.labels = p177.labels.filter((l) => l !== "held");
  assert.equal(next(S, DOC, "online"), null);
});

test("October: a backlog ID is done when an issue for it or one of its parts exists; R1 is not R12", () => {
  const S = at("2026-10-21T02:00:00Z");
  assert.deepEqual(hasWork(S, DOC, "TD plan: app"), { start: true, reason: "2 ready; not yet specified: A2" });
  const later = at("2026-10-21T08:00:00Z");
  assert.deepEqual(hasWork(later, DOC, "TD plan: app"), { start: false, reason: "every backlog ID has an issue" });
  const S2 = snap({
    issues: ["R2", "R3", "R4a", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12", "R13"].map((id, i) =>
      issue(i + 1, [], { title: `[task] ${id}: x`, state: "CLOSED" }),
    ),
  });
  assert.deepEqual(hasWork(S2, DOC, "TD plan: rules"), { start: true, reason: "0 ready; not yet specified: R1" });
});

test("October: the night shift leaves sprint nights to the lanes (TD-P17)", () => {
  const S = at("2026-10-21T07:03:00Z", { localMinutes: 3 * 60 + 3 });
  S.issues.push(issue(9001, ["ready"]));
  assert.equal(nextNight(S, DOC), null);
  const after = at("2026-10-23T07:03:00Z", { localMinutes: 3 * 60 + 3 });
  after.issues.push(issue(9001, ["ready"]));
  assert.deepEqual(nextNight(after, DOC), {
    mode: "build",
    issue: 9001,
    reason: "ready, and nothing it depends on is open",
  });
  assert.equal(nextNight(at("2026-10-23T14:00:00Z", { localMinutes: 10 * 60 }), DOC), null, "by day");
});

// --- Rules October's record can't show ---------------------------------------------------------------

test("a held pull request is retried only when the owner's own account replied; an answer the agents relayed doesn't count", () => {
  const held = (comments) => snap({ prs: [pr(130, { labels: ["lane:rules", "held"], comments })] });
  const hold = comment("greenbeanbot", "2026-10-21T09:00:00Z", "Held: 1. [blocker] the summary is out of date");
  assert.equal(
    next(
      held([hold, comment("greenbeanbot", "2026-10-21T10:00:00Z", "Owner's answer (21 Oct, in chat): fix it")]),
      DOC,
      "rules",
    ),
    null,
  );
  assert.equal(
    next(held([comment("astevegreen", "2026-10-21T08:00:00Z", "ok"), hold]), DOC, "rules"),
    null,
    "the reply predates the hold",
  );
  const job = next(held([hold, comment("astevegreen", "2026-10-21T10:00:00Z", "Fix the summary.")]), DOC, "rules");
  assert.deepEqual(job, {
    mode: "fix",
    pr: 130,
    issue: 30,
    branch: "task/30",
    base: "main",
    concerns: "Fix the summary.",
    reason: "held, and the owner replied",
  });
});

test("a pull request held only for a merge conflict is retried once main has moved on (TD-P11)", () => {
  const held = (body, mainChangedAt) =>
    snap({
      mainChangedAt,
      prs: [
        pr(130, { labels: ["lane:rules", "held"], comments: [comment("greenbeanbot", "2026-10-21T10:00:00Z", body)] }),
      ],
    });
  assert.equal(
    next(held(`${HELD_CONFLICT} packages/x.ts`, "2026-10-21T11:00:00Z"), DOC, "rules").reason,
    "held only for a merge conflict, and main has moved on since",
  );
  assert.equal(
    next(held(`${HELD_CONFLICT} packages/x.ts`, "2026-10-21T09:00:00Z"), DOC, "rules"),
    null,
    "main hasn't changed",
  );
  assert.equal(
    next(held("Held: 1. [blocker] a merge conflict and a missing test", "2026-10-21T11:00:00Z"), DOC, "rules"),
    null,
  );
});

test("Sonar findings the owner accepted make no work and don't stop a merge; any other finding is a fix", () => {
  const sonarFailed = [
    { name: "gate", state: "SUCCESS" },
    { name: "tools-windows", state: "SUCCESS" },
    { name: "SonarCloud Code Analysis", state: "FAILURE" },
  ];
  const accepted = [
    "Do not add `then` to an object.",
    'Remove this redundant type alias and replace its occurrences with "string".',
  ];
  const S = snap({ prs: [pr(130, { checks: sonarFailed })], sonar: { 130: accepted } });
  assert.equal(next(S, DOC, "rules").mode, "merge");
  S.sonar[130] = [...accepted, "Prefer `String#codePointAt()` over `String#charCodeAt()`."];
  assert.deepEqual(next(S, DOC, "rules").concerns, "Sonar: Prefer `String#codePointAt()` over `String#charCodeAt()`.");
});

test("a failed required check or a conflict is a fix; so is a failed check that isn't required, named in the concerns", () => {
  const checks = (gate, e2e) => [
    { name: "gate", state: gate },
    { name: "tools-windows", state: "SUCCESS" },
    { name: "e2e", state: e2e },
  ];
  assert.equal(
    next(snap({ prs: [pr(130, { checks: checks("FAILURE", "SUCCESS") })] }), DOC, "rules").concerns,
    "the gate check failed",
  );
  assert.equal(
    next(snap({ prs: [pr(130, { mergeable: "CONFLICTING" })] }), DOC, "rules").reason,
    "it conflicts with its base",
  );
  assert.deepEqual(next(snap({ prs: [pr(130, { checks: checks("SUCCESS", "FAILURE") })] }), DOC, "rules"), {
    mode: "fix",
    pr: 130,
    issue: 30,
    branch: "task/30",
    base: "main",
    concerns: "the e2e check failed",
    reason: "the e2e check failed",
  });
  assert.equal(
    next(
      snap({ prs: [pr(130, { labels: ["lane:rules", "held"], checks: checks("SUCCESS", "FAILURE") })] }),
      DOC,
      "rules",
    ),
    null,
    "a held one still waits for the owner's reply",
  );
  assert.equal(
    next(snap({ prs: [pr(130, { checks: checks("PENDING", "SUCCESS") })] }), DOC, "rules"),
    null,
    "checks still running",
  );
});

test("after two fix passes the lane moves on to merges and ready issues", () => {
  const S = snap({ issues: [issue(5, ["lane:rules", "sprint-ready"])], prs: [pr(130, { mergeable: "CONFLICTING" })] });
  assert.equal(next(S, DOC, "rules", { fixesDone: 1 }).mode, "fix");
  assert.deepEqual(next(S, DOC, "rules", { fixesDone: 2 }), {
    mode: "build",
    issue: 5,
    reason: "ready, and nothing it depends on is open",
  });
});

test("work a stopped session left in progress: adopt its pull request, re-queue it, or settle a blocked one", () => {
  const draft = snap({
    issues: [issue(30, ["lane:rules", "in-progress"])],
    prs: [pr(130, { isDraft: true, labels: [] })],
  });
  assert.equal(next(draft, DOC, "rules").mode, "adopt");
  assert.equal(next(draft, DOC, "rules").draft, true);
  assert.equal(next(snap({ issues: [issue(30, ["lane:rules", "in-progress"])] }), DOC, "rules").mode, "requeue");
  assert.equal(
    next(snap({ issues: [issue(30, ["lane:rules", "in-progress", "blocked"])] }), DOC, "rules").mode,
    "settle",
  );
});

test("ready issues go in backlog order, parts in letter order, whatever their numbers", () => {
  const S = snap({
    issues: [
      issue(50, ["lane:rules", "sprint-ready"], { title: "[task] R13: x" }),
      issue(60, ["lane:rules", "sprint-ready"], { title: "[task] R12b: x" }),
      issue(70, ["lane:rules", "sprint-ready"], { title: "[task] R12a: x", deps: "#999 (closed long ago), PR #998" }),
    ],
  });
  assert.equal(next(S, DOC, "rules").issue, 70);
  S.issues[2].deps = "R13 (#50)";
  assert.equal(next(S, DOC, "rules").issue, 60);
});

test("the supervisor starts nothing outside the window or under the memory floor, and rejects unknown titles", () => {
  const S = snap({ issues: [issue(5, ["lane:rules", "sprint-ready"])] });
  assert.equal(hasWork(S, DOC, "TD lane: rules").start, true);
  assert.deepEqual(hasWork({ ...S, freeMb: MEMORY_FLOOR_MB - 1 }, DOC, "TD lane: rules"), {
    start: false,
    reason: "4095 MB free, under the 4096 MB floor",
  });
  assert.deepEqual(hasWork({ ...S, now: new Date("2026-10-23T00:00:00Z") }, DOC, "TD lane: rules"), {
    start: false,
    reason: "outside the sprint window",
  });
  assert.equal(next({ ...S, now: new Date("2026-10-23T00:00:00Z") }, DOC, "rules"), null);
  assert.throws(() => hasWork(S, DOC, "TD lane: everything"), /unknown session title/);
});

test("the status block names only new needs in newNeeds, and the supervisor's own lines join Needs you", () => {
  const S = snap({ issues: [issue(5, ["lane:rules", "blocked"])], prs: [pr(130, { reviewRequired: true })] });
  const first = status(S, DOC, { need: ["TD lane: app is stuck"] });
  assert.deepEqual(first.needsYou, [
    "#5 [task] R5: x: blocked on a question (in the daily Decisions digest)",
    "#130 R130: waits for your approval",
    "TD lane: app is stuck",
  ]);
  assert.deepEqual(status(S, DOC, { oldBody: first.body }).newNeeds, []);
  assert.match(first.body, /- rules: 0 ready, 0 building, 0 held, 1 blocked, 0 merged since the window opened/);
});

test("a stacked draft that GitHub moved onto main merges only once its checks are green, like any other", () => {
  const stacked = (checks) => snap({ prs: [pr(130, { isDraft: true, title: "[stacked on #129] R130", checks })] });
  const ok = (name, state) => ({ name, state });
  assert.equal(next(stacked([ok("gate", "SUCCESS"), ok("tools-windows", "SUCCESS")]), DOC, "rules").mode, "merge");
  assert.equal(next(stacked([ok("gate", "PENDING"), ok("tools-windows", "SUCCESS")]), DOC, "rules"), null);
  assert.equal(
    next(stacked([ok("gate", "SUCCESS"), ok("tools-windows", "SUCCESS"), ok("e2e", "FAILURE")]), DOC, "rules").mode,
    "fix",
    "a failed e2e check is fixed before the merge",
  );
});

test("the night shift retries a held pull request only on the owner's own reply, never a sprint one, and at most twice", () => {
  const night = (prs) => ({ ...snap({ prs }), now: new Date("2026-10-23T07:10:00Z"), localMinutes: 3 * 60 + 10 });
  const hold = comment("greenbeanbot", "2026-10-23T01:00:00Z", "Night shift: held after review.");
  const answered = (n, labels = ["held"]) =>
    pr(n, { labels, comments: [hold, comment("astevegreen", "2026-10-23T02:00:00Z", "Go ahead.")] });
  assert.equal(nextNight(night([answered(130)]), DOC).mode, "fix");
  assert.equal(nextNight(night([answered(130)]), DOC, { fixesDone: 2 }), null, "two fix passes a night");
  assert.equal(nextNight(night([answered(130, ["held", "lane:rules"])]), DOC), null, "sprint work");
  const relayed = pr(130, {
    labels: ["held"],
    comments: [hold, comment("greenbeanbot", "2026-10-23T02:00:00Z", "Owner's answer (in chat): go ahead")],
  });
  assert.equal(nextNight(night([relayed]), DOC), null);
  const conflict = pr(130, {
    labels: ["held"],
    comments: [comment("greenbeanbot", "2026-10-23T01:00:00Z", `${HELD_CONFLICT} x.ts`)],
  });
  assert.equal(
    nextNight({ ...night([conflict]), mainChangedAt: "2026-10-23T05:00:00Z" }, DOC),
    null,
    "conflict holds wait for a lane",
  );
});

test("backlog gives a plan session its ready count, its target (6 on the planning day) and the IDs still to specify", () => {
  const S = snap({
    issues: [
      issue(1, ["lane:rules", "sprint-ready"], { title: "[task] R1: x" }),
      issue(2, [], { title: "[task] R2a: x", state: "CLOSED" }),
    ],
  });
  assert.deepEqual(backlog(S, DOC, "rules").todo.slice(0, 2), ["R3", "R4"]);
  assert.equal(backlog(S, DOC, "rules").ready, 1);
  assert.equal(backlog(S, DOC, "rules").target, 3);
  assert.equal(backlog({ ...S, now: new Date("2026-10-20T15:00:00Z") }, DOC, "rules").target, 6);
});

// --- A ready issue that already has a pull request is adopted, not built again ----------------------

test("October: A2a (#171) was ready with pull request #187 open at 10:30 on 21 Oct, so the lane adopts it", () => {
  assert.deepEqual(next(at("2026-10-21T10:30:00Z"), DOC, "app"), {
    mode: "adopt",
    issue: 171,
    pr: 187,
    branch: "task/171",
    base: "main",
    draft: false,
    reason: "ready, but pull request #187 already exists for it",
  });
});

test("October: #267 was ready with draft #273 on 22 Oct; with the window over that evening, the lane adopts the draft", () => {
  const S = at("2026-10-22T19:45:00Z");
  const doc = { ...DOC, window: { start: DOC.window.start, end: new Date("2026-10-23T14:00:00Z") } };
  const job = next(S, doc, "online");
  assert.equal(job.mode, "adopt");
  assert.equal(job.issue, 267);
  assert.equal(job.pr, 273);
  assert.equal(job.draft, true);
});

test("October: the night shift adopts #106's draft #120 instead of building #106 again (19 Oct)", () => {
  const job = nextNight(at("2026-10-19T01:45:00Z", { localMinutes: 20 * 60 }), DOC);
  assert.deepEqual(job, {
    mode: "adopt",
    issue: 106,
    pr: 120,
    branch: "task/106",
    base: "main",
    draft: true,
    reason: "ready, but pull request #120 already exists for it",
  });
});

test("a second attempt's branch (task/<n>-2) counts as the issue's pull request too", () => {
  const S = snap({
    issues: [issue(30, ["lane:rules", "sprint-ready"])],
    prs: [pr(130, { head: "task/30-2", closes: [], labels: [], isDraft: true })],
  });
  assert.equal(next(S, DOC, "rules").mode, "adopt");
  assert.equal(next(S, DOC, "rules").branch, "task/30-2");
  S.prs[0].head = "task/300";
  assert.equal(next(S, DOC, "rules").mode, "build", "task/300 is another issue's branch");
});

// --- The owner's answer unblocks a blocked issue ---------------------------------------------------

test("October: O8g (#258) was blocked by the plan with its question in the body; the owner's answer doesn't send that Goal-only issue to a lane", () => {
  const S = at("2026-10-22T10:55:00Z");
  const done = S.issues.find((i) => i.number === 255); // as if O8d, which it waits on, had merged
  done.state = "CLOSED";
  done.labels = [];
  assert.equal(next(S, DOC, "online").issue, 256, "the lane builds O8f (#256), not O8g");
  assert.ok(
    status(S, DOC).needsYou.includes(
      `#258 ${S.issues.find((i) => i.number === 258).title}: blocked on a question (in the daily Decisions digest)`,
    ),
  );
  // Had the implementer blocked it with a question comment, the same answer would bring it back with the answer.
  const o8g = S.issues.find((i) => i.number === 258);
  o8g.comments.unshift(
    comment("greenbeanbot", "2026-10-22T05:00:00Z", "Blocked: a warning email before the deadline?"),
  );
  const job = next(S, DOC, "online");
  assert.equal(job.mode, "build");
  assert.equal(job.issue, 258);
  assert.equal(job.reason, "blocked, and the owner answered");
  assert.match(job.answer, /^Owner answer: no separate warning before the deadline\./);
  assert.ok(!status(S, DOC).needsYou.some((n) => n.startsWith("#258")), "no longer waits on the owner");
});

test("a blocked issue comes back only on the owner's own reply, newer than the last sprint comment", () => {
  const blocked = (comments) => snap({ issues: [issue(30, ["lane:rules", "blocked"], { comments })] });
  const ask = comment("greenbeanbot", "2026-10-21T09:00:00Z", "Blocked: which colour should the badge be?");
  assert.equal(next(blocked([ask]), DOC, "rules"), null);
  assert.equal(
    next(
      blocked([ask, comment("greenbeanbot", "2026-10-21T10:00:00Z", "Owner's answer (in chat): red")]),
      DOC,
      "rules",
    ),
    null,
    "relayed",
  );
  assert.equal(next(blocked([comment("astevegreen", "2026-10-21T08:00:00Z", "red"), ask]), DOC, "rules"), null);
  assert.deepEqual(next(blocked([ask, comment("astevegreen", "2026-10-21T10:00:00Z", "Red.")]), DOC, "rules"), {
    mode: "build",
    issue: 30,
    answer: "Red.",
    reason: "blocked, and the owner answered",
  });
});

test("the night shift builds a blocked issue the owner answered, but leaves sprint issues to the lanes", () => {
  const night = (labels) => ({
    ...snap({
      issues: [
        issue(30, labels, {
          comments: [
            comment("greenbeanbot", "2026-10-23T01:00:00Z", "Blocked: should the timer use the default length?"),
            comment("astevegreen", "2026-10-23T02:00:00Z", "Use the default."),
          ],
        }),
      ],
    }),
    now: new Date("2026-10-23T07:10:00Z"),
    localMinutes: 3 * 60 + 10,
  });
  assert.deepEqual(nextNight(night(["blocked"]), DOC), {
    mode: "build",
    issue: 30,
    answer: "Use the default.",
    reason: "blocked, and the owner answered",
  });
  assert.equal(nextNight(night(["blocked", "lane:rules"]), DOC), null);
  const noQuestion = night(["blocked"]);
  noQuestion.issues[0].comments.shift();
  assert.equal(nextNight(noQuestion, DOC), null, "the owner's own note on an issue he blocked is no answer");
});

test("the old session titles are refused, so a stale caller is caught", () => {
  assert.throws(() => hasWork(snap(), DOC, "Sprint lane: rules"), /use "TD lane: <lane>"/);
});
