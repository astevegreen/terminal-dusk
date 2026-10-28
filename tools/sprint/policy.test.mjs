// Tests for the owner's policy of 28 Oct 2026 in the queue (rules.mjs, moves.mjs, status.mjs, decisions.mjs):
// P1 only a [blocker] holds, P2 a machine failure retries by itself, P4 a rail-audit hold waits for the owner,
// P5 design questions go to the daily Decisions digest and the owner may answer there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DECISIONS, HELD_RAIL, MACHINE, hasWork, next, nextNight, ownerAnswer } from "./rules.mjs";
import { planMove } from "./moves.mjs";
import { status } from "./status.mjs";
import { DIGEST, digest } from "./decisions.mjs";
import { main } from "./queue.mjs";
import { readSprintDoc } from "./sprint-doc.mjs";

const DOC_TEXT = readFileSync(path.join(import.meta.dirname, "fixtures", "october-sprint.md"), "utf8");
const DOC = readSprintDoc(DOC_TEXT);
const NOW = "2026-10-21T12:00:00Z";
const BOT = "greenbeanbot";
const OWNER = "astevegreen";

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
const snap = ({ issues = [], prs = [], now = NOW, ...rest } = {}) => ({
  now: new Date(now),
  freeMb: 16000,
  localMinutes: 0,
  owner: OWNER,
  mainChangedAt: "2026-10-21T11:00:00Z",
  sonar: {},
  issues,
  prs,
  ...rest,
});
const heldWith = (body, labels = ["lane:rules", "held"]) =>
  pr(130, { labels, comments: [comment(BOT, "2026-10-21T10:00:00Z", body)] });

// --- P1: only a [blocker] holds ---------------------------------------------------------------------

test("P1: a pull request held only for [minor] concerns is released and merges", () => {
  const job = next(
    snap({ prs: [heldWith("Held: 1. [minor] a.ts:1 naming\n2. [minor] b.ts:2 a comment")] }),
    DOC,
    "rules",
  );
  assert.equal(job.mode, "merge");
  assert.equal(job.reason, "held only for [minor] concerns, which merge with a note (P1)");
});

test("P1: a [blocker], a rail-audit hold, a conflict or a hold that doesn't say why keeps holding", () => {
  for (const body of [
    "Held: 1. [blocker] a.ts:1 wrong\n2. [minor] b.ts:2",
    `${HELD_RAIL} it drops the test-count step`,
    "Night shift: held after review.",
  ])
    assert.equal(next(snap({ prs: [heldWith(body)] }), DOC, "rules"), null, body);
});

test("P1: a released minor hold with a failed check is fixed first, not merged", () => {
  const S = snap({ prs: [{ ...heldWith("Held: [minor] x"), checks: [{ name: "gate", state: "FAILURE" }] }] });
  assert.equal(next(S, DOC, "rules").mode, "fix");
});

test("P1: the night shift merges a held pull request whose hold was only [minor]", () => {
  const night = {
    ...snap({ prs: [heldWith("Held: [minor] x", ["held"])] }),
    now: new Date("2026-10-23T07:10:00Z"),
    localMinutes: 3 * 60 + 10,
  };
  assert.equal(nextNight(night, DOC).mode, "merge");
});

test("P1: a hold needs a [blocker]; [minor] concerns are refused and sent to merging with a note", () => {
  const S = snap({ issues: [issue(30, ["lane:rules"])], prs: [pr(130)] });
  const refused = planMove(S, 130, "held", { note: "1. [minor] a.ts:1 naming" });
  assert.match(refused.error, /only a \[blocker\] holds/);
  assert.equal(refused.do, 'Run: node tools/sprint/queue.mjs move 130 merging --note "<the minor concerns>"');
  assert.deepEqual(planMove(S, 130, "held", { note: "1. [blocker] a.ts:1 wrong" }).steps.at(-1), [
    "pr",
    "comment",
    "130",
    "--body",
    "Held: 1. [blocker] a.ts:1 wrong",
  ]);
});

test("P1: merging with a note comments the minor concerns before auto-merge, and drops held", () => {
  const S = snap({ issues: [issue(30, ["lane:rules"])], prs: [pr(130, { labels: ["lane:rules", "held"] })] });
  assert.deepEqual(planMove(S, 130, "merging", { note: "[minor] a.ts:1 naming" }).steps, [
    ["pr", "edit", "130", "--remove-label", "held"],
    ["pr", "comment", "130", "--body", "Merging with notes (they hold nothing): [minor] a.ts:1 naming"],
    ["pr", "merge", "130", "--auto", "--squash"],
  ]);
});

