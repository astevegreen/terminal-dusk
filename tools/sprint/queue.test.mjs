// Tests for `node tools/sprint/queue.mjs`: loading GitHub's state through gh, and the command line's one line
// of JSON. gh is replaced by a stand-in that records each call. The label moves are in moves.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { main } from "./queue.mjs";

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const DOC_TEXT = readFileSync(path.join(FIXTURES, "october-sprint.md"), "utf8");
const NOW = new Date("2026-10-21T12:00:00Z");

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

test("env names the computer from docs/sprint.md without asking GitHub, and stops while it's a placeholder", () => {
  const { gh, calls } = fakeGh();
  const named = DOC_TEXT.replace(
    "## Machinery\n",
    "## Machinery\n\n- **Environment:** `env_01Qq41L677xykRpHYXs2FnXL` (the desktop PC)\n",
  );
  assert.deepEqual(JSON.parse(main(["env"], { gh, docText: named }).out), {
    environment_id: "env_01Qq41L677xykRpHYXs2FnXL",
  });
  assert.deepEqual(calls, [], "env reads only the document");
  const placeholder = DOC_TEXT.replace("## Machinery\n", "## Machinery\n\n- **Environment:** `env_…` (at setup)\n");
  for (const docText of [DOC_TEXT, placeholder]) {
    const r = main(["env"], { gh, docText });
    assert.equal(r.code, 2);
    assert.match(JSON.parse(r.out).error, /no environment is on record/);
  }
});

test("the command line answers from a recorded sprint with --fixture and --at", () => {
  const r = spawnSync(
    process.execPath,
    [
      path.join(import.meta.dirname, "queue.mjs"),
      "has-work",
      "TD lane: online",
      "--fixture",
      path.join(FIXTURES, "october.jsonl"),
      "--doc",
      path.join(FIXTURES, "october-sprint.md"),
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
  const r = main(["status", "--write", "--need", "TD lane: app is stuck"], {
    gh,
    docText: doc,
    now: NOW,
    freeMb: 9000,
  });
  assert.equal(r.code, 0, r.out);
  const edit = calls.find((c) => c[0] === "issue" && c[1] === "edit");
  assert.deepEqual(edit.slice(0, 4), ["issue", "edit", "300", "--body"]);
  assert.match(edit[4], /Free memory: 9000 MB/);
  assert.deepEqual(JSON.parse(r.out).newNeeds, ["TD lane: app is stuck"]);
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
