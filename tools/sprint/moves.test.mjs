// Tests for the sprint's label moves (moves.mjs): which gh commands each move plans, which moves are refused with
// what to do instead, and what a run does when GitHub refuses a command. The command line and loading GitHub's state
// are in queue.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HELD_CONFLICT } from "./rules.mjs";
import { planMove, runMove } from "./moves.mjs";

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

// The REST calls a plan makes, written out: `gh issue` and `gh pr` edit and comment need GraphQL.
const rest = (method, path, ...fields) => [
  ...["api", "--method", method, `repos/{owner}/{repo}/${path}`],
  ...fields.flatMap((f) => ["-f", f]),
];
const add = (n, ...labels) => rest("POST", `issues/${n}/labels`, ...labels.map((l) => `labels[]=${l}`));
const drop = (n, label) => rest("DELETE", `issues/${n}/labels/${encodeURIComponent(label)}`);
const say = (n, body) => rest("POST", `issues/${n}/comments`, `body=${body}`);
const retitle = (n, title) => rest("PATCH", `issues/${n}`, `title=${title}`);

test("building takes a ready issue; a blocked or unready one is refused with what to do instead", () => {
  const S = snap([
    issue(5, ["lane:rules", "sprint-ready"]),
    issue(6, ["lane:rules", "sprint-ready", "blocked"]),
    issue(7, ["ready"]),
  ]);
  assert.deepEqual(planMove(S, 5, "building"), {
    steps: [add(5, "in-progress"), drop(5, "sprint-ready")],
  });
  assert.deepEqual(planMove(S, 7, "building").steps.at(-1), drop(7, "ready"), "the night shift's label");
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
    add(5, "in-progress"),
    drop(5, "blocked"),
    say(5, "Unblocked by the owner's answer; the sprint builds it again."),
  ]);
  assert.deepEqual(
    planMove(S, 6, "building").steps.at(-1),
    say(6, "Unblocked by the owner's answer; the night shift builds it again."),
  );
  assert.equal(planMove(S, 7, "building").error, "#7 is blocked");
});

test("adopting a ready issue's pull request takes the issue out of the ready queue", () => {
  const S = snap(
    [issue(30, ["lane:rules", "sprint-ready"]), issue(31, ["ready"])],
    [pr(130), pr(131, { isDraft: true })],
  );
  assert.deepEqual(planMove(S, 30, "waiting").steps, [drop(30, "sprint-ready"), add(130, "lane:rules")]);
  assert.deepEqual(planMove(S, 31, "waiting").steps, [drop(31, "ready")]);
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
    add(5, "sprint-ready"),
    drop(5, "in-progress"),
    say(5, "Re-queued by the sprint: the previous lane session stopped."),
  ]);
  assert.match(planMove(S, 30, "ready").do, /move 30 waiting/);
  assert.match(planMove(S, 6, "ready").do, /move 6 blocked/);
  assert.deepEqual(planMove(S, 30, "waiting").steps, [drop(30, "in-progress"), add(130, "lane:rules")]);
});

test("merging marks the pull request ready, drops a stacked prefix, labels it, turns on auto-merge and asks for the owner's review", () => {
  const S = snap(
    [issue(30, ["lane:online"])],
    [pr(130, { isDraft: true, title: "[stacked on #129] O4a: x", labels: ["held"], reviewRequired: true })],
  );
  assert.deepEqual(planMove(S, 130, "merging").steps, [
    ["pr", "ready", "130"],
    retitle(130, "O4a: x"),
    add(130, "lane:online"),
    drop(130, "held"),
    ["pr", "merge", "130", "--auto", "--squash"],
    rest("POST", "pulls/130/requested_reviewers", "reviewers[]=astevegreen"),
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
    retitle(157, "[stacked on #160] R157"),
    add(157, "lane:online"),
  ]);
  assert.match(planMove(S, 160, "stacked").error, /on main, not stacked/);
});

test("a hold needs its concerns; --conflict marks a conflict-only hold that the lane retries", () => {
  const S = snap([issue(30, ["lane:rules"])], [pr(130)]);
  assert.match(planMove(S, 130, "held").do, /held --blocker --note "<the blockers>"/);
  assert.match(planMove(S, 130, "held", { conflict: true }).do, /held --conflict --note "<the conflict>"/);
  const { steps } = planMove(S, 130, "held", { note: "packages/x.ts", conflict: true });
  assert.deepEqual(steps.at(-1), say(130, `${HELD_CONFLICT} packages/x.ts`));
  assert.deepEqual(steps[0], add(130, "lane:rules", "held"));
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
  assert.deepEqual(planMove(S, 157, "stacked").steps, [drop(157, "held")]);
});

