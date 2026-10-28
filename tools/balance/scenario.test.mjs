// The --scenario option (X11, #331): the first-deck report as it was, the test map run with its map numbers and its
// smoke-check heading, refusals, and a player that throws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { balanceConfig, eraIdsOf, setupNumbers } from "./config.mjs";
import { playBalanceGame } from "./play.mjs";
import { parseArgs, reportTitle, runBalance } from "./run.mjs";

const balance = (...args) =>
  spawnSync(process.execPath, [path.join(import.meta.dirname, "run.mjs"), ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
const fixture = (name) => readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8").replace(/\r\n/g, "\n");
const USAGE_LINE = /Usage: node tools\/balance\/run\.mjs/;
const MAP = ["--scenario", "test-map"];
const SIDES = ["lio", "sae"];
const ACTIONS = ["place", "intervene", "realign"];

test("with no --scenario, or --scenario first-deck, the report is the one the tool printed before this change", () => {
  // Both fixtures were recorded from main before --scenario existed.
  const before = fixture("first-deck-3-games.txt");
  for (const extra of [[], ["--scenario", "first-deck"]]) {
    const r = balance("--games", "3", "--seed", "fixture", ...extra);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, before, extra.join(" "));
  }
  const short = ["--games", "2", "--seed", "fixture", "--turns", "2", "--era", "era-3@off", "--era", "future@off"];
  const json = balance(...short, "--json", "--scenario", "first-deck");
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), JSON.parse(fixture("first-deck-short.json")));
});

test("--scenario test-map plays the games on the test map scenario", () => {
  const config = balanceConfig({ scenario: "test-map" });
  assert.equal(config.setup.map.countries.length, 12);
  assert.equal(config.setup.handSize, 2);
  assert.equal(parseArgs(MAP).scenario, "test-map");
  const game = playBalanceGame("map", 0, config);
  assert.equal(game.status.kind, "over");
  assert.notEqual(game.map, null);
  assert.equal(playBalanceGame("map", 0).map, null, "the first-deck game has no map");
});

test("an unknown --scenario value exits with an error naming the allowed values and plays no game", () => {
  const r = balance("--games", "1", "--scenario", "real-map");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--scenario must be one of first-deck, test-map, six-region, not "real-map"/);
  assert.match(r.stderr, USAGE_LINE);
  assert.equal(r.stdout, "");
  assert.throws(() => parseArgs(["--scenario"]), /needs a value/);
});

test("--turns, --plays and the era options work on the test map, with the test map's own eras", () => {
  assert.deepEqual(eraIdsOf("test-map"), ["era-1"]);
  const options = parseArgs([...MAP, "--games", "2", "--seed", "opts", "--turns", "2", "--plays", "1"]);
  const config = balanceConfig(options);
  assert.deepEqual(setupNumbers(config, "test-map"), { turns: 2, playsPerTurn: 1, eras: { "era-1": 1 } });
  const stats = runBalance(options);
  assert.deepEqual(stats.setup, { turns: 2, playsPerTurn: 1, eras: { "era-1": 1 } });
  assert.equal(stats.sides.lio.reasons.turnLimitReached, 2);
  assert.equal(runBalance({ ...options, turns: 6 }).setup.turns, 6);
  // The test map's hands of 2 hold an opening card and one play, so the host refuses 2 plays, as it would anywhere.
  const twoPlays = balance(...MAP, "--games", "1", "--plays", "2");
  assert.equal(twoPlays.status, 1);
  assert.match(twoPlays.stderr, /invalidSetup/);
  assert.equal(twoPlays.stdout, "");
  // The test map has no later eras: naming one is refused, wherever --scenario stands; era-1 is refused as ever.
  assert.throws(
    () => parseArgs([...MAP, "--era", "era-2@3"]),
    /era-2, which the test-map setup does not have[\s\S]*Usage/,
  );
  assert.throws(() => parseArgs(["--era", "future@off", ...MAP]), /future, which the test-map setup does not have/);
  assert.throws(() => parseArgs([...MAP, "--era", "era-1@2"]), /era-1[\s\S]*Usage/);
  assert.deepEqual(parseArgs(["--era", "era-2@3"]).eras, { "era-2": 3 }, "first-deck keeps its eras");
});