// --- P4: a loosened rail holds for the owner --------------------------------------------------------

test("P4: --rail holds with the audit's reason, needs no [blocker], and the status block says so", () => {
  const S = snap({ issues: [issue(30, ["lane:rules"])], prs: [pr(130)] });
  const { steps } = planMove(S, 130, "held", { note: "it removes the e2e step", rail: true });
  assert.deepEqual(steps.at(-1), ["pr", "comment", "130", "--body", `${HELD_RAIL} it removes the e2e step`]);
  const held = snap({ prs: [heldWith(`${HELD_RAIL} it removes the e2e step`)] });
  assert.deepEqual(status(held, DOC).needsYou, [
    "#130 R130: held by agy's rail audit, which says it loosens a rail; its last comment says how",
  ]);
});

// --- P2: a machine failure retries by itself --------------------------------------------------------

test("P2: re-queueing with a note records a machine failure that retries by itself", () => {
  const S = snap({ issues: [issue(5, ["lane:rules", "in-progress"])] });
  assert.deepEqual(planMove(S, 5, "ready", { note: "vitest timed out under host load." }).steps, [
    ["issue", "edit", "5", "--remove-label", "in-progress", "--add-label", "sprint-ready"],
    [
      "issue",
      "comment",
      "5",
      "--body",
      `${MACHINE} vitest timed out under host load. It retries by itself after 60 minutes.`,
    ],
  ]);
});

test("P2: a ready issue that hit a machine failure waits an hour, then builds again, never for the owner", () => {
  const failed = (at) => issue(5, ["lane:rules", "sprint-ready"], { comments: [comment(BOT, at, `${MACHINE} OOM.`)] });
  const soon = snap({ issues: [failed("2026-10-21T11:30:00Z")] });
  assert.equal(next(soon, DOC, "rules"), null);
  assert.deepEqual(hasWork(soon, DOC, "TD lane: rules"), {
    start: false,
    reason: "#5 retries after a machine failure, an hour after it",
  });
  assert.equal(status(soon, DOC).needsYou.length, 0, "a machine failure never needs the owner");
  assert.equal(next(snap({ issues: [failed("2026-10-21T10:59:00Z")] }), DOC, "rules").mode, "build");
});

// --- P5: design questions in the Decisions digest ---------------------------------------------------

const ASK =
  "Blocked: Design question: does a tie in the Escalation track go to the phasing side?\nRecommendation: yes, as in R7.";
const blocked = (n, at = "2026-10-21T09:00:00Z", body = ASK) =>
  issue(n, ["lane:rules", "blocked"], { comments: [comment(BOT, at, body)] });
const decisionsIssue = (comments = []) => ({ ...issue(400, []), title: DECISIONS, comments });

test("P5: the owner's comment on the Decisions issue naming #n answers it; each issue gets its own lines", () => {
  const answer = comment(
    OWNER,
    "2026-10-21T10:00:00Z",
    "#5 take the recommendation\n#6: no, the defender wins\nsee the R7 note",
  );
  const S = snap({ issues: [blocked(5), blocked(6), blocked(7), decisionsIssue([answer])] });
  assert.equal(ownerAnswer(S.issues[0], S).body, "#5 take the recommendation");
  assert.equal(ownerAnswer(S.issues[1], S).body, "#6: no, the defender wins\nsee the R7 note");
  assert.equal(ownerAnswer(S.issues[2], S), null, "#7 is not named");
  assert.equal(next(S, DOC, "rules").answer, "#5 take the recommendation");
});

test("P5: only the owner's own comment there, newer than the question, answers; #50 is not #5", () => {
  const answerTo5 = (c) => {
    const S = snap({ issues: [blocked(5), decisionsIssue([c])] });
    return ownerAnswer(S.issues[0], S);
  };
  assert.equal(answerTo5(comment(OWNER, "2026-10-21T08:00:00Z", "#5 yes")), null, "older than the question");
  assert.equal(answerTo5(comment(BOT, "2026-10-21T10:00:00Z", "#5 yes")), null, "relayed by the bot");
  assert.equal(answerTo5(comment(OWNER, "2026-10-21T10:00:00Z", "#50 yes")), null, "#50 is not #5");
  assert.equal(answerTo5(comment(OWNER, "2026-10-21T10:00:00Z", "#5 yes")).body, "#5 yes");
});

