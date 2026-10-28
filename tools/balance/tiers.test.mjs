// The per-side AI tier options --lio-tier and --sae-tier (A16, issue #455): parsing, refusals, and a small seeded run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatText } from "./report.mjs";
import { parseArgs, runBalance } from "./run.mjs";

test("--lio-tier and --sae-tier parse into this run's tiers; a side left out stays Easy", () => {
  assert.deepEqual(parseArgs(["--lio-tier", "medium"]).tiers, { lio: "medium" });
  assert.deepEqual(parseArgs(["--sae-tier", "easy", "--lio-tier", "medium"]).tiers, { sae: "easy", lio: "medium" });
  assert.equal(parseArgs([]).tiers, undefined);
});

test("a tier that does not exist is refused with the allowed tiers and the usage line", () => {
  assert.throws(
    () => parseArgs(["--lio-tier", "hard"]),
    /--lio-tier must be one of easy, medium, not "hard"[\s\S]*Usage:/,
  );
  assert.throws(() => parseArgs(["--sae-tier"]), /--sae-tier needs a value/);
});

test("a run without tiers has no tier line, so the default report is unchanged", () => {
  const stats = runBalance({ scenario: "test-map", games: 1, seed: "tiers-test" });
  assert.equal(stats.tiers, undefined);
  assert.doesNotMatch(formatText(stats), /Tiers:/);
});

test("a Medium-vs-Easy run reports the tiers and the crises each side caused, and Medium causes none", () => {
  const stats = runBalance({
    scenario: "test-map",
    games: 6,
    seed: "tiers-test",
    tiers: { lio: "medium", sae: "easy" },
  });
  assert.deepEqual(stats.tiers, { lio: "medium", sae: "easy" });
  assert.equal(stats.crises.lio, 0);
  assert.match(formatText(stats), /Tiers: LIO medium, SAE easy\. Escalation crises caused: LIO 0, SAE \d+\./);
});

test("the same seed and tiers give the same run", () => {
  const options = { scenario: "test-map", games: 3, seed: "tiers-same", tiers: { sae: "medium" } };
  assert.deepEqual(runBalance(options), runBalance(options));
});
