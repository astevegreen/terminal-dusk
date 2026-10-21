// The run options --turns, --plays and --era: parsing, refusals, the host's own refusals, the report title, and a
// small seeded run with fewer turns and two eras left out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { balanceConfig, setupNumbers } from "./config.mjs";
import { playBalanceGame } from "./play.mjs";
import { parseArgs, runBalance } from "./run.mjs";

const balance = (...args) =>
  spawnSync(process.execPath, [path.join(import.meta.dirname, "run.mjs"), ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
const USAGE_LINE = /Usage: node tools\/balance\/run\.mjs/;
const SHORT = ["--turns", "2", "--era", "era-3@off", "--era", "future@off"];

test("--turns, --plays and --era parse into this run's options", () => {
  assert.deepEqual(parseArgs(["--turns", "6", "--plays", "2"]), {
    games: 200,
    seed: "balance",
    json: false,
    turns: 6,
    plays: 2,
  });
  assert.deepEqual(parseArgs(["--era", "era-2@3", "--era", "future@off"]).eras, { "era-2": 3, future: null });
});

test("--turns and --plays take a whole number, 1 or more", () => {
  for (const option of ["--turns", "--plays"]) {
    for (const bad of ["0", "-1", "1.5", "two"]) {
      assert.throws(() => parseArgs([option, bad]), USAGE_LINE, `${option} ${bad}`);
    }
    assert.throws(() => parseArgs([option]), /needs a value/);
  }
});

test("a malformed --era value is refused with the usage line", () => {
  for (const bad of ["era-2", "era-2@", "era-2@0", "era-2@1.5", "era-2@two", "@3", "era-2@3@4"]) {
    assert.throws(() => parseArgs(["--era", bad]), USAGE_LINE, bad);
  }
  assert.throws(() => parseArgs(["--era"]), /needs a value/);
});

test("a repeated --era for the same era is refused with the usage line", () => {
  assert.throws(() => parseArgs(["--era", "era-2@3", "--era", "era-2@off"]), /more than once[\s\S]*Usage/);
});

test("--era for the first era is refused with the usage line", () => {
  assert.throws(() => parseArgs(["--era", "era-1@2"]), /era-1[\s\S]*Usage/);
  assert.throws(() => parseArgs(["--era", "era-1@off"]), /era-1[\s\S]*Usage/);
});

test("an era id the first-deck setup does not have is refused with the usage line", () => {
  assert.throws(() => parseArgs(["--era", "era-9@3"]), /era-9[\s\S]*Usage/);
});

test("refused options exit with code 1 and play no game", () => {
  const r = balance("--games", "1", "--era", "era-1@2");
  assert.equal(r.status, 1);
  assert.match(r.stderr, USAGE_LINE);
  assert.equal(r.stdout, "");
});

test("a combination the host refuses names the host's error code, without the usage line", () => {
  // An era on turn 1, an era after the last turn (era-3 stays on turn 3), and two eras on one turn.
  for (const args of [
    ["--era", "era-2@1"],
    ["--turns", "2"],
    ["--era", "era-3@2"],
  ]) {
    const r = balance("--games", "1", ...args);
    assert.equal(r.status, 1, args.join(" "));
    assert.match(r.stderr, /invalidSetup/, args.join(" "));
    assert.doesNotMatch(r.stderr, USAGE_LINE, args.join(" "));
    assert.equal(r.stdout, "");
  }
});

test("only the run's config changes: eras not named keep the scenario's turns", () => {
  const numbers = setupNumbers(balanceConfig({ plays: 2, eras: { "era-2": 3, "era-3": 2 } }));
  assert.deepEqual(numbers, {
    turns: 4,
    playsPerTurn: 2,
    eras: { "era-1": 1, "era-2": 3, "era-3": 2, future: 4 },
  });
  assert.deepEqual(setupNumbers(balanceConfig()).eras, { "era-1": 1, "era-2": 2, "era-3": 3, future: 4 });
});

test("the title states the turns, plays per turn and each era's arrival turn; --json has them under setup", () => {
  const text = balance("--games", "1", ...SHORT).stdout;
  assert.match(
    text.split("\n")[0],
    /2 turns, 1 play per turn, era-1 on turn 1, era-2 on turn 2, era-3 left out, future left out: 1 games$/,
  );
  const stats = JSON.parse(balance("--games", "1", "--json", ...SHORT).stdout);
  assert.deepEqual(stats.setup, {
    turns: 2,
    playsPerTurn: 1,
    eras: { "era-1": 1, "era-2": 2, "era-3": null, future: null },
  });
  assert.deepEqual(
    stats.byEra.map((e) => [e.era, e.leftOut]),
    [
      ["era-1", false],
      ["era-2", false],
      ["era-3", true],
      ["future", true],
    ],
  );
});

test("a seeded 2-turn run with era-3 and future left out: every game ends at the turn limit, none of their cards appear", () => {
  const options = parseArgs(["--games", "3", "--seed", "short", ...SHORT]);
  const config = balanceConfig(options);
  const eraOf = new Map(firstDeckRuleset.cards.map((c) => [c.id, c.era]));
  for (let i = 0; i < options.games; i++) {
    const game = playBalanceGame(options.seed, i, config);
    assert.equal(game.status.reason, "turnLimitReached");
    const used = game.log.map((a) => a.value.card).filter((card) => card !== undefined);
    assert.ok(used.length > 0);
    assert.ok(used.every((card) => eraOf.get(card) === "era-1" || eraOf.get(card) === "era-2"));
  }
  const stats = runBalance(options);
  assert.equal(stats.sides.lio.reasons.turnLimitReached, 3);
});
