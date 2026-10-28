// The score numbers from hand-made summaries (swing, how games end, deciding region), then real games end to end
// with a numbers file that gives the six-region map its scoring (X13, #446).
import { test } from "node:test";
import assert from "node:assert/strict";
import { balanceConfig } from "./config.mjs";
import { numbersError, applyNumbers } from "./numbers.mjs";
import { scenarioConfig } from "./config.mjs";
import { playBalanceGame } from "./play.mjs";
import { howEnded, scoreNumbers, scoreSummary } from "./score-stats.mjs";
import { runBalance } from "./run.mjs";
import { formatText } from "./report.mjs";

const row = (era, region, lio, sae) => ({ era, region, lio, sae });
const over = (winner, reason) => ({ kind: "over", winner, reason });

test("a game ends by a track end, ahead after the last era, or on an even track", () => {
  assert.equal(howEnded(over("sae", "trackEnd")), "trackEnd");
  assert.equal(howEnded(over("lio", "turnLimitReached")), "ahead");
  assert.equal(howEnded(over(null, "turnLimitReached")), "even");
});

test("a game with no score track has no score numbers", () => {
  assert.equal(scoreSummary(undefined, undefined, over(null, "turnLimitReached"), []), null);
  assert.equal(scoreNumbers([{ score: null }, {}]), undefined);
});

test("the deciding region: the one that crossed the end, else the largest swing towards the winner", () => {
  const rows = [row("e1", "x", 0, 3), row("e1", "y", 4, 0), row("e2", "x", 0, 2), row("e2", "y", 0, 1)];
  assert.equal(scoreSummary(0, 20, over("sae", "trackEnd"), rows).decider, "y", "the last region that scored");
  assert.equal(scoreSummary(0, 2, over("sae", "turnLimitReached"), rows).decider, "x", "x gave SAE +5, y -3");
  assert.equal(scoreSummary(0, -2, over("lio", "turnLimitReached"), rows).decider, "y", "y gave LIO the most");
  assert.equal(scoreSummary(0, 0, over(null, "turnLimitReached"), rows).decider, null, "an even game has none");
});

test("the report's score numbers: where the track ended, how games ended, swings per era and region", () => {
  const rowsA = [row("e1", "x", 0, 3), row("e1", "y", 4, 0), row("e2", "x", 0, 2)];
  const rowsB = [row("e1", "x", 1, 0), row("e1", "y", 0, 0)];
  const games = [
    { score: scoreSummary(0, 20, over("sae", "trackEnd"), rowsA) },
    { score: scoreSummary(0, -1, over("lio", "turnLimitReached"), rowsB) },
    { score: scoreSummary(0, 0, over(null, "turnLimitReached"), []) },
  ];
  const n = scoreNumbers(games);
  assert.equal(n.games, 3);
  assert.deepEqual(n.final, { average: 6.33, min: -1, max: 20 });
  assert.equal(n.results.trackEnd.sae, 1);
  assert.equal(n.results.ahead.lio, 1);
  assert.deepEqual(n.results.even, { games: 1, share: 0.333 });
  assert.deepEqual(n.perEra, [
    { era: "e1", games: 2, lio: 2.5, sae: 1.5, swing: -1 },
    { era: "e2", games: 1, lio: 0, sae: 2, swing: 2 },
  ]);
  const x = n.perRegion.find((r) => r.region === "x");
  assert.deepEqual(x, { region: "x", games: 2, lio: 0.5, sae: 2.5, swing: 2, decided: 2, decidedShare: 0.667 });
  assert.equal(n.perRegion.find((r) => r.region === "y").decided, 0);
});

const scoring = (end, start, amounts) => ({
  track: { end, start },
  regions: scenarioConfig("six-region").setup.map.regions.map((r) => ({ region: r.id, ...amounts })),
});
const FLAT = { present: 1, ahead: 3, all: 5 };
const RUN = { scenario: "six-region", turns: 10, plays: 2, eras: { "era-2": 4, "era-3": 6, future: null } };
/** The six-region config with its map's own scoring (R24, #458) taken off, for the no-scoring cases. */
function unscored(config) {
  const map = { ...config.setup.map };
  delete map.scoring;
  return { ...config, setup: { ...config.setup, map } };
}

