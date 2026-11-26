// The 2025-2027 game scores Era 3 once, from the map's "future" battleground list (#601): a balance run may not
// leave that list different from Era 3's (--numbers), nor bring the future cards in over another era (--era).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { balanceConfig, scenarioConfig, setupNumbers } from "./config.mjs";
import { playBalanceGame } from "./play.mjs";
import { parseArgs } from "./run.mjs";

const SCENARIO = "2025-2027";
const balance = (...args) =>
  spawnSync(process.execPath, [path.join(import.meta.dirname, "run.mjs"), ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
const era3 = () => scenarioConfig(SCENARIO).setup.map.battlegrounds.find((list) => list.era === "era-3").countries;
const numbersRun = (battlegrounds, scenario = SCENARIO) => balanceConfig({ scenario, numbers: { battlegrounds } });
const eraRun = (...eraValues) => balanceConfig(parseArgs(["--scenario", SCENARIO, ...eraValues]));
const LISTS = /future battlegrounds must be Era 3's/;
const ORDER = /the future cards must join while Era 3 is in play/;

test("on 2025-2027, numbers that change only the future list or only Era 3's are refused", () => {
  const shorter = era3().slice(1);
  assert.throws(() => numbersRun({ future: shorter }), LISTS);
  assert.throws(() => numbersRun({ "era-3": shorter }), LISTS);
  assert.throws(() => numbersRun({ "era-3": shorter, future: era3().slice(2) }), LISTS);
});

test("on 2025-2027, numbers that keep the two lists the same countries play", () => {
  const shorter = era3().slice(1);
  const config = numbersRun({ "era-3": shorter, future: shorter.toReversed() });
  const list = (era) => config.setup.map.battlegrounds.find((b) => b.era === era).countries;
  assert.deepEqual(list("era-3"), shorter);
  assert.deepEqual(list("future"), shorter.toReversed());
  assert.equal(config.matchId, SCENARIO);
  assert.equal(config.setup.turns, 11);
  assert.equal(playBalanceGame("future-numbers", 0, config).status.kind, "over");
  // Naming one list with the countries it already has changes nothing that matters.
  assert.doesNotThrow(() => numbersRun({ future: era3().toReversed() }));
});

test("numbers on 2025-2027 keep the rest of the file's changes, and the run's own options", () => {
  const numbers = { stability: { taiwan: 4 }, startingInfluence: [{ country: "taiwan", lio: 2, sae: 0 }] };
  const config = balanceConfig({ scenario: SCENARIO, numbers, turns: 12 });
  assert.equal(config.setup.map.countries.find((c) => c.id === "taiwan").stability, 4);
  assert.deepEqual(config.setup.map.startingInfluence, numbers.startingInfluence);
  assert.equal(config.setup.turns, 12);
});

test("six-region has no future cards, so its numbers may still change one of the two lists", () => {
  assert.doesNotThrow(() => numbersRun({ future: era3().slice(1) }, "six-region"));
});

test("--numbers that part the two lists exit with the reason and play no game", () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "td-future-")), "numbers.json");
  writeFileSync(file, JSON.stringify({ battlegrounds: { future: era3().slice(1) } }));
  const r = balance("--scenario", SCENARIO, "--games", "1", "--numbers", file);
  assert.equal(r.status, 1);
  assert.match(r.stderr, LISTS);
  assert.equal(r.stdout, "");
});

test("on 2025-2027, the future cards cannot join while an era other than Era 3 is in play", () => {
  // Before Era 3, with Era 3 left out, and with Era 2 moved in between: each would score another era from the list.
  assert.throws(() => eraRun("--era", "future@5"), ORDER);
  assert.throws(() => eraRun("--era", "future@2"), ORDER);
  assert.throws(() => eraRun("--era", "era-3@off"), ORDER);
  assert.throws(() => eraRun("--era", "era-2@8"), ORDER);
  assert.throws(() => eraRun("--era", "era-2@off", "--era", "era-3@off"), ORDER);
});

test("on 2025-2027, the future cards may move within Era 3 or be left out", () => {
  const turns = (...args) => setupNumbers(eraRun(...args), SCENARIO).eras;
  assert.equal(turns("--era", "future@8").future, 8);
  assert.equal(turns("--era", "era-3@9", "--era", "future@10")["era-3"], 9);
  assert.equal(turns("--era", "future@off").future, null);
  assert.deepEqual(turns("--era", "era-3@off", "--era", "future@off"), {
    "era-1": 1,
    "era-2": 4,
    "era-3": null,
    future: null,
  });
  assert.equal(turns("--era", "era-2@off").future, 11);
  assert.equal(playBalanceGame("future-moved", 0, eraRun("--era", "future@8")).status.kind, "over");
});

test("--era that brings the future cards in too early exits with the reason and plays no game", () => {
  const r = balance("--scenario", SCENARIO, "--games", "1", "--era", "future@5");
  assert.equal(r.status, 1);
  assert.match(r.stderr, ORDER);
  assert.equal(r.stdout, "");
});
