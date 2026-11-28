// auditPr's quota savings (owner, 28 Nov 2026), with gh, agy, the comment, the login and the ledger stood in for:
// what it skips, when an earlier verdict carries over or only the delta is read, and the ledger line of each review.
import { test } from "node:test";
import assert from "node:assert/strict";
import { REPO as REPO_NAME, auditPr } from "./gemini-audit.mjs";
import { ME, SHA, diffOf, fake } from "./gemini-audit.fake.mjs";
import { readVerdict, verdictMarker } from "./gemini/rails.mjs";

const marked = (login, v, sha = SHA) => ({
  author: { login },
  body: `<!-- gemini-audit -->
${verdictMarker({ sha, blockers: [], notes: [], why: "x", ...v })}
`,
});

test("a change agy can't add to merges without a call, with a comment saying why, and a ledger line", () => {
  for (const [opts, why] of [
    [{ author: "dependabot[bot]", diff: diffOf("pnpm-lock.yaml", 400) }, /Dependabot update/],
    [{ diff: diffOf("docs/follow-ups.md", 200) }, /only docs/],
    [{ diff: diffOf("packages/app/src/x.test.ts", 200) }, /only tests/],
    [{ diff: diffOf("packages/app/src/x.ts", 10) }, /10 lines, none on a high-risk path or a rail/],
  ]) {
    const { io, calls } = fake(opts);
    const r = auditPr(7, io);
    assert.equal(r.verdict, "merge");
    assert.equal(r.skipped, true);
    assert.equal(calls.ask.length, 0);
    assert.match(calls.post[0].body, why);
    assert.match(calls.post[0].body, /the reviewer, CI and Sonar still decide/);
    assert.equal(readVerdict(calls.post[0].body).skipped, true);
    assert.deepEqual(
      [calls.ledger[0].mode, calls.ledger[0].verdict, calls.ledger[0].repo],
      ["skip", "merge", REPO_NAME],
    );
  }
});

test("a small change on a high-risk path or a rail is still reviewed, and an instruction file is never docs", () => {
  for (const [file, lines] of [
    ["packages/engine/src/a.ts", 2],
    ["tools/git-hooks/pre-push", 2],
    ["CLAUDE.md", 40],
    [".claude/skills/x/SKILL.md", 40],
  ]) {
    const { io, calls } = fake({ diff: diffOf(file, lines) });
    auditPr(7, io);
    assert.equal(calls.ask.length, 1, file);
  }
});

test("every review writes one ledger line with its mode, depth, model, seconds, tokens and verdict", () => {
  const { io, calls } = fake({ answers: { "pr-audit": "[blocker] a.ts:1 wrong" } });
  io.ask = (prompt, material, what, opts) => {
    calls.ask.push({ prompt, opts, material });
    return {
      model: "gemini-4-hydrogen-high",
      response: "[blocker] a.ts:1 wrong",
      passed: [{ model: "claude-opus-5-5-high" }],
      seconds: 41.5,
      tokens: 21353,
      depth: "standard",
      why: "x",
    };
  };
  auditPr(7, io);
  assert.deepEqual(calls.ledger, [
    {
      repo: REPO_NAME,
      pr: 7,
      sha: SHA,
      mode: "full",
      depth: "standard",
      model: "gemini-4-hydrogen-high",
      passed: ["claude-opus-5-5-high"],
      seconds: 41.5,
      tokens: 21353,
      verdict: "fix",
    },
  ]);
});

test("a pull request agy once stopped is read again, even when a fix push leaves it small or docs-only", () => {
  for (const [verdict, diff] of [
    ["fix", diffOf("packages/app/src/x.ts", 10)],
    ["hold", diffOf("docs/follow-ups.md", 200)],
  ]) {
    const { io, calls } = fake({ diff, comments: [marked(ME, { verdict }, "aaa111")] });
    auditPr(7, io);
    assert.equal(calls.ask.length, 1, verdict);
    assert.notEqual(calls.ledger.at(-1).mode, "skip", verdict);
  }
  // Only a fix or hold from the audit's own account stops a pull request: its own merge, retry or skip does not,
  // and a pasted marker from anyone else is ignored.
  for (const comment of [
    marked(ME, { verdict: "merge" }, "aaa111"),
    marked(ME, { verdict: "retry" }, "aaa111"),
    marked(ME, { verdict: "merge", skipped: true }, "aaa111"),
    marked("stranger", { verdict: "fix" }, "aaa111"),
  ]) {
    const { io, calls } = fake({ diff: diffOf("packages/app/src/x.ts", 10), comments: [comment] });
    auditPr(7, io);
    assert.equal(calls.ask.length, 0, comment.author.login);
    assert.equal(calls.ledger.at(-1).mode, "skip");
  }
});

const recorded = (sha, verdict, extra = {}) => ({ repo: REPO_NAME, pr: 7, sha, verdict, mode: "full", ...extra });