test("numbers can give the map scoring, and refuse scoring that does not fit", () => {
  const map = scenarioConfig("six-region").setup.map;
  assert.notDeepEqual(map.scoring, scoring(20, 0, FLAT), "the scenario's own scoring is not the one given");
  const applied = applyNumbers(scenarioConfig("six-region"), { scoring: scoring(20, 0, FLAT) }).setup.map;
  assert.deepEqual(applied.scoring, scoring(20, 0, FLAT));
  const one = scoring(20, 0, FLAT);
  const cases = [
    [{ scoring: 3 }, /must be \{ track, regions \}/],
    [{ scoring: { ...scoring(20, 0, FLAT), extra: 1 } }, /another key "extra"/],
    [{ scoring: scoring(0, 0, FLAT) }, /track \{ end, start \}/],
    [{ scoring: scoring(20, 20, FLAT) }, /strictly between/],
    [{ scoring: { ...one, regions: one.regions.slice(1) } }, /does not name region eastern-europe-central-asia/],
    [{ scoring: { ...one, regions: [...one.regions, one.regions[0]] } }, /twice/],
    [{ scoring: { ...one, regions: [{ ...one.regions[0], region: "mars" }] } }, /unknown region "mars"/],
    [{ scoring: scoring(20, 0, { present: -1, ahead: 3, all: 5 }) }, /present amount .* whole number from 0 up/],
  ];
  for (const [numbers, reason] of cases) assert.match(numbersError(numbers, map) ?? "fits", reason);
});

test("a real scored game ends with a track position, and its regions' points add up to the track's moves", () => {
  const config = balanceConfig({ ...RUN, numbers: { scoring: scoring(20, 0, FLAT) } });
  const game = playBalanceGame("x13", 0, config);
  assert.notEqual(game.score, null);
  assert.equal(game.score.start, 0);
  assert.ok(game.score.rows.length > 0 && game.score.rows.length <= 18, "6 regions in at most 3 eras");
  assert.deepEqual(
    [...new Set(game.score.rows.map((r) => r.era))].slice(0, 1),
    ["era-1"],
    "the first scoring is era-1's",
  );
  const eras = game.score.rows.map((r) => r.era);
  const order = [...new Set(eras)];
  assert.deepEqual(order, ["era-1", "era-2", "era-3"].slice(0, order.length), "eras come in order, none skipped");
  for (const era of order) assert.ok(eras.filter((e) => e === era).length <= 6, `${era} scores each region once`);
  const moved = game.score.rows.reduce((n, r) => n + r.sae - r.lio, 0);
  if (game.score.how !== "trackEnd") assert.equal(game.score.final, moved, "no clamping, so the points add up");
  assert.equal(
    playBalanceGame("x13", 0, unscored(scenarioConfig("six-region"))).score,
    null,
    "no scoring, no score numbers",
  );
});

test("a run with scoring reports the score section, the text and the JSON from the same numbers", () => {
  const stats = runBalance({ ...RUN, games: 6, seed: "x13", numbers: { scoring: scoring(20, 0, FLAT) } });
  assert.equal(stats.score.games, 6);
  const { trackEnd, ahead, even } = stats.score.results;
  assert.equal(trackEnd.games + ahead.games + even.games, 6);
  const text = formatText(stats, "T");
  assert.match(text, /Score track \(positive favours SAE; starts at 0\)/);
  assert.match(text, /Score per era/);
  assert.match(text, /Score per region[\s\S]*decided share/);
  const plain = runBalance({ ...RUN, scenario: "first-deck", games: 2, seed: "x13" });
  assert.equal(plain.score, undefined);
  assert.doesNotMatch(formatText(plain, "T"), /Score track/);
});
