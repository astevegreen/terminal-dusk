// The "By era" numbers from hand-made game summaries: distinct cards used per game, their share of the era, and
// picks plus plays per game, including a card both sides used in one game and a left-out era.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatText } from "./report.mjs";
import { balanceStats } from "./stats.mjs";

const pick = (side, card) => ({ decisionId: "d", side, value: { kind: "chooseCard", card } });
const play = (side, card, as) => ({ decisionId: "d", side, value: { kind: "playCardAs", card, as } });
const draw = (log) => ({
  status: { kind: "over", winner: null, reason: "turnLimitReached" },
  answers: log.length,
  log,
});

// Era "one" has 4 cards, era "two" 3, era "gone" is left out.
const ERAS = [
  { era: "one", cards: ["a", "b", "c", "d"] },
  { era: "two", cards: ["x", "y", "z"] },
  { era: "gone", cards: null },
];
// Game 1: both sides use "a" (counted once), LIO uses "b"; SAE uses "x". Game 2: only "a", by SAE.
const SUMMARIES = [
  draw([pick("lio", "a"), pick("sae", "a"), play("lio", "a", "event"), play("lio", "b", "points"), pick("sae", "x")]),
  draw([pick("sae", "a"), { decisionId: "y", side: "lio", value: { kind: "yesNo", yes: true } }]),
];
const era = (stats, id) => stats.byEra.find((e) => e.era === id);

test("a card both sides used in one game counts once among the distinct cards used", () => {
  const one = era(balanceStats(SUMMARIES, { eras: ERAS }), "one");
  // Game 1: a and b (2 distinct); game 2: a (1). Average 1.5 of 4 cards.
  assert.deepEqual(one, {
    era: "one",
    leftOut: false,
    cards: 4,
    averageCardsUsed: 1.5,
    shareUsed: 0.375,
    averageUses: 2.5,
  });
});

test("picks plus plays per game of an era's cards, and an era nobody used", () => {
  const stats = balanceStats(SUMMARIES, { eras: ERAS });
  assert.deepEqual(era(stats, "two"), {
    era: "two",
    leftOut: false,
    cards: 3,
    averageCardsUsed: 0.5,
    shareUsed: 0.167,
    averageUses: 0.5,
  });
  const unused = balanceStats([draw([])], { eras: ERAS });
  assert.deepEqual(era(unused, "two"), {
    era: "two",
    leftOut: false,
    cards: 3,
    averageCardsUsed: 0,
    shareUsed: 0,
    averageUses: 0,
  });
});

test("a left-out era is listed as left out with no numbers", () => {
  const stats = balanceStats(SUMMARIES, { eras: ERAS });
  assert.deepEqual(era(stats, "gone"), { era: "gone", leftOut: true });
  assert.deepEqual(
    stats.byEra.map((e) => e.era),
    ["one", "two", "gone"],
  );
  const row = formatText(stats)
    .split("\n")
    .find((l) => l.startsWith("gone "));
  assert.deepEqual(row.split(/\s{2,}/), ["gone", "left out"]);
});

test("no games and an era with no cards give no division by zero", () => {
  const stats = balanceStats([], { eras: [{ era: "empty", cards: [] }, ...ERAS] });
  assert.deepEqual(era(stats, "empty"), {
    era: "empty",
    leftOut: false,
    cards: 0,
    averageCardsUsed: 0,
    shareUsed: null,
    averageUses: 0,
  });
  assert.equal(era(stats, "one").shareUsed, 0);
  assert.doesNotMatch(formatText(stats), /NaN|Infinity/);
});

test("the By era section appears in the text only when era information is given", () => {
  assert.equal("byEra" in balanceStats(SUMMARIES), false);
  assert.doesNotMatch(formatText(balanceStats(SUMMARIES)), /By era/);
  const text = formatText(balanceStats(SUMMARIES, { eras: ERAS }));
  assert.match(text, /\nBy era /);
  const row = text.split("\n").find((l) => l.startsWith("one "));
  assert.deepEqual(row.split(/\s{2,}/), ["one", "4", "1.5", "0.375", "2.5"]);
});