test("a merge the ledger recorded carries over a small delta off the high-risk paths and rails, with no call", () => {
  const { io, calls } = fake({
    comments: [marked(ME, { verdict: "merge" }, "aaa111")],
    ledger: [recorded("aaa111", "merge")],
    compare: { aaa111: { diff: diffOf("packages/app/src/x.ts", 20) } },
  });
  const r = auditPr(7, io);
  assert.equal(r.verdict, "merge");
  assert.equal(r.from, "aaa111");
  assert.equal(calls.ask.length, 0);
  assert.match(calls.post[0].body, /merge on aaa111 carries over: the 20 lines since touch no high-risk path or rail/);
  assert.deepEqual([calls.ledger.at(-1).mode, calls.ledger.at(-1).from], ["carry", "aaa111"]);
});

test("a carried-over merge builds on the commit agy read, so carry-overs never add up past the limit", () => {
  const { io, calls } = fake({
    comments: [marked(ME, { verdict: "merge" }, "aaa111"), marked(ME, { verdict: "merge", from: "aaa111" }, "bbb222")],
    ledger: [recorded("aaa111", "merge"), recorded("bbb222", "merge", { mode: "carry", from: "aaa111" })],
    compare: { aaa111: { diff: diffOf("packages/app/src/x.ts", 60) } },
  });
  auditPr(7, io);
  assert.equal(calls.ask.length, 1);
  assert.match(calls.ask[0].material, /^# Earlier review\n\nagy reviewed this change at aaa111 and said `merge`\./);
  assert.deepEqual(calls.ledger.at(-1).mode, "delta");
});

test("after a fix, or a delta past the limit, agy reads only the delta, told the earlier verdict; on a rail, all of it", () => {
  const { io, calls } = fake({
    comments: [marked(ME, { verdict: "fix", blockers: ["a.ts:1 wrong"] }, "aaa111")],
    ledger: [recorded("aaa111", "fix")],
    compare: { aaa111: { diff: diffOf("packages/app/src/fixed.ts", 4) } },
  });
  const r = auditPr(7, io);
  assert.equal(r.verdict, "merge");
  const { material } = calls.ask[0];
  assert.match(material, /Its blockers:\n- a\.ts:1 wrong\n/);
  assert.match(material, /packages\/app\/src\/fixed\.ts/);
  assert.doesNotMatch(material, /packages\/app\/src\/x\.ts/, "the whole pull request is not sent again");
  assert.match(calls.post[0].body, /changes since aaa111/);
  const rail = fake({
    diff: diffOf("packages/app/src/x.ts") + diffOf("tools/git-hooks/pre-push", 2),
    comments: [marked(ME, { verdict: "merge" }, "aaa111")],
    ledger: [recorded("aaa111", "merge")],
    compare: { aaa111: { diff: diffOf("tools/git-hooks/pre-push", 2) } },
  });
  auditPr(7, rail.io);
  assert.equal(rail.calls.ask[0].opts.also, "rail-audit", "a delta on a rail asks the rail question");
  assert.equal(rail.calls.ledger.at(-1).mode, "full");
});

test("a delta that touches a rail gets the whole pull request, rail question included", () => {
  const { io, calls } = fake({
    diff: diffOf("packages/app/src/x.ts") + diffOf("tools/git-hooks/pre-push", 2),
    comments: [marked(ME, { verdict: "fix" }, "aaa111")],
    ledger: [recorded("aaa111", "fix")],
    compare: { aaa111: { diff: diffOf("tools/git-hooks/pre-push", 2) } },
  });
  auditPr(7, io);
  assert.equal(calls.ask[0].opts.also, "rail-audit");
  assert.deepEqual(calls.ask[0].opts.deepPaths, ["tools/git-hooks/pre-push"]);
  assert.doesNotMatch(calls.ask[0].material, /Earlier review/);
  assert.equal(calls.ledger.at(-1).mode, "full");
});

test("a verdict marker the ledger never recorded is never built on: the whole pull request is reviewed", () => {
  const { io, calls } = fake({
    comments: [marked(ME, { verdict: "merge" }, "aaa111")],
    compare: { aaa111: { diff: diffOf("packages/app/src/x.ts", 2) } },
  });
  auditPr(7, io);
  assert.equal(calls.ask.length, 1);
  assert.doesNotMatch(calls.ask[0].material, /Earlier review/);
  assert.equal(calls.ledger.at(-1).mode, "full");
});

test("a head that merged main in, or no longer follows the earlier commit, gets a full review", () => {
  for (const c of [{ merges: 1 }, { status: "diverged" }]) {
    const { io, calls } = fake({
      comments: [marked(ME, { verdict: "merge" }, "aaa111")],
      ledger: [recorded("aaa111", "merge")],
      compare: { aaa111: { ...c, diff: diffOf("packages/app/src/x.ts", 2) } },
    });
    auditPr(7, io);
    assert.equal(calls.ask.length, 1);
    assert.equal(calls.ledger.at(-1).mode, "full");
  }
});

test("a hold or a skip is never built on", () => {
  for (const [v, line] of [
    [{ verdict: "hold" }, recorded("aaa111", "hold")],
    [{ verdict: "merge", skipped: true }, recorded("aaa111", "merge", { mode: "skip" })],
  ]) {
    const { io, calls } = fake({
      comments: [marked(ME, v, "aaa111")],
      ledger: [line],
      compare: { aaa111: { diff: diffOf("packages/app/src/x.ts", 2) } },
    });
    auditPr(7, io);
    assert.equal(calls.ledger.at(-1).mode, "full", JSON.stringify(v));
  }
});
