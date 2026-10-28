// Tests for agy's merge gate: which diffs touch a rail, how findings and the rail answer are read, and the verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARGON, FLASH, OPUS, SONNET, askFirstAvailable } from "./agy.mjs";
import {
  RAIL_MODELS,
  decide,
  diffFiles,
  findings,
  railAnswer,
  railHits,
  readVerdict,
  reusableVerdict,
  verdictMarker,
} from "./rails.mjs";

const diff = (file, ...lines) =>
  [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, "@@ -1,2 +1,2 @@", ...lines].join("\n");

test("diffFiles lists each file with its added and removed lines, not the file headers", () => {
  const d = `${diff("a.ts", "-old", "+new", " same")}\n${diff("b.ts", "+x")}`;
  assert.deepEqual(diffFiles(d), [
    { file: "a.ts", changed: ["old", "new"] },
    { file: "b.ts", changed: ["x"] },
  ]);
});

test("every rail the owner named counts, wherever in it the change is", () => {
  for (const file of [
    "tools/hooks/bash-guard.mjs",
    "tools/gates/gate.mjs",
    "tools/git-hooks/pre-commit",
    ".github/workflows/ci.yml",
    ".claude/settings.json",
    ".claude/settings.local.json",
    ".github/CODEOWNERS",
    "CODEOWNERS",
    "tools/gemini-audit.mjs",
    "tools/gemini/rails.mjs",
    "GEMINI.md",
    "package.json",
  ])
    assert.equal(railHits(diff(file, "+x")).length, 1, file);
});

test("ordinary code, docs, skills' prose, issue templates and a package's own package.json are not rails", () => {
  for (const file of [
    "packages/engine/src/apply.ts",
    "CLAUDE.md",
    "docs/architecture.md",
    ".github/ISSUE_TEMPLATE/task.yml",
    "tools/sprint/rules.mjs",
    ".claude/skills/sprint-lane/SKILL.md",
    "packages/app/package.json",
  ])
    assert.deepEqual(railHits(diff(file, "+Run the reviewer again.")), [], file);
});

test("a skill or agent line that wires a hook or a tool limit is a rail change", () => {
  assert.equal(railHits(diff(".claude/skills/sprint-lane/SKILL.md", '-    - matcher: "Bash"')).length, 1);
  assert.equal(railHits(diff(".claude/agents/reviewer.md", "+disallowedTools: Edit")).length, 1);
  assert.equal(
    railHits(
      diff(".claude/agents/implementer.md", '-          command: node "$CLAUDE_PROJECT_DIR/tools/hooks/file-lock.mjs"'),
    ).length,
    1,
  );
});

test("findings reads blockers and notes, numbered, bulleted or bold, and ignores other lines", () => {
  const f = findings(
    [
      "Here is what I found.",
      "1. [blocker] packages/x.ts:3 leaks the seed - hard rule 5",
      "- **[note]** tests/y.ts:9 no tie case",
      "[minor] z.ts:1 naming",
      "No findings.",
    ].join("\n"),
  );
  assert.deepEqual(f.blockers, ["packages/x.ts:3 leaks the seed - hard rule 5"]);
  assert.deepEqual(f.notes, ["tests/y.ts:9 no tie case", "z.ts:1 naming"]);
  assert.deepEqual(findings("No findings."), { blockers: [], notes: [] });
});

test("railAnswer reads the first LOOSENS line, with or without bold, and the reason after it", () => {
  assert.deepEqual(railAnswer("**LOOSENS: yes**\nIt removes the e2e step from the gate job."), {
    loosens: true,
    reason: "It removes the e2e step from the gate job.",
  });
  assert.equal(railAnswer("LOOSENS: no\nOnly adds a job.").loosens, false);
  assert.equal(railAnswer("loosens: No").reason, "no reason given");
  assert.equal(railAnswer("I think it is fine.").loosens, null);
});

const ok = (response) => ({ ok: true, response });
const failed = { ok: false, error: "no model answered" };
const hits = [{ file: ".github/workflows/ci.yml", what: ".github workflows" }];

test("no blocker and no rail: merge, with the notes passed on and holding nothing (P3)", () => {
  const v = decide({ review: ok("[note] a.ts:1 a risk") });
  assert.equal(v.verdict, "merge");
  assert.deepEqual(v.notes, ["a.ts:1 a risk"]);
});