test("blocking with a note starts the comment with Blocked:, once", () => {
  const S = snap([issue(8, ["lane:rules", "in-progress"])]);
  assert.deepEqual(planMove(S, 8, "blocked", { note: "which colour?" }).steps, [
    add(8, "blocked"),
    drop(8, "in-progress"),
    say(8, "Blocked: which colour?"),
  ]);
  assert.deepEqual(
    planMove(S, 8, "blocked", { note: "Blocked: which colour?" }).steps.at(-1),
    say(8, "Blocked: which colour?"),
  );
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

// --- running a plan: `gh pr ready` and auto-merge have no REST route, so a cloud session is refused them ----------

const REFUSAL = "gh pr: HTTP 403: GitHub GraphQL is not available; use REST";

// gh that throws `error` for each command `fails` picks.
function runner(fails = () => false, error = REFUSAL) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    if (fails(args)) throw new Error(error);
    return "";
  };
  return { gh, calls };
}
const isReady = (a) => a[1] === "ready";
const isMerge = (a) => a[1] === "merge";
const draftPr = (extra = {}) => snap([issue(30, ["lane:rules"])], [pr(130, { isDraft: true, ...extra })]);

test("a run makes every planned call in order and says what it ran", () => {
  const { steps } = planMove(draftPr(), 130, "merging");
  const { gh, calls } = runner();
  assert.deepEqual(runMove(130, "merging", steps, gh), { ran: steps.map((s) => ["gh", ...s]) });
  assert.deepEqual(calls, steps);
});

test("a hold stands when GitHub refuses to mark the draft ready: labelled and commented, and it says so", () => {
  const { steps } = planMove(draftPr(), 130, "held", { note: "[blocker] x" });
  const { gh, calls } = runner(isReady);
  const r = runMove(130, "held", steps, gh);
  assert.equal(r.error, undefined);
  assert.deepEqual(calls, steps, "the label and the comment still run");
  assert.equal(r.ran.length, steps.length - 1, "the refused call is not listed as run");
  assert.equal(r.notDone.length, 1);
  assert.match(r.notDone[0], /#130 is still a draft.*gh pr ready 130.*HTTP 403.*use REST/);
});

test("merging stops, changing nothing, when GitHub refuses to mark the draft ready", () => {
  const { steps } = planMove(draftPr({ labels: ["held"] }), 130, "merging");
  const { gh, calls } = runner(isReady);
  const r = runMove(130, "merging", steps, gh);
  assert.deepEqual(calls, [["pr", "ready", "130"]], "held stays: the queue would never pick the draft up without it");
  assert.deepEqual(r.ran, []);
  assert.match(r.error, /#130 was not moved to merging.*HTTP 403/);
  assert.match(r.do, /queue\.mjs move 130 merging/);
});

test("a refused auto-merge is never reported as merging; the other calls still run", () => {
  const S = snap([issue(30, ["lane:rules"])], [pr(130, { reviewRequired: true })]);
  const { steps } = planMove(S, 130, "merging", { note: "[minor] x" });
  const { gh, calls } = runner(isMerge);
  const r = runMove(130, "merging", steps, gh);
  assert.deepEqual(calls, steps);
  assert.match(r.error, /#130 is not set to auto-merge.*HTTP 403.*use REST/);
  assert.match(r.do, /queue\.mjs move 130 merging/);
  assert.equal(r.ran.length, steps.length - 1);
});

test("stacking stops when GitHub refuses to turn the pull request back into a draft", () => {
  const S = snap(
    [issue(57, ["lane:online"])],
    [pr(160, { head: "task/36", closes: [36] }), pr(157, { head: "task/57", base: "task/36", closes: [57] })],
  );
  const { steps } = planMove(S, 157, "stacked");
  const { gh, calls } = runner(isReady);
  const r = runMove(157, "stacked", steps, gh);
  assert.equal(calls.length, 1);
  assert.match(r.error, /#157 was not moved to stacked/);
  assert.match(r.do, /queue\.mjs move 157 stacked/);
});

test("only a 403 on ready or auto-merge is tolerated: any other failure still throws", () => {
  const { steps } = planMove(draftPr(), 130, "held", { note: "[blocker] x" });
  const other = runner(isReady, "gh pr ready 130: HTTP 502");
  assert.throws(() => runMove(130, "held", steps, other.gh), /HTTP 502/);
  assert.equal(other.calls.length, 1);
  const label = runner((a) => a[2] === "POST", "gh api --method POST: HTTP 403: Resource not accessible");
  assert.throws(() => runMove(130, "held", steps, label.gh), /Resource not accessible/);
});

test("removing a label that is already gone is no failure, as with gh's own edit", () => {
  const S = snap([issue(5, ["lane:rules", "sprint-ready"])]);
  const { steps } = planMove(S, 5, "building");
  const gone = runner((a) => a[2] === "DELETE", "gh api --method DELETE: gh: Label does not exist (HTTP 404)");
  assert.equal(runMove(5, "building", steps, gone.gh).error, undefined);
  const missing = runner((a) => a[2] === "DELETE", "gh api --method DELETE: gh: Not Found (HTTP 404)");
  assert.throws(() => runMove(5, "building", steps, missing.gh), /Not Found/);
});
