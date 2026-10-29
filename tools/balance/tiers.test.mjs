// The per-side AI tier options --lio-tier and --sae-tier (A16, issue #455): parsing, refusals, and a small seeded run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { countBySide } from "./play.mjs";
import { formatText } from "./report.mjs";
import { parseArgs, runBalance, sumBySide } from "./run.mjs";

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
  assert.match(
    formatText(stats),
    /Tiers: LIO medium, SAE easy\. Escalation crises caused: LIO 0, SAE \d+\. Tech race attempts: LIO \d+, SAE \d+\./,
  );
});

test("the same seed and tiers give the same run", () => {
  const options = { scenario: "test-map", games: 3, seed: "tiers-same", tiers: { sae: "medium" } };
  assert.deepEqual(runBalance(options), runBalance(options));
});

test("Medium as SAE causes no crisis either, on the test map and the six-region map", () => {
  for (const scenario of ["test-map", "six-region"]) {
    const stats = runBalance({ scenario, games: 4, seed: "tiers-sae", tiers: { lio: "easy", sae: "medium" } });
    assert.equal(stats.crises.sae, 0, scenario);
  }
});

// X15 (issue #472): the tier line also counts each side's tech race attempts, from the public events.
test("countBySide counts one kind of public event by the side it names, and ignores other kinds", () => {
  const events = [
    { kind: "techRaceAttempted", side: "lio" },
    { kind: "techRaceAttempted", side: "sae" },
    { kind: "techRaceAttempted", side: "lio" },
    { kind: "escalationCrisis", side: "lio" },
  ];
  assert.deepEqual(countBySide(events, "techRaceAttempted"), { lio: 2, sae: 1 });
  assert.deepEqual(countBySide(events, "escalationCrisis"), { lio: 1, sae: 0 });
  assert.deepEqual(countBySide([], "techRaceAttempted"), { lio: 0, sae: 0 });
});

test("a tiered run sums each game's tech race attempts by side", () => {
  const stats = runBalance({
    scenario: "six-region",
    games: 2,
    seed: "tiers-tech",
    tiers: { lio: "medium", sae: "medium" },
  });
  assert.deepEqual(Object.keys(stats.techRaces), ["lio", "sae"]);
  for (const n of Object.values(stats.techRaces)) assert.ok(Number.isInteger(n) && n >= 0);
});

test("sumBySide adds each game's counts by side, under the key asked for only", () => {
  const games = [
    { crises: { lio: 1, sae: 0 }, techRaces: { lio: 0, sae: 2 } },
    { crises: { lio: 0, sae: 0 }, techRaces: { lio: 3, sae: 1 } },
  ];
  assert.deepEqual(sumBySide(games, "techRaces"), { lio: 3, sae: 3 });
  assert.deepEqual(sumBySide(games, "crises"), { lio: 1, sae: 0 });
  assert.deepEqual(sumBySide([], "techRaces"), { lio: 0, sae: 0 });
});
