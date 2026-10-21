// The report numbers from hand-made game summaries, so wins and win shares can be checked before any victory rule exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatText } from "./report.mjs";
import { NO_WINNER_LINE, balanceStats } from "./stats.mjs";

const pick = (side, card) => ({ decisionId: "d", side, value: { kind: "chooseCard", card } });
const play = (side, card, as) => ({ decisionId: "d", side, value: { kind: "playCardAs", card, as } });
const over = (winner, reason = "test") => ({ kind: "over", winner, reason });

// Game 1: LIO wins; both sides use card "a", LIO twice. Game 2: SAE wins; only SAE uses "a". Game 3: a draw.
const SUMMARIES = [
  {
    status: over("lio"),
    answers: 4,
    log: [pick("lio", "a"), pick("sae", "a"), play("lio", "a", "event"), play("sae", "b", "points")],
  },
  {
    status: over("sae"),
    answers: 2,
    log: [pick("sae", "a"), { decisionId: "y", side: "lio", value: { kind: "yesNo", yes: true } }],
  },
  { status: over(null, "turnLimitReached"), answers: 3, log: [play("lio", "b", "points")] },
];
const card = (stats, id) => stats.cards.find((c) => c.id === id);

test("wins, losses, draws and end reasons per side, and the average answers per game", () => {
  const stats = balanceStats(SUMMARIES);
  assert.deepEqual(stats.sides.lio, { wins: 1, losses: 1, draws: 1, reasons: { test: 2, turnLimitReached: 1 } });
  assert.deepEqual(stats.sides.sae, { wins: 1, losses: 1, draws: 1, reasons: { test: 2, turnLimitReached: 1 } });
  assert.equal(stats.averageAnswers, 3);
  assert.equal(stats.noWinner, false);
});

test("a non-zero win share, for a card both sides played in one game", () => {
  const stats = balanceStats(SUMMARIES);
  // LIO picked and played "a" in game 1 only (counted once as a game) and won it.
  assert.deepEqual(card(stats, "a").lio, { picks: 1, event: 1, points: 0, gamesPlayedIn: 1, winShare: 1 });
  // SAE picked "a" in games 1 (lost) and 2 (won).
  assert.deepEqual(card(stats, "a").sae, { picks: 2, event: 0, points: 0, gamesPlayedIn: 2, winShare: 0.5 });
  // LIO played "b" only in the drawn game 3.
  assert.deepEqual(card(stats, "b").lio, { picks: 0, event: 0, points: 1, gamesPlayedIn: 1, winShare: 0 });
});

test("a card with 0 games played in has win share null in JSON and - in the text", () => {
  const stats = balanceStats(SUMMARIES, { cards: ["z"], nameOf: (id) => `Card ${id}` });
  assert.deepEqual(card(stats, "z").lio, { picks: 0, event: 0, points: 0, gamesPlayedIn: 0, winShare: null });
  assert.equal(JSON.parse(JSON.stringify(stats)).cards[0].lio.winShare, null);
  const row = formatText(stats)
    .split("\n")
    .find((l) => l.startsWith("z "));
  assert.match(row, /Card z/);
  assert.deepEqual(row.split(/\s{2,}/).slice(2), ["0", "0", "0", "0", "-", "0", "0", "0", "0", "-"]);
});

test("every pick and play counts, so a card played twice in a game counts twice", () => {
  const twice = [{ status: over(null), answers: 2, log: [play("sae", "c", "event"), play("sae", "c", "event")] }];
  assert.deepEqual(balanceStats(twice).cards[0].sae, { picks: 0, event: 2, points: 0, gamesPlayedIn: 1, winShare: 0 });
});

test("when no game has a winner, the text says so in one line and prints no win shares", () => {
  const draws = [{ status: over(null, "turnLimitReached"), answers: 1, log: [pick("lio", "a")] }];
  const stats = balanceStats(draws);
  assert.equal(stats.noWinner, true);
  const text = formatText(stats);
  assert.equal(text.split("\n").filter((l) => l === NO_WINNER_LINE).length, 1);
  assert.doesNotMatch(text, /LIO win|SAE win/);
  assert.match(formatText(balanceStats(SUMMARIES)), /LIO win/);
  assert.equal(formatText(balanceStats(SUMMARIES)).includes(NO_WINNER_LINE), false);
});
