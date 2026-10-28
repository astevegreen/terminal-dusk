// Tests for the sprint's label moves (moves.mjs): which gh commands each move plans, and which moves are refused
// with what to do instead. The command line and loading GitHub's state are in queue.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HELD_CONFLICT } from "./rules.mjs";
import { planMove } from "./moves.mjs";

const NOW = new Date("2026-10-21T12:00:00Z");

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
  labels: [],
  mergeable: "MERGEABLE",
  autoMerge: false,
  closes: [number - 100],
  reviewRequired: false,
  reviewers: [],
  comments: [],
  checks: [],
  ...extra,
});
const snap = (issues = [], prs = []) => ({ now: NOW, freeMb: 16000, owner: "astevegreen", issues, prs, sonar: {} });

test("building takes a ready issue; a blocked or unready one is refused with what to do instead", () => {
  const S = snap([
    issue(5, ["lane:rules", "sprint-ready"]),
    issue(6, ["lane:rules", "sprint-ready", "blocked"]),
    issue(7, ["ready"]),
  ]);
  assert.deepEqual(planMove(S, 5, "building"), {
    steps: [["issue", "edit", "5", "--add-label", "in-progress", "--remove-label", "sprint-ready"]],
  });
  assert.deepEqual(planMove(S, 7, "building").steps[0].slice(-1), ["ready"], "the night shift's label");
  const r = planMove(S, 6, "building");
  assert.equal(r.error, "#6 is blocked");
  assert.match(r.do, /next <lane>/);
});

test("building a blocked issue the owner answered unblocks it and says so; without the owner's reply it stays refused", () => {
  const ask = { author: "greenbeanbot", createdAt: "2026-10-21T09:00:00Z", body: "Blocked: which colour?" };
  const answer = { author: "astevegreen", createdAt: "2026-10-21T10:00:00Z", body: "Red." };
  const S = snap([
    issue(5, ["lane:rules", "blocked"], { comments: [ask, answer] }),
    issue(6, ["blocked"], { comments: [ask, answer] }),
    issue(7, ["lane:rules", "blocked"], { comments: [{ ...answer, createdAt: "2026-10-21T08:00:00Z" }, ask] }),
  ]);
  assert.deepEqual(planMove(S, 5, "building").steps, [
    ["issue", "edit", "5", "--add-label", "in-progress", "--remove-label", "blocked"],
    ["issue", "comment", "5", "--body", "Unblocked by the owner's answer; the sprint builds it again."],
  ]);
  assert.deepEqual(
    planMove(S, 6, "building").steps[1].at(-1),
    "Unblocked by the owner's answer; the night shift builds it again.",
  );
  assert.equal(planMove(S, 7, "building").error, "#7 is blocked");
});

test("adopting a ready issue's pull request takes the issue out of the ready queue", () => {
  const S = snap(
    [issue(30, ["lane:rules", "sprint-ready"]), issue(31, ["ready"])],
    [pr(130), pr(131, { isDraft: true })],
  );
  assert.deepEqual(planMove(S, 30, "waiting").steps, [
    ["issue", "edit", "30", "--remove-label", "sprint-ready"],
    ["pr", "edit", "130", "--add-label", "lane:rules"],
  ]);
  assert.deepEqual(planMove(S, 31, "waiting").steps, [["issue", "edit", "31", "--remove-label", "ready"]]);
});

test("re-queueing comments why, and is refused once the issue has a pull request or is blocked", () => {
  const S = snap(
    [
      issue(5, ["lane:rules", "in-progress"]),
      issue(30, ["lane:rules", "in-progress"]),
      issue(6, ["lane:rules", "in-progress", "blocked"]),
    ],
    [pr(130)],
  );
  assert.deepEqual(planMove(S, 5, "ready").steps, [
    ["issue", "edit", "5", "--remove-label", "in-progress", "--add-label", "sprint-ready"],
    ["issue", "comment", "5", "--body", "Re-queued by the sprint: the previous lane session stopped."],
  ]);
  assert.match(planMove(S, 30, "ready").do, /move 30 waiting/);
  assert.match(planMove(S, 6, "ready").do, /move 6 blocked/);
  assert.deepEqual(planMove(S, 30, "waiting").steps, [
    ["issue", "edit", "30", "--remove-label", "in-progress"],
    ["pr", "edit", "130", "--add-label", "lane:rules"],
  ]);
});

test("merging marks the pull request ready, drops a stacked prefix, labels it, turns on auto-merge and asks for the owner's review", () => {
  const S = snap(
    [issue(30, ["lane:online"])],
    [pr(130, { isDraft: true, title: "[stacked on #129] O4a: x", labels: ["held"], reviewRequired: true })],
  );
  assert.deepEqual(planMove(S, 130, "merging").steps, [
    ["pr", "ready", "130"],
    ["pr", "edit", "130", "--title", "O4a: x", "--add-label", "lane:online", "--remove-label", "held"],
    ["pr", "merge", "130", "--auto", "--squash"],
    ["pr", "edit", "130", "--add-reviewer", "astevegreen"],
  ]);
});

