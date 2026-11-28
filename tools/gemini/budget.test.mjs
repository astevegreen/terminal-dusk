// How much of agy's quota a review spends (budget.mjs, exported from agy.mjs): the skips, the carry-over, the
// ledger, the token count, and a quota write that fails on Windows without failing the review.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CARRY,
  SMALL,
  appendLedger,
  askFirstAvailable,
  askModel,
  carryOver,
  deltaPreamble,
  isDoc,
  isLockfile,
  isTest,
  quotaFile,
  readLedger,
  replyTokens,
  skipReason,
} from "./agy.mjs";

const QUOTA = "Individual quota reached. Resets in 1h.";

test("Dependabot is skipped whatever it touches; a high-risk path or a rail never is", () => {
  const big = { files: ["packages/engine/src/a.ts"], lines: 500 };
  assert.equal(skipReason(big, { deep: true, author: "dependabot[bot]" }), "it is a Dependabot update");
  assert.equal(skipReason({ files: ["docs/a.md"], lines: 1 }, { deep: true }), null);
  assert.equal(skipReason({ files: ["docs/a.md"], lines: 1 }, { rails: true }), null);
});

test("lockfile-only, test-only and docs-only changes are skipped, whatever their size", () => {
  assert.equal(
    skipReason({ files: ["pnpm-lock.yaml", "packages/x/package-lock.json"], lines: 900 }),
    "it changes only lockfiles",
  );
  assert.equal(
    skipReason({ files: ["packages/app/src/a.test.ts", "packages/x/e2e/b.ts"], lines: 900 }),
    "it changes only tests",
  );
  assert.equal(skipReason({ files: ["docs/design/a.md", "README.md"], lines: 900 }), "it changes only docs");
});

test("an instruction file, a skill or an agent is never a doc", () => {
  for (const f of [
    "CLAUDE.md",
    "packages/app/AGENTS.md",
    "GEMINI.md",
    ".claude/skills/a/SKILL.md",
    ".claude/agents/r.md",
    ".agents/rules/a.md",
  ])
    assert.equal(isDoc(f), false, f);
  assert.equal(isDoc("docs/follow-ups.md"), true);
  // Markdown only: a .txt or a file under docs/ can be data a build or a check reads.
  for (const f of ["notes.txt", "docs/repo-map.json", "docs/design/map.svg"]) assert.equal(isDoc(f), false, f);
  assert.equal(skipReason({ files: ["CLAUDE.md"], lines: 100 }), null);
});

test("the matchers know lockfiles and tests by name, not by folder alone", () => {
  assert.equal(isLockfile("a/b/yarn.lock"), true);
  assert.equal(isLockfile("lock.ts"), false);
  for (const f of ["a/__tests__/b.ts", "tools/x.test.mjs", "py/test_a.py", "a/b.spec.tsx", "tests/a.ts"])
    assert.equal(isTest(f), true, f);
  assert.equal(isTest("packages/app/src/testing.ts"), false);
});

test(`a change under ${SMALL} lines off the high-risk paths and rails is skipped; at ${SMALL} it is reviewed`, () => {
  assert.equal(
    skipReason({ files: ["a.ts"], lines: SMALL - 1 }),
    `it changes ${SMALL - 1} lines, none on a high-risk path or a rail`,
  );
  assert.equal(skipReason({ files: ["a.ts"], lines: SMALL }), null);
  assert.equal(skipReason({ files: [], lines: 0 }), "it changes 0 lines, none on a high-risk path or a rail");
});

test(`a pass carries over a delta under ${CARRY} lines off the high-risk paths and rails`, () => {
  const merge = { sha: "abcdef1234", verdict: "merge" };
  assert.equal(carryOver(merge, { lines: CARRY - 1 }).mode, "carry");
  assert.equal(carryOver({ ...merge, verdict: "ship" }, { lines: 1 }).mode, "carry");
  assert.match(carryOver(merge, { lines: 3 }).why, /^merge on abcdef12 carries over: the 3 lines since/);
  assert.equal(carryOver(merge, { lines: CARRY }).mode, "delta");
  assert.equal(carryOver(merge, { lines: 1 }, { deep: true }).mode, "delta");
  assert.equal(carryOver(merge, { lines: 1 }, { rails: true }).mode, "delta");
});