test("P5: a question needs the owner, but only the daily digest pings: never the hourly status", () => {
  const S = snap({ issues: [blocked(5)] });
  const s = status(S, DOC);
  assert.deepEqual(s.needsYou, ["#5 [task] R5: x: blocked on a question (in the daily Decisions digest)"]);
  assert.deepEqual(s.newNeeds, []);
});

test("P5: the digest lists every open question with one mention, marks the new ones, and flags a missing recommendation", () => {
  const S = snap({
    issues: [blocked(5), blocked(6, "2026-10-21T09:00:00Z", "Blocked: Design question: who moves first?")],
  });
  const d = digest(S);
  assert.equal(d.post, true);
  assert.equal(d.issue, null, "no Decisions issue yet");
  assert.deepEqual(d.fresh, [5, 6]);
  assert.equal(d.body.match(/@astevegreen/g).length, 1);
  assert.ok(d.body.startsWith(DIGEST));
  assert.match(d.body, /### #5 \[task\] R5: x \(new\)\nDesign question: does a tie/);
  assert.match(d.body, /### #6 [^\n]*\nDesign question: who moves first\?\n\n_No recommendation given/);
});

test("P5: at most one digest a day, and only when a question is new since the last one", () => {
  const last = (at, numbers) =>
    comment(BOT, at, `${DIGEST}\n@astevegreen …\n\n${numbers.map((n) => `### #${n} x`).join("\n")}`);
  const S = (comments, issues = [blocked(5), blocked(6)]) => snap({ issues: [...issues, decisionsIssue(comments)] });
  assert.match(digest(S([last("2026-10-21T06:00:00Z", [5])])).reason, /the next may go 24 hours after it/);
  assert.equal(digest(S([last("2026-10-20T11:00:00Z", [5])])).post, true);
  assert.equal(digest(S([last("2026-10-19T11:00:00Z", [5, 6])])).reason, "every open question was in the last digest");
  assert.equal(digest(snap()).reason, "no design question waits for the owner");
  const answered = S([comment(OWNER, "2026-10-21T10:00:00Z", "#5 yes\n#6 no")]);
  assert.equal(digest(answered).post, false, "answered questions are not asked again");
});

test("queue digest creates the Decisions issue the first time, then comments the digest on it", () => {
  const calls = [];
  const issues = [
    {
      number: 5,
      title: "[task] R5: x",
      labels: [{ name: "lane:rules" }, { name: "blocked" }],
      body: "",
      comments: [{ author: { login: BOT }, createdAt: "2026-10-21T09:00:00Z", body: ASK }],
    },
  ];
  const gh = (args) => {
    calls.push(args);
    const key = args.join(" ");
    if (key.startsWith("issue list --state open")) return JSON.stringify(issues);
    if (key.startsWith("issue list --state all"))
      return JSON.stringify([{ number: 5, title: "[task] R5: x", state: "OPEN" }]);
    if (key.startsWith("pr list")) return "[]";
    if (key.startsWith("api ")) return "2026-10-21T11:00:00Z\n";
    if (key.startsWith("issue create")) return "https://github.com/o/r/issues/401\n";
    return "";
  };
  const r = main(["digest"], { gh, docText: DOC_TEXT, now: new Date(NOW), freeMb: 16000, localMinutes: 0, dir: null });
  const out = JSON.parse(r.out);
  assert.equal(r.code, 0);
  assert.equal(out.posted, true);
  assert.equal(out.issue, 401);
  const writes = calls.filter((c) => ["create", "comment"].includes(c[1]));
  assert.deepEqual(
    writes.map((c) => c.slice(0, 4)),
    [
      ["issue", "create", "--title", DECISIONS],
      ["issue", "comment", "401", "--body"],
    ],
  );
  const dry = JSON.parse(
    main(["digest", "--dry-run"], {
      gh,
      docText: DOC_TEXT,
      now: new Date(NOW),
      freeMb: 16000,
      localMinutes: 0,
      dir: null,
    }).out,
  );
  assert.equal(dry.posted, false);
});
