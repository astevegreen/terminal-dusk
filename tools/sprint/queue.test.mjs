// Tests for `node tools/sprint/queue.mjs`: label moves, loading GitHub's state through gh, and the
// command line's one line of JSON. gh is replaced by a stand-in that records each call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HELD_CONFLICT } from "./rules.mjs";
import { planMove } from "./moves.mjs";
import { main } from "./queue.mjs";

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const DOC_TEXT = readFileSync(path.join(FIXTURES, "october-sprint.md"), "utf8");
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
  assert.match(planMove(S, 130, "held").do, /--note "<the concerns>"/);
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

// A stand-in for gh holding one open issue, one green pull request awaiting auto-merge, and main's last change.
function fakeGh({ fail, labels = ["lane:rules", "sprint-ready"] } = {}) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    if (fail && args.join(" ").includes(fail)) throw new Error("gh issue list: HTTP 502");
    const key = args.join(" ");
    if (key.startsWith("issue list --state open"))
      return JSON.stringify([
        {
          number: 5,
          title: "[task] R5: x",
          labels: labels.map((name) => ({ name })),
          body: "### Depends on\n\n#4",
          comments: [],
        },
      ]);
    if (key.startsWith("issue list --state all"))
      return JSON.stringify([
        { number: 4, title: "[task] R4: x", state: "CLOSED" },
        { number: 5, title: "[task] R5: x", state: "OPEN" },
      ]);
    if (key.startsWith("pr list --state open --limit"))
      return JSON.stringify([
        {
          number: 104,
          title: "R4",
          isDraft: false,
          headRefName: "task/4",
          baseRefName: "main",
          labels: [{ name: "lane:rules" }],
          mergeable: "MERGEABLE",
          autoMergeRequest: null,
          closingIssuesReferences: [{ number: 4 }],
          comments: [],
          reviewRequests: [],
          statusCheckRollup: [
            { name: "gate", status: "COMPLETED", conclusion: "SUCCESS" },
            { name: "tools-windows", status: "COMPLETED", conclusion: "SUCCESS" },
          ],
        },
      ]);
    if (key.startsWith("pr list --state all"))
      return JSON.stringify([
        {
          number: 104,
          state: "OPEN",
          headRefName: "task/4",
          baseRefName: "main",
          closingIssuesReferences: [{ number: 4 }],
        },
      ]);
    if (key.startsWith("pr list --state open --search")) return "[]";
    if (args[0] === "api") return "2026-10-21T11:00:00Z\n";
    if (key.startsWith("issue view")) return JSON.stringify({ body: "" });
    return args.includes("--json") ? "[]" : "";
  };
  return { gh, calls };
}

test("next loads GitHub's state through gh and prints the lane's next job as one line of JSON", () => {
  const { gh } = fakeGh();
  const r = main(["next", "rules"], { gh, docText: DOC_TEXT, now: NOW, freeMb: 16000 });
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.out), {
    mode: "merge",
    pr: 104,
    issue: 4,
    branch: "task/4",
    base: "main",
    reason: "checks green, auto-merge not yet on",
  });
  assert.ok(!r.out.includes("\n"));
});

test("move runs the planned gh commands in order; --dry-run only prints them", () => {
  const { gh, calls } = fakeGh();
  const r = main(["move", "104", "merging"], { gh, docText: DOC_TEXT, now: NOW, freeMb: 16000 });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(calls.slice(-1), [["pr", "merge", "104", "--auto", "--squash"]]);
  const dry = fakeGh();
  const d = main(["move", "5", "building", "--dry-run"], { gh: dry.gh, docText: DOC_TEXT, now: NOW, freeMb: 16000 });
  assert.equal(JSON.parse(d.out).dryRun, true);
  assert.ok(!dry.calls.some((c) => c[1] === "edit"));
});

test("a refused move exits 1 with error and do; a failure exits 2 and says to stop and report", () => {
  const refused = main(["move", "5", "merging"], { gh: fakeGh().gh, docText: DOC_TEXT, now: NOW, freeMb: 16000 });
  assert.equal(refused.code, 1);
  assert.match(JSON.parse(refused.out).error, /is an issue/);
  const broken = main(["next", "rules"], {
    gh: fakeGh({ fail: "issue list" }).gh,
    docText: DOC_TEXT,
    now: NOW,
    freeMb: 16000,
  });
  assert.equal(broken.code, 2);
  assert.deepEqual(JSON.parse(broken.out), {
    error: "gh issue list: HTTP 502",
    do: "Stop and report this error to the owner; don't fall back to the prose rules.",
  });
  assert.equal(main(["next", "everything"], { gh: fakeGh().gh, docText: DOC_TEXT, now: NOW }).code, 2);
  assert.match(JSON.parse(main(["frobnicate"], { gh: fakeGh().gh, docText: DOC_TEXT, now: NOW }).out).error, /^usage:/);
});

test("the command line answers from a recorded sprint with --fixture and --at", () => {
  const r = spawnSync(
    process.execPath,
    [
      path.join(import.meta.dirname, "queue.mjs"),
      "has-work",
      "Sprint lane: online",
      "--fixture",
      path.join(FIXTURES, "october.jsonl"),
      "--at",
      "2026-10-22T09:00:00Z",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), {
    start: true,
    reason: "build #253: ready, and nothing it depends on is open",
  });
});

test("status --write puts the status block on the sprint log issue named in docs/sprint.md", () => {
  const { gh, calls } = fakeGh();
  const doc = DOC_TEXT.replace("sprint log, issue `#<n>`", "sprint log, issue `#300`");
  const r = main(["status", "--write", "--need", "Sprint lane: app is stuck"], {
    gh,
    docText: doc,
    now: NOW,
    freeMb: 9000,
  });
  assert.equal(r.code, 0, r.out);
  const edit = calls.find((c) => c[0] === "issue" && c[1] === "edit");
  assert.deepEqual(edit.slice(0, 4), ["issue", "edit", "300", "--body"]);
  assert.match(edit[4], /Free memory: 9000 MB/);
  assert.deepEqual(JSON.parse(r.out).newNeeds, ["Sprint lane: app is stuck"]);
  assert.equal(main(["status", "--write"], { gh, docText: DOC_TEXT, now: NOW }).code, 2, "no log issue named");
});

test("between sprints, with docs/sprint.md gone, the night shift still gets its next job", () => {
  const night = { docText: "", now: new Date("2026-10-24T07:10:00Z"), freeMb: 16000, localMinutes: 3 * 60 + 10 };
  const r = main(["next", "night"], { gh: fakeGh({ labels: ["ready"] }).gh, ...night });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(JSON.parse(r.out), { mode: "build", issue: 5, reason: "ready, and nothing it depends on is open" });
  assert.equal(
    JSON.parse(main(["next", "night"], { gh: fakeGh().gh, ...night }).out),
    null,
    "sprint-ready is not the night shift's label",
  );
  assert.equal(
    JSON.parse(main(["next", "night"], { gh: fakeGh({ labels: ["ready"] }).gh, ...night, localMinutes: 10 * 60 }).out),
    null,
    "by day",
  );
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
