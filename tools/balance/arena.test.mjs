// The AI arena (X14, Decision 8): side alternation, tallying, the Medium-beats-Easy and Hard-beats-Medium gates,
// arguments and report shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBlunders, checkGate, formatArena, GATES, parseArgs, runArena, sideOf, tallyArena } from "./arena.mjs";
import { ownBlunder } from "./blunder.mjs";

test("tier A takes LIO in even games and SAE in odd ones, so each tier plays both sides equally", () => {
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => sideOf("a", i)),
    ["lio", "sae", "lio", "sae"],
  );
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => sideOf("b", i)),
    ["sae", "lio", "sae", "lio"],
  );
});

// A hand-made game: tier A sat on `aSide`; `winner` is a side or null for a draw.
const game = (aSide, winner, answers = 10, blunder = null) => ({ aSide, winner, answers, blunder });

test("tally counts wins, losses and draws per tier and per side, with win rates over all games", () => {
  const tally = tallyArena("medium", "easy", [
    game("lio", "lio"), // medium wins as LIO
    game("sae", "lio"), // medium (SAE) loses
    game("lio", "lio"), // medium wins
    game("sae", null, 20), // draw
  ]);
  assert.equal(tally.games, 4);
  assert.deepEqual(tally.tiers.medium, { wins: 2, losses: 1, draws: 1, winRate: 0.5 });
  assert.deepEqual(tally.tiers.easy, { wins: 1, losses: 2, draws: 1, winRate: 0.25 });
  assert.deepEqual(tally.sides.lio, { wins: 3, losses: 0, draws: 1, winRate: 0.75 });
  assert.deepEqual(tally.sides.sae, { wins: 0, losses: 3, draws: 1, winRate: 0 });
  assert.equal(tally.draws, 1);
  assert.equal(tally.averageAnswers, 12.5);
  // Each tier's wins by the side it played.
  assert.deepEqual(tally.tierSides.medium, { lio: { games: 2, wins: 2 }, sae: { games: 2, wins: 0 } });
});

test("a tier played against itself still tallies per side without a name clash", () => {
  const tally = tallyArena("easy", "easy", [game("lio", "lio"), game("sae", "lio")]);
  assert.equal(tally.sides.lio.wins, 2);
  assert.equal(tally.games, 2);
});

test("an empty run tallies to zero rates, not NaN", () => {
  const tally = tallyArena("medium", "easy", []);
  assert.equal(tally.tiers.medium.winRate, 0);
  assert.equal(tally.averageAnswers, 0);
});

test("the gate passes only above 75%: exactly 75% fails", () => {
  const make = (wins, total) =>
    tallyArena(
      "medium",
      "easy",
      Array.from({ length: total }, (_, i) => game("lio", i < wins ? "lio" : "sae")),
    );
  assert.equal(GATES.length, 2);
  assert.equal(checkGate(make(76, 100)).pass, true);
  assert.equal(checkGate(make(75, 100)).pass, false);
  const result = checkGate(make(90, 100));
  assert.match(result.line, /Medium beats Easy in 90\.0% of games \(needs over 75%\): PASS/);
});

test("the gate follows the pairing, not the order, and does not apply to other pairings", () => {
  // Easy on LIO, SAE (Medium) wins.
  assert.equal(checkGate(tallyArena("easy", "medium", [game("lio", "sae")])).pass, true);
  assert.equal(checkGate(tallyArena("easy", "easy", [game("lio", "lio")])), null);
});

test("parseArgs: defaults, tiers, games, seed, json, and refusals with the usage line", () => {
  assert.deepEqual(parseArgs([]), {
    a: "medium",
    b: "easy",
    games: 100,
    seed: "arena",
    scenario: "six-region",
    json: false,
  });
  const o = parseArgs([
    "--a",
    "easy",
    "--b",
    "medium",
    "--games",
    "20",
    "--seed",
    "x",
    "--scenario",
    "test-map",
    "--json",
  ]);
  assert.deepEqual(o, { a: "easy", b: "medium", games: 20, seed: "x", scenario: "test-map", json: true });
  assert.throws(() => parseArgs(["--a", "expert"]), /--a must be one of easy, medium, hard, not "expert"[\s\S]*Usage:/);
  assert.throws(() => parseArgs(["--games", "0"]), /--games must be a positive whole number/);
  assert.throws(() => parseArgs(["--nope"]), /Unknown argument/);
  assert.throws(() => parseArgs(["--b"]), /--b needs a value/);
});

test("a real seeded run alternates sides, is repeatable, and its report names tiers, sides and the gate", () => {
  const options = { a: "medium", b: "easy", games: 4, seed: "arena-test", scenario: "test-map" };
  const run = runArena(options);
  assert.deepEqual(run, runArena(options));
  assert.equal(run.tally.games, 4);
  assert.deepEqual(
    run.results.map((r) => r.aSide),
    ["lio", "sae", "lio", "sae"],
  );
  const text = formatArena(run);
  assert.match(text, /Arena: medium vs easy, 4 games/);
  assert.match(text, /medium: \d+ wins/);
  assert.match(text, /easy: \d+ wins/);
  assert.match(text, /LIO: \d+ wins/);
  assert.match(text, /SAE: \d+ wins/);
  assert.match(text, /Gate: Medium beats Easy/);
  assert.match(text, /Gate: no tier loses to its own Escalation crisis \(games lost that way: Medium \d+, Easy \d+\)/);
});

