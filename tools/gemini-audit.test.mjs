// The audit script: its command line (these runs stop before any gh or agy call), and auditPr with gh, agy and
// the comment stood in for. The merge gate's rules are tested in tools/gemini/rails.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { auditPr } from "./gemini-audit.mjs";
import { ARGON, FLASH, OPUS, SONNET } from "./gemini/agy.mjs";
import { verdictMarker } from "./gemini/rails.mjs";

const SCRIPT = path.join(import.meta.dirname, "gemini-audit.mjs");
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", windowsHide: true });

test("the usage names the pr <n> merge gate", () => {
  const r = run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: .*\| pr <n> \|/);
});

test("pr needs a pull request number", () => {
  for (const args of [["pr"], ["pr", "abc"]]) {
    const r = run(...args);
    assert.equal(r.status, 1, args.join(" "));
    assert.match(r.stderr, /usage:/);
  }
});

// --- auditPr, with gh, agy, the comment and the signed-in login stood in for ------------------------------------

const SHA = "abc123";
const ME = "astevegreen";
const diffOf = (file) => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-a\n+b\n`;
const marked = (login, v, sha = SHA) => ({
  author: { login },
  body: `<!-- gemini-audit -->\n${verdictMarker({ sha, blockers: [], notes: [], why: "x", ...v })}\n`,
});

// answers: the reply to each prompt, or an Error when agy can't answer it.
function fake({ comments = [], diff = diffOf("packages/app/src/x.ts"), answers = {} } = {}) {
  const calls = { ask: [], post: [], me: 0 };
  const io = {
    gh: (...args) => {
      if (args[0] === "pr" && args[1] === "view")
        return JSON.stringify({ number: 7, body: "", headRefOid: SHA, comments });
      if (args[0] === "pr" && args[1] === "diff") return diff;
      throw new Error(`unexpected gh ${args.join(" ")}`);
    },
    ask: (prompt, material, what, opts = {}) => {
      calls.ask.push({ prompt, opts });
      const a = answers[prompt] ?? "No findings.";
      if (a instanceof Error) throw a;
      return { model: "m", response: a, passed: [], depth: "deep", why: "x" };
    },
    post: (kind, n, body) => calls.post.push({ kind, n, body }),
    me: () => {
      calls.me++;
      return ME;
    },
  };
  return { io, calls };
}

test("auditPr reuses a verdict its own account posted for this commit, without asking agy again", () => {
  const { io, calls } = fake({ comments: [marked(ME, { verdict: "merge" })] });
  const r = auditPr(7, io);
  assert.equal(r.verdict, "merge");
  assert.equal(r.reused, true);
  assert.equal(calls.ask.length, 0);
  assert.equal(calls.post.length, 0);
});

test("auditPr ignores a verdict marker in anyone else's comment: agy reviews again", () => {
  const { io, calls } = fake({
    comments: [marked("someone-else", { verdict: "merge" })],
    answers: { "pr-audit": "[blocker] a.ts:1 wrong" },
  });
  const r = auditPr(7, io);
  assert.equal(r.reused, undefined);
  assert.equal(r.verdict, "fix");
  assert.deepEqual(r.blockers, ["a.ts:1 wrong"]);
  assert.equal(calls.post.length, 1);
});

test("auditPr never reuses a retry, or a verdict for another commit", () => {
  for (const c of [marked(ME, { verdict: "retry" }), marked(ME, { verdict: "merge" }, "older")]) {
    const { io, calls } = fake({ comments: [c] });
    assert.equal(auditPr(7, io).reused, undefined);
    assert.equal(calls.ask.length, 1);
  }
});

test("auditPr asks who it is signed in as only when a comment carries a verdict", () => {
  const { io, calls } = fake();
  auditPr(7, io);
  assert.equal(calls.me, 0);
});

test("auditPr's rail audit asks Argon, Opus and Flash, never Sonnet; when none answers, the verdict is retry", () => {
  const { io, calls } = fake({
    diff: diffOf(".github/workflows/ci.yml"),
    answers: { "rail-audit": new Error("no model answered: Gemini 4 Argon is out of usage") },
  });
  const r = auditPr(7, io);
  const rail = calls.ask.find((a) => a.prompt === "rail-audit");
  assert.deepEqual(rail.opts.models, [ARGON, OPUS, FLASH]);
  assert.ok(!rail.opts.models.includes(SONNET));
  assert.equal(calls.ask.find((a) => a.prompt === "pr-audit").opts.models, undefined, "the review keeps its order");
  assert.equal(r.verdict, "retry");
  assert.match(calls.post[0].body, /\*\*Verdict: retry\*\*/);
});

test("auditPr: agy's review can't run on a change that touches no rail, so it retries and never merges", () => {
  const { io, calls } = fake({ answers: { "pr-audit": new Error("agy is not installed") } });
  const r = auditPr(7, io);
  assert.equal(r.verdict, "retry");
  assert.match(calls.post[0].body, /Gemini audit skipped: agy is not installed/);
});
