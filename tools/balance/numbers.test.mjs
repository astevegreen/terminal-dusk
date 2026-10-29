// The --numbers option (X12, #438): a numbers file's stabilities, battleground lists and starting influence laid
// over a map scenario for one run, its refusals, and the six-region scenario it is meant for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SIX_REGION_MAP_SCENARIO } from "@terminal-dusk/content";
import { balanceConfig, eraIdsOf, scenarioConfig } from "./config.mjs";
import { applyNumbers, numbersError, readNumbers } from "./numbers.mjs";
import { playBalanceGame } from "./play.mjs";
import { parseArgs, runBalance } from "./run.mjs";

const balance = (...args) =>
  spawnSync(process.execPath, [path.join(import.meta.dirname, "run.mjs"), ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
const SIX = ["--scenario", "six-region"];
const PROPOSALS = path.join(import.meta.dirname, "..", "..", "docs", "proposals", "map-numbers");
const BALANCE_PROPOSALS = path.join(import.meta.dirname, "..", "..", "docs", "proposals", "map-balance");
const sixMap = () => scenarioConfig("six-region").setup.map;
const stabilityOf = (map, id) => map.countries.find((c) => c.id === id).stability;
const listOf = (map, era) => map.battlegrounds.find((list) => list.era === era).countries;
const tempFile = (content) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "td-numbers-")), "numbers.json");
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
  return file;
};

test("--scenario six-region plays the six-region map with the first deck's eras", () => {
  const config = balanceConfig({ scenario: "six-region" });
  assert.equal(config.setup.map.countries.length, SIX_REGION_MAP_SCENARIO.map.countries.length);
  assert.equal(config.setup.map.regions.length, 6);
  assert.deepEqual(eraIdsOf("six-region"), eraIdsOf("first-deck"));
  const game = playBalanceGame("six", 0, config);
  assert.equal(game.status.kind, "over");
  assert.notEqual(game.map, null);
  // One era end per era played: era-1, era-2, era-3 and the future era, in order.
  assert.deepEqual(
    game.eraEnds.map((end) => end.era),
    eraIdsOf("six-region"),
  );
  assert.deepEqual(playBalanceGame("six", 0).eraEnds, [], "the first-deck game has no map, so no era ends");
});

test("numbers replace the named stabilities, the named eras' lists and the whole starting influence only", () => {
  const before = scenarioConfig("six-region");
  const copy = structuredClone(before);
  const numbers = {
    stability: { taiwan: 4, crimea: 3 },
    battlegrounds: { "era-2": ["taiwan", "crimea"] },
    startingInfluence: [{ country: "taiwan", lio: 2, sae: 0 }],
  };
  const after = applyNumbers(before, numbers).setup.map;
  assert.equal(stabilityOf(after, "taiwan"), 4);
  assert.equal(stabilityOf(after, "crimea"), 3);
  assert.equal(stabilityOf(after, "japan"), stabilityOf(before.setup.map, "japan"), "not named, kept");
  assert.deepEqual(listOf(after, "era-2"), ["taiwan", "crimea"]);
  assert.deepEqual(listOf(after, "era-1"), listOf(before.setup.map, "era-1"), "not named, kept");
  assert.deepEqual(after.startingInfluence, [{ country: "taiwan", lio: 2, sae: 0 }]);
  assert.deepEqual(before, copy, "the scenario's own config is not changed");
  assert.deepEqual(applyNumbers(before, {}).setup.map, before.setup.map, "an empty file changes nothing");
});

test("numbers that do not fit the map are refused with the reason", () => {
  const map = sixMap();
  const cases = [
    [[], /one JSON object/],
    [{ colour: "red" }, /Unknown key "colour"/],
    [{ name: 3 }, /"name" must be text/],
    [{ stability: { atlantis: 2 } }, /unknown country "atlantis"/],
    [{ stability: { taiwan: 0 } }, /taiwan must be a whole number from 1 up, not 0/],
    [{ stability: { taiwan: 2.5 } }, /whole number/],
    [{ battlegrounds: { "era-9": [] } }, /era era-9, which the map has no list for/],
    [{ battlegrounds: { "era-1": "taiwan" } }, /must be a list/],
    [{ battlegrounds: { "era-1": ["taiwan", "taiwan"] } }, /name a country twice/],
    [{ battlegrounds: { "era-1": ["atlantis"] } }, /unknown country "atlantis"/],
    [{ startingInfluence: {} }, /must be a list/],
    [{ startingInfluence: [{ country: "atlantis", lio: 1, sae: 0 }] }, /unknown country "atlantis"/],
    [{ startingInfluence: [{ country: "taiwan", lio: -1, sae: 0 }] }, /whole numbers from 0 up/],
    [
      {
        startingInfluence: [
          { country: "taiwan", lio: 1, sae: 0 },
          { country: "taiwan", lio: 2, sae: 0 },
        ],
      },
      /names taiwan twice/,
    ],
  ];
  for (const [numbers, reason] of cases) {
    assert.match(numbersError(numbers, map) ?? "fits", reason, JSON.stringify(numbers));
    assert.throws(() => applyNumbers(scenarioConfig("six-region"), numbers), /^Error: --numbers: /);
  }
  assert.equal(numbersError({ name: "ok", stability: { taiwan: 3 } }, map), null);
  assert.throws(() => applyNumbers(scenarioConfig("first-deck"), {}), /needs a scenario with a map/);
});

