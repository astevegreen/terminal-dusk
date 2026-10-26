// Tests for the reviewer eval's pure parts: the prompt, token counts, verdicts and the scoring hint.
// Running the eval itself starts real reviewer sessions, so the tests never do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildPrompt, hint, tokensOf, verdictOf } from "./reviewer-eval.mjs";

const CASES = JSON.parse(readFileSync(path.join(import.meta.dirname, "reviewer-cases.json"), "utf8"));

test("every case names a pull request, its issue, a kind and what happened later; bad ones say what to look for", () => {
  assert.ok(CASES.length >= 10);
  for (const c of CASES) {
    assert.match(c.id, /^[A-Z]\d+[a-z]?$/, c.id);
    assert.ok(Number.isInteger(c.pr) && Number.isInteger(c.issue), c.id);
    assert.ok(c.later, c.id);
    if (c.kind.startsWith("bad")) assert.ok(c.lookFor, c.id);
  }
  assert.ok(CASES.filter((c) => c.kind === "clean").length >= 3);
});

test("each case's id and pull request appear once, so no two cases share a branch or a results file", () => {
  for (const key of ["id", "pr"]) {
    const seen = CASES.map((c) => c[key]);
    assert.deepEqual(
      seen.filter((v, i) => seen.indexOf(v) !== i),
      [],
      key,
    );
  }
});

test('every kind is "bad", "bad, borderline" or "clean"; a clean case has no lookFor; every lookFor is a valid pattern', () => {
  for (const c of CASES) {
    assert.ok(["bad", "bad, borderline", "clean"].includes(c.kind), `${c.id}: ${c.kind}`);
    if (c.kind === "clean") assert.equal(c.lookFor, undefined, c.id);
    if (c.lookFor !== undefined) assert.doesNotThrow(() => new RegExp(c.lookFor, "i"), c.id);
  }
});

test("the prompt diffs the merged change against its parent and carries the spec and summary, not a way to fetch comments", () => {
  const p = buildPrompt(
    { id: "O7d", pr: 249, issue: 215 },
    { sha: "c2392a4", spec: "### Goal\nDraw.", summary: "## What changed\n- x" },
  );
  assert.match(p, /Issue 215, branch eval\/O7d, Base: c2392a4\^/);
  assert.match(p, /read them here, not with gh/);
  assert.match(p, /### Goal\nDraw\./);
  assert.match(p, /Pull request summary \(#249\):\n## What changed/);
});

test("tokens add every kind across models; the reviewer's share is the Opus model's", () => {
  const usage = {
    "claude-sonnet-5-5": {
      inputTokens: 6,
      outputTokens: 1102,
      cacheReadInputTokens: 99432,
      cacheCreationInputTokens: 51301,
    },
    "claude-opus-5-5": {
      inputTokens: 6,
      outputTokens: 1487,
      cacheReadInputTokens: 23783,
      cacheCreationInputTokens: 17106,
    },
  };
  assert.deepEqual(tokensOf(usage), { total: 194223, reviewer: 42382 });
  assert.deepEqual(tokensOf(undefined), { total: 0, reviewer: 0 });
});

test("the verdict and concern counts come from the reviewer's answer", () => {
  assert.deepEqual(verdictOf("PASS\n\nAll good."), { verdict: "PASS", blockers: 0, minors: 0 });
  assert.deepEqual(verdictOf("CONCERNS\n1. [blocker] a.ts:3 x\n2. [minor] b.ts:4 y\n3. [minor] c"), {
    verdict: "CONCERNS",
    blockers: 1,
    minors: 2,
  });
  assert.equal(verdictOf("I could not run the reviewer.").verdict, "unclear");
});

test("the hint says whether a bad case's answer mentions what later broke; clean cases get none", () => {
  const o7d = CASES.find((c) => c.id === "O7d");
  assert.equal(hint(o7d, "CONCERNS\n1. [blocker] the O7c sweep tests still expect bothLate"), true);
  assert.equal(hint(o7d, "PASS"), false);
  assert.equal(
    hint(
      CASES.find((c) => c.kind === "clean"),
      "PASS",
    ),
    null,
  );
});
