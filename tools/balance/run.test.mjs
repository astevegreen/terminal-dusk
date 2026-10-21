// Real balance runs: a few first-deck games through the match host, and the command line around them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { playBalanceGame } from "./play.mjs";
import { parseArgs, runBalance } from "./run.mjs";
import { balanceStats } from "./stats.mjs";

const GAMES = 3;
const balance = (...args) =>
  spawnSync(process.execPath, [path.join(import.meta.dirname, "run.mjs"), ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
const summaries = Array.from({ length: GAMES }, (_, i) => playBalanceGame("balance-test", i));

test("a small real run finishes, every game over", () => {
  assert.equal(summaries.length, GAMES);
  for (const game of summaries) {
    assert.equal(game.status.kind, "over");
    assert.equal(game.answers, game.log.length);
  }
});

test("wins + losses + draws = games for each side", () => {
  const stats = runBalance({ games: GAMES, seed: "balance-test" });
  assert.equal(stats.games, GAMES);
  for (const side of ["lio", "sae"]) {
    const r = stats.sides[side];
    assert.equal(r.wins + r.losses + r.draws, GAMES);
    assert.equal(
      Object.values(r.reasons).reduce((a, b) => a + b, 0),
      GAMES,
    );
  }
});

test("per-card pick and play counts equal the chooseCard and playCardAs answers in the logs", () => {
  const stats = balanceStats(summaries);
  const answers = summaries.flatMap((g) => g.log);
  for (const side of ["lio", "sae"]) {
    const mine = answers.filter((a) => a.side === side);
    const total = (key) => stats.cards.reduce((n, c) => n + c[side][key], 0);
    assert.equal(total("picks"), mine.filter((a) => a.value.kind === "chooseCard").length);
    for (const as of ["event", "points"]) {
      assert.equal(total(as), mine.filter((a) => a.value.kind === "playCardAs" && a.value.as === as).length);
    }
  }
  assert.ok(answers.some((a) => a.value.kind === "chooseCard") && answers.some((a) => a.value.kind === "playCardAs"));
});

test("end-reason counts and the average answers per game match the games played", () => {
  const stats = balanceStats(summaries);
  const reasons = {};
  for (const g of summaries) reasons[g.status.reason] = (reasons[g.status.reason] ?? 0) + 1;
  assert.deepEqual(stats.sides.lio.reasons, reasons);
  assert.deepEqual(stats.sides.sae.reasons, reasons);
  const average = summaries.reduce((n, g) => n + g.answers, 0) / GAMES;
  assert.equal(stats.averageAnswers, Math.round(average * 100) / 100);
});

test("the same arguments print the same report", () => {
  const first = balance("--games", String(GAMES), "--seed", "same");
  const second = balance("--games", String(GAMES), "--seed", "same");
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.notEqual(balance("--games", String(GAMES), "--seed", "other").stdout, first.stdout);
});

test("--games 0, and anything but a positive whole number, is refused with the usage line", () => {
  for (const bad of ["0", "-1", "1.5", "two"]) {
    const r = balance("--games", bad);
    assert.equal(r.status, 1, bad);
    assert.match(r.stderr, /Usage: node tools\/balance\/run\.mjs/);
  }
  assert.throws(() => parseArgs(["--games"]), /needs a value/);
  assert.throws(() => parseArgs(["--fast"]), /Unknown argument/);
  assert.deepEqual(parseArgs([]), { games: 200, seed: "balance", json: false });
});

test("--json output parses and has the same numbers as the text report", () => {
  const text = balance("--games", String(GAMES)).stdout;
  const stats = JSON.parse(balance("--games", String(GAMES), "--json").stdout);
  assert.equal(stats.games, GAMES);
  assert.match(text, new RegExp(`: ${GAMES} games\\n`));
  assert.match(text, new RegExp(`Average answers per game: ${stats.averageAnswers}\\n`));
  for (const side of ["lio", "sae"]) {
    const r = stats.sides[side];
    const row = text.split("\n").find((l) => l.startsWith(`${side.toUpperCase()} `));
    assert.deepEqual(row.split(/\s{2,}/).slice(1, 4), [r.wins, r.losses, r.draws].map(String));
  }
  for (const card of stats.cards) {
    const row = text.split("\n").find((l) => l.startsWith(`${card.id} `));
    const cells = row.split(/\s{2,}/);
    assert.equal(cells[1], card.name);
    const expected = ["lio", "sae"].flatMap((s) => [
      card[s].picks,
      card[s].event,
      card[s].points,
      card[s].gamesPlayedIn,
    ]);
    // Today no game has a winner, so the text leaves out the win shares.
    assert.equal(stats.noWinner, true);
    assert.deepEqual(cells.slice(2), expected.map(String));
  }
});

test("the game loop never names the game state or reads it from the secret (hard rule 2)", () => {
  const source = readFileSync(path.join(import.meta.dirname, "play.mjs"), "utf8");
  const code = source
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  assert.doesNotMatch(code, /GameState|\.state\b/);
});