test("--numbers reads a file, names it in the heading, and changes the games; bad files exit with an error", () => {
  const file = tempFile({
    name: "all stable",
    stability: Object.fromEntries(sixMap().countries.map((c) => [c.id, 5])),
  });
  const args = [...SIX, "--games", "2", "--seed", "num"];
  const plain = balance(...args);
  const withNumbers = balance(...args, "--numbers", file);
  assert.equal(withNumbers.status, 0, withNumbers.stderr);
  assert.match(
    withNumbers.stdout.split("\n")[0],
    /six-region map with the first deck .*, numbers "all stable", base seed/,
  );
  assert.match(plain.stdout.split("\n")[0], /^Balance report, six-region map with the first deck \(a smoke check/);
  assert.notEqual(withNumbers.stdout, plain.stdout);
  assert.equal(parseArgs([...SIX, "--numbers", file]).numbersFile, file);
  // Refusals: no map scenario, a missing file, a file that is not JSON, numbers that do not fit.
  assert.throws(() => parseArgs(["--numbers", file]), /--numbers needs a scenario with a map[\s\S]*Usage/);
  const missing = balance(...args, "--numbers", path.join(tmpdir(), "td-no-such-numbers.json"));
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--numbers cannot read/);
  assert.throws(() => readNumbers(tempFile("{ not json")), /is not JSON/);
  const unfit = balance(...args, "--numbers", tempFile({ stability: { atlantis: 2 } }));
  assert.equal(unfit.status, 1);
  assert.match(unfit.stderr, /--numbers: "stability" names unknown country "atlantis"/);
  assert.equal(unfit.stdout, "");
});

test("the six-region report adds the era-end region levels, the same numbers as the JSON", () => {
  const options = { scenario: "six-region", games: 2, seed: "ends" };
  const stats = runBalance(options);
  assert.deepEqual(
    stats.eraEnds.map((row) => row.era),
    eraIdsOf("six-region"),
  );
  const text = balance(...SIX, "--games", "2", "--seed", "ends").stdout.split("\n");
  const at = text.findIndex((line) => line.startsWith("Era ends, per side"));
  assert.ok(at > 0);
  assert.match(text[at], /section is control only: amounts and the score are in the Score section/);
  const lio = stats.eraEnds[0].lio;
  const expected = ["era-1", "LIO", lio.countries, lio.battlegrounds, ...Object.values(lio.levels)].map(String);
  assert.deepEqual(text[at + 2].split(/\s{2,}/), expected);
  assert.equal("eraEnds" in runBalance({ games: 1, seed: "plain" }), false, "the first deck has no era ends");
});

test("every proposal numbers file in docs/proposals/map-numbers fits the six-region map and plays", () => {
  const files = readdirSync(PROPOSALS).filter((name) => name.endsWith(".json"));
  assert.ok(files.length >= 2, "the proposal has at least two options' numbers");
  for (const name of files) {
    const numbers = JSON.parse(readFileSync(path.join(PROPOSALS, name), "utf8"));
    assert.equal(numbersError(numbers, sixMap()), null, name);
    const config = balanceConfig({ scenario: "six-region", numbers });
    assert.equal(playBalanceGame(name, 0, config).status.kind, "over", name);
  }
});

// X15 (issue #472): the balance pass's option and variant files must keep loading as the map changes.
test("every numbers file in docs/proposals/map-balance fits the six-region map and plays", () => {
  const files = readdirSync(BALANCE_PROPOSALS).filter((name) => name.endsWith(".json"));
  assert.ok(files.length >= 5, "three options and two variants");
  for (const name of files) {
    const numbers = JSON.parse(readFileSync(path.join(BALANCE_PROPOSALS, name), "utf8"));
    assert.equal(numbersError(numbers, sixMap()), null, name);
    const config = balanceConfig({ scenario: "six-region", numbers });
    assert.equal(playBalanceGame(name, 0, config).status.kind, "over", name);
  }
});