test("an agy blocker is a fix pass, like a reviewer blocker (P3)", () => {
  const v = decide({ review: ok("[blocker] a.ts:1 wrong\n[note] b.ts:2 risk") });
  assert.equal(v.verdict, "fix");
  assert.deepEqual(v.blockers, ["a.ts:1 wrong"]);
});

test("a rail change: loosened holds for the owner, not loosened merges, unclear holds (P4)", () => {
  const review = ok("No findings.");
  const yes = decide({ review, rail: ok("LOOSENS: yes\nDrops the test-count step."), hits });
  assert.equal(yes.verdict, "hold");
  assert.match(yes.why, /Drops the test-count step/);
  assert.equal(decide({ review, rail: ok("LOOSENS: no\nAdds a job."), hits }).verdict, "merge");
  assert.equal(decide({ review, rail: ok("Looks fine to me."), hits }).verdict, "hold");
});

test("a loosened rail holds even when the review also found a blocker; the blockers go with it", () => {
  const v = decide({ review: ok("[blocker] a.ts:1 wrong"), rail: ok("LOOSENS: yes\nx"), hits });
  assert.equal(v.verdict, "hold");
  assert.deepEqual(v.blockers, ["a.ts:1 wrong"]);
});

test("an audit that could not run retries by itself: it never merges unaudited or waits for the owner (P2)", () => {
  const rail = decide({ review: ok("No findings."), rail: failed, hits });
  assert.equal(rail.verdict, "retry");
  assert.match(rail.why, /\.github\/workflows\/ci\.yml/);
  const plain = decide({ review: failed });
  assert.equal(plain.verdict, "retry", "a change that touches no rail retries too");
  assert.match(plain.why, /could not run \(no model answered\)/);
  assert.equal(decide({ review: failed, rail: ok("LOOSENS: no\nAdds a job."), hits }).verdict, "retry");
  assert.equal(decide({ review: failed, rail: ok("LOOSENS: yes\nDrops a job."), hits }).verdict, "hold");
});

test("a rail audit asks only Argon, then Opus; with both out of usage it can't run, so it retries", () => {
  assert.deepEqual(RAIL_MODELS, [ARGON, OPUS]);
  const asked = [];
  const outOfUsage = (model) => {
    asked.push(model);
    throw new Error("You have exhausted your individual quota. Resets in 2h0m0s");
  };
  const store = { outUntil: () => null, markOut: () => {} };
  assert.throws(() => askFirstAvailable(RAIL_MODELS, outOfUsage, store, () => 0), /^Error: no model answered/);
  assert.deepEqual(asked, [ARGON, OPUS]);
  assert.ok(!asked.includes(FLASH) && !asked.includes(SONNET));
  const error = "no model answered: both are out of usage";
  assert.equal(decide({ review: ok("No findings."), rail: { ok: false, error }, hits }).verdict, "retry");
});

test("only a verdict the audit's own account posted for this commit, and not a retry, is reused", () => {
  const c = (login, v, sha = "abc") => ({ author: { login }, body: verdictMarker({ sha, ...v }) });
  const merge = { verdict: "merge", why: "x" };
  assert.deepEqual(reusableVerdict([c("greenbeanbot", merge)], "abc", "greenbeanbot"), { sha: "abc", ...merge });
  assert.deepEqual(reusableVerdict([c("AsteveGreen", merge)], "abc", "astevegreen"), { sha: "abc", ...merge });
  assert.equal(reusableVerdict([c("someone", merge)], "abc", "greenbeanbot"), null, "another author's marker");
  assert.equal(reusableVerdict([c("greenbeanbot", merge)], "abc", ""), null, "no login, no trust");
  assert.equal(reusableVerdict([c("greenbeanbot", merge, "old")], "abc", "greenbeanbot"), null, "another commit");
  assert.equal(reusableVerdict([c("greenbeanbot", { verdict: "retry" })], "abc", "greenbeanbot"), null);
  const later = [c("greenbeanbot", merge), c("someone", { verdict: "merge" }), c("greenbeanbot", { verdict: "fix" })];
  assert.equal(reusableVerdict(later, "abc", "greenbeanbot").verdict, "fix", "the newest of its own");
});

test("the verdict marker round-trips, even with --> inside a finding", () => {
  const v = { sha: "abc", verdict: "fix", blockers: ["a --> b"] };
  const body = `<!-- gemini-audit -->\n${verdictMarker(v)}\ntext`;
  assert.deepEqual(readVerdict(body), v);
  assert.equal(readVerdict("<!-- gemini-audit -->\nold audit, no verdict"), null);
});