test("a stacked pull request can't be merged into its dependency's branch; it stays a titled draft (the #177 mis-merge)", () => {
  const S = snap(
    [issue(57, ["lane:online"])],
    [pr(160, { head: "task/36", closes: [36] }), pr(157, { head: "task/57", base: "task/36", closes: [57] })],
  );
  assert.deepEqual(planMove(S, 157, "merging"), {
    error: "pull request #157 is stacked on task/36: merging it now would land it there, not on main",
    do: "Run: node tools/sprint/queue.mjs move 157 stacked",
  });
  assert.deepEqual(planMove(S, 157, "stacked").steps, [
    ["pr", "ready", "157", "--undo"],
    ["pr", "edit", "157", "--title", "[stacked on #160] R157", "--add-label", "lane:online"],
  ]);
  assert.match(planMove(S, 160, "stacked").error, /on main, not stacked/);
});

test("a hold needs its concerns; --conflict marks a conflict-only hold that the lane retries", () => {
  const S = snap([issue(30, ["lane:rules"])], [pr(130)]);
  assert.match(planMove(S, 130, "held").do, /held --blocker --note "<the blockers>"/);
  assert.match(planMove(S, 130, "held", { conflict: true }).do, /held --conflict --note "<the conflict>"/);
  const { steps } = planMove(S, 130, "held", { note: "packages/x.ts", conflict: true });
  assert.deepEqual(steps.at(-1), ["pr", "comment", "130", "--body", `${HELD_CONFLICT} packages/x.ts`]);
  assert.deepEqual(steps[0], ["pr", "edit", "130", "--add-label", "lane:rules", "--add-label", "held"]);
});

test("a state that doesn't fit the item is refused", () => {
  const S = snap([issue(30, [])], [pr(130)]);
  assert.match(planMove(S, 130, "building").error, /is a pull request/);
  assert.match(planMove(S, 30, "merging").error, /is an issue/);
  assert.match(planMove(S, 30, "done").error, /unknown state/);
  assert.match(planMove(S, 31, "building").error, /not an open issue or pull request/);
});

test("a stacked pull request that passes its fix pass loses held and keeps its draft", () => {
  const S = snap(
    [issue(57, ["lane:online"])],
    [
      pr(160, { head: "task/36", closes: [36] }),
      pr(157, {
        head: "task/57",
        base: "task/36",
        closes: [57],
        isDraft: true,
        title: "[stacked on #160] R157",
        labels: ["lane:online", "held"],
      }),
    ],
  );
  assert.deepEqual(planMove(S, 157, "stacked").steps, [["pr", "edit", "157", "--remove-label", "held"]]);
});

test("blocking with a note starts the comment with Blocked:, once", () => {
  const S = snap([issue(8, ["lane:rules", "in-progress"])]);
  assert.deepEqual(planMove(S, 8, "blocked", { note: "which colour?" }).steps[1], [
    "issue",
    "comment",
    "8",
    "--body",
    "Blocked: which colour?",
  ]);
  assert.equal(planMove(S, 8, "blocked", { note: "Blocked: which colour?" }).steps[1].at(-1), "Blocked: which colour?");
});

test("only an answer to a Blocked: question unblocks: the owner's own note, or a reply after a Re-queued comment, does not", () => {
  const owner = (at, body) => ({ author: "astevegreen", createdAt: at, body });
  const bot = (at, body) => ({ author: "greenbeanbot", createdAt: at, body });
  const S = snap([
    // The owner blocked it himself, with a note, after an old sprint comment.
    issue(9, ["lane:rules", "blocked"], {
      comments: [
        bot("2026-10-21T08:00:00Z", "Re-queued by the sprint: the previous lane session stopped."),
        owner("2026-10-21T09:00:00Z", "Blocking this until the art lands."),
      ],
    }),
    // An agent's question was answered once, and a later sprint comment asks nothing.
    issue(10, ["lane:rules", "blocked"], {
      comments: [
        bot("2026-10-21T08:00:00Z", "Blocked: which colour?"),
        owner("2026-10-21T09:00:00Z", "Red."),
        bot("2026-10-21T10:00:00Z", "Unblocked by the owner's answer; the sprint builds it again."),
        owner("2026-10-21T11:00:00Z", "Hold it again, please."),
      ],
    }),
  ]);
  assert.equal(planMove(S, 9, "building").error, "#9 is blocked");
  assert.equal(planMove(S, 10, "building").error, "#10 is blocked");
});