test("Decision 8 gate: Medium beats Easy in over 75% of 40 seeded six-region games", () => {
  const run = runArena({ a: "medium", b: "easy", games: 40, seed: "arena-gate", scenario: "six-region" });
  assert.equal(run.gate.pass, true, run.gate.line);
});

test("Hard against Medium is held to the Hard-beats-Medium gate: over 65%, exactly 65% fails", () => {
  const make = (wins, total) =>
    tallyArena(
      "hard",
      "medium",
      Array.from({ length: total }, (_, i) => game("lio", i < wins ? "lio" : "sae")),
    );
  assert.equal(checkGate(make(66, 100)).pass, true);
  assert.equal(checkGate(make(65, 100)).pass, false);
  assert.match(checkGate(make(70, 100)).line, /Hard beats Medium in 70\.0% of games \(needs over 65%\): PASS/);
  assert.equal(checkGate(tallyArena("hard", "easy", [game("lio", "lio")])), null);
});

// Decision 8's third gate (#695): no tier loses a game to its own Escalation crisis. Hand-made public events: a crisis
// by `side` costing `value`, then the score move it made.
const crisis = (side, value, from, to) => [
  { kind: "escalationCrisis", side, value },
  { kind: "scoreChanged", from, to },
];
const over = (winner, reason) => ({ kind: "over", winner, reason });

test("a game lost at the track's end by the loser's own crisis counts against the loser", () => {
  // SAE's crisis moves the score toward LIO, to the track's end: LIO wins, SAE blundered.
  const events = [{ kind: "scoreChanged", from: 0, to: -15 }, ...crisis("sae", 3, -15, -18)];
  assert.equal(ownBlunder(over("lio", "trackEnd"), events, -18), "sae");
});

test("a game lost at the turn limit counts when the loser's own crises cost at least the final margin", () => {
  // LIO won by 2; SAE's own crises cost 2 (1 + 1), so without them it would have been even.
  const events = [...crisis("sae", 1, 0, -1), { kind: "scoreChanged", from: -1, to: 1 }, ...crisis("sae", 1, 1, 0)];
  assert.equal(ownBlunder(over("lio", "turnLimitReached"), events, -2), "sae");
});

test("a game lost to the rival's crisis does not count", () => {
  // SAE won; the only crisis was SAE's own (it cost SAE 2), so LIO, the loser, made none.
  assert.equal(ownBlunder(over("sae", "turnLimitReached"), crisis("sae", 2, 6, 4), 4), null);
  const events = [...crisis("sae", 2, 10, 8), { kind: "scoreChanged", from: 8, to: 18 }];
  assert.equal(ownBlunder(over("sae", "trackEnd"), events, 18), null);
});

test("a game where the loser's crisis cost less than the final margin does not count", () => {
  assert.equal(ownBlunder(over("lio", "turnLimitReached"), crisis("sae", 1, 0, -1), -4), null);
  // At the track's end, an earlier crisis does not count when the last move was not a crisis.
  const events = [...crisis("sae", 3, -10, -13), { kind: "scoreChanged", from: -13, to: -18 }];
  assert.equal(ownBlunder(over("lio", "trackEnd"), events, -18), null);
});

test("draws, resignations and timeouts never count as a blunder", () => {
  const events = crisis("sae", 5, 0, -5);
  assert.equal(ownBlunder({ kind: "over", winner: null, reason: "turnLimitReached" }, events, 0), null);
  assert.equal(ownBlunder(over("lio", "resigned"), events, -5), null);
  assert.equal(ownBlunder(over("lio", "timeout"), events, -5), null);
});

test("the tally counts each tier's games lost to its own crisis, by the side it sat on", () => {
  const tally = tallyArena("medium", "easy", [
    game("lio", "lio", 10, "sae"), // Easy (SAE) lost to its own crisis
    game("sae", "lio", 10, "sae"), // Medium (SAE) lost to its own crisis
    game("lio", "sae", 10, "lio"), // Medium (LIO) lost to its own crisis
    game("lio", "lio"),
  ]);
  assert.deepEqual(tally.blunders, { medium: 2, easy: 1 });
  assert.deepEqual(tallyArena("easy", "easy", [game("lio", "lio", 10, "sae")]).blunders, { easy: 1 });
});

test("one game a tier lost to its own crisis fails the run, and the report prints the count per tier", () => {
  const clean = tallyArena("medium", "easy", [game("lio", "lio"), game("sae", "sae")]);
  assert.equal(checkBlunders(clean).pass, true);
  const one = tallyArena("medium", "easy", [game("lio", "lio"), game("sae", "lio", 10, "sae")]);
  const result = checkBlunders(one);
  assert.equal(result.pass, false);
  assert.match(result.line, /games lost that way: Medium 1, Easy 0\): FAIL/);
  assert.equal(checkBlunders(tallyArena("medium", "easy", [])), null);
  const text = formatArena({
    a: "medium",
    b: "easy",
    seed: "s",
    scenario: "test-map",
    tally: one,
    gate: checkGate(one),
    blunderGate: result,
  });
  assert.match(text, /Medium 1, Easy 0\): FAIL/);
});