test("the test map run plays only Era 1 cards and lists one card row per Era 1 card", () => {
  const stats = runBalance({ scenario: "test-map", games: 2, seed: "cards" });
  const eraOf = new Map(firstDeckRuleset.cards.map((c) => [c.id, c.era]));
  assert.ok(stats.cards.length > 0);
  assert.ok(stats.cards.every((card) => eraOf.get(card.id) === "era-1"));
  assert.deepEqual(
    stats.byEra.map((e) => e.era),
    ["era-1"],
  );
});

test("on the test map the report adds, per side, influence, countries controlled and points spent per action", () => {
  const options = { scenario: "test-map", games: 3, seed: "map-rows" };
  const config = balanceConfig(options);
  const games = Array.from({ length: 3 }, (_, i) => playBalanceGame(options.seed, i, config));
  const stats = runBalance(options);
  const average = (pick) => Math.round((games.reduce((n, g) => n + pick(g.map), 0) / 3) * 100) / 100;
  for (const side of SIDES) {
    assert.equal(
      stats.map[side].influence,
      average((m) => m[side].influence),
    );
    assert.equal(
      stats.map[side].controlled,
      average((m) => m[side].controlled),
    );
    for (const action of ACTIONS)
      assert.equal(
        stats.map[side].spent[action],
        average((m) => m[side].spent[action]),
      );
    assert.ok(stats.map[side].controlled <= 12);
  }
  // Points went somewhere: across the games both sides spent some on the menu.
  const spent = SIDES.flatMap((s) => ACTIONS.map((a) => stats.map[s].spent[a])).reduce((n, x) => n + x, 0);
  assert.ok(spent > 0);
  assert.ok(stats.map.lio.influence > 0 && stats.map.sae.influence > 0);
});

test("the text report's map rows carry the same numbers as the JSON; with no map the rows are left out", () => {
  const args = [...MAP, "--games", "2", "--seed", "rows"];
  const text = balance(...args).stdout;
  const stats = JSON.parse(balance(...args, "--json").stdout);
  const mapAt = text.split("\n").findIndex((l) => l.startsWith("Map, per side"));
  assert.ok(mapAt > 0);
  const rows = text.split("\n").slice(mapAt + 2, mapAt + 4);
  for (const [k, side] of SIDES.entries()) {
    const m = stats.map[side];
    const expected = [side.toUpperCase(), m.influence, m.controlled, ...ACTIONS.map((a) => m.spent[a])].map(String);
    assert.deepEqual(rows[k].split(/\s{2,}/), expected);
  }
  const plain = JSON.parse(balance("--games", "1", "--json").stdout);
  assert.equal("map" in plain, false);
  assert.doesNotMatch(balance("--games", "1").stdout, /^Map, per side/m);
});

test("with --scenario test-map the heading names the scenario and says it is a test map and a smoke check", () => {
  const first = balance(...MAP, "--games", "1", "--seed", "head").stdout.split("\n")[0];
  assert.match(first, /^Balance report, test-map scenario \(a made-up test map/);
  assert.match(first, /a smoke check, not a verdict on balance/);
  assert.match(first, /base seed "head", 4 turns, 1 play per turn, era-1 on turn 1: 1 games$/);
  const setup = { turns: 4, playsPerTurn: 1, eras: { "era-1": 1 } };
  assert.match(
    reportTitle("first-deck", "s", setup),
    /^Balance report, first deck TEST scenario \(placeholder numbers\)/,
  );
});

test("the same small seeded test-map run twice prints the same report", () => {
  const args = [...MAP, "--games", "3", "--seed", "same-map"];
  const first = balance(...args);
  const second = balance(...args);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.notEqual(balance(...MAP, "--games", "3", "--seed", "other-map").stdout, first.stdout);
});

test("a player that throws on a decision ends the run with that game's error instead of hanging", () => {
  const thrower = () => () => {
    throw new Error("cannot answer this decision");
  };
  assert.throws(
    () => runBalance({ scenario: "test-map", games: 2, seed: "stub" }, { createPlayer: thrower }),
    /^Error: Game 0 \(match seed "stub-0"\): the lio player failed \(cannot answer this decision\) on decision \S+ \(\w+\)$/,
  );
  const silent = () => () => null;
  assert.throws(
    () => playBalanceGame("stub", 1, balanceConfig({ scenario: "test-map" }), { createPlayer: silent }),
    /Game 1 .*the lio player gave no answer to decision/,
  );
});

test("the map numbers read no game state (hard rule 2)", () => {
  for (const file of ["map-stats.mjs", "config.mjs", "run.mjs"]) {
    const code = readFileSync(path.join(import.meta.dirname, file), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    assert.doesNotMatch(code, /GameState|\.state\b/, file);
  }
});