test("a fix is followed by a delta review; no prior, a hold or a retry by a full one", () => {
  assert.equal(carryOver({ sha: "a", verdict: "fix" }, { lines: 1 }).mode, "delta");
  assert.equal(carryOver(null, { lines: 1 }).mode, "full");
  for (const verdict of ["hold", "owner", "retry"])
    assert.equal(carryOver({ sha: "a", verdict }, { lines: 1 }).mode, "full");
});

test("the delta preamble names the earlier verdict, its blockers and notes, and says to read only the delta", () => {
  const text = deltaPreamble({
    sha: "abcdef1234",
    verdict: "fix",
    blockers: ["a.ts:1 wrong"],
    notes: ["b.ts:2 risky"],
  });
  assert.match(text, /^# Earlier review\n\nagy reviewed this change at abcdef12 and said `fix`\.\n/);
  assert.match(text, /Its blockers:\n- a\.ts:1 wrong\n/);
  assert.match(text, /Its notes:\n- b\.ts:2 risky\n/);
  assert.match(text, /Review only the changes since that commit/);
  assert.doesNotMatch(deltaPreamble({ sha: "a", verdict: "merge" }), /Its blockers/);
});

test("the ledger appends one JSON line per review and reads them back, skipping a broken line", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ledger-"));
  const file = path.join(dir, "ledger.jsonl");
  try {
    assert.deepEqual(readLedger(file), []);
    appendLedger({ repo: "r", pr: 1, verdict: "merge" }, file, () => Date.parse("2026-11-28T12:00:00Z"));
    writeFileSync(file, `${readFileSync(file, "utf8")}not json\n`);
    appendLedger({ repo: "r", pr: 2, verdict: "fix" }, file);
    const lines = readLedger(file);
    assert.deepEqual(lines[0], { at: "2026-11-28T12:00:00.000Z", repo: "r", pr: 1, verdict: "merge" });
    assert.deepEqual(
      lines.map((l) => l.pr),
      [1, 2],
    );
    assert.doesNotThrow(() => appendLedger({ x: 1 }, path.join(dir, "no", "such", "dir.jsonl")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const reply = (usage) => ({
  status: 0,
  stdout: JSON.stringify({ status: "SUCCESS", response: "ok", usage }),
  stderr: "",
});

test("replyTokens reads agy's usage.total_tokens, and null when there is none", () => {
  assert.equal(replyTokens(reply({ total_tokens: 21353 })), 21353);
  assert.equal(replyTokens(reply(undefined)), null);
  assert.equal(replyTokens({ stdout: "not json" }), null);
});

test("askModel adds every run's tokens to the meter, the resume included", () => {
  const timedOut = {
    status: 3,
    stdout: JSON.stringify({ conversation_id: "c1", finished_reason: "print_timeout", usage: { total_tokens: 100 } }),
    stderr: "",
  };
  const runs = [timedOut, reply({ total_tokens: 20 })];
  const meter = { tokens: 0 };
  assert.equal(
    askModel(() => runs.shift(), "p", "m", [], null, meter),
    "ok",
  );
  assert.equal(meter.tokens, 120);
});

test("askFirstAvailable returns the call's seconds and tokens, and a failure carries them too", () => {
  let t = 0;
  const now = () => (t += 1500);
  const store = { outUntil: () => null, markOut() {} };
  const r = askFirstAvailable(["a"], (model, meter) => ((meter.tokens += 7), "fine"), store, now);
  // The clock is read at the start, for the quota check and at the end: 1.5 s apart each.
  assert.deepEqual([r.seconds, r.tokens], [3, 7]);
  const failing = (model, meter) => {
    meter.tokens += 3;
    throw new Error("overloaded");
  };
  assert.throws(
    () => askFirstAvailable(["a"], failing, store, now),
    (e) => /no model answered/.test(e.message) && e.tokens === 3 && e.seconds > 0,
  );
});

test("a quota write whose clean-up fails (Windows EPERM) never fails the review: the next model is asked", () => {
  const eperm = () => {
    throw Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
  };
  const fs = { readFileSync: () => "{}", writeFileSync() {}, rename: eperm, rmSync: eperm };
  const store = quotaFile("q.json", fs);
  assert.doesNotThrow(() => store.markOut("a", new Date()));
  const asked = [];
  const r = askFirstAvailable(
    ["a", "b"],
    (model) => {
      asked.push(model);
      if (model === "a") throw new Error(QUOTA);
      return "fine";
    },
    store,
  );
  assert.deepEqual([r.model, asked], ["b", ["a", "b"]]);
});
