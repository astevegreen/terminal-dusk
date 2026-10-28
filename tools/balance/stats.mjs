// The balance report's numbers, worked out from finished games only. A pure function: no games are played here,
// so tests can feed it hand-made summaries. A summary is one game: { status, answers, log }, where `status` is the
// final GameStatus, `answers` the number of answers given and `log` the answers (each with its side), oldest first.
// A summary may also carry `map` (map-stats.mjs): when any game does, the report adds the map numbers under `map`.
// And `eraEnds` (region-stats.mjs): when any game has one, the report adds the region levels under `eraEnds`.
// And `score` (score-stats.mjs): when any game has a score track, the report adds the score numbers under `score`.
import { mapNumbers } from "./map-stats.mjs";
import { eraEndNumbers } from "./region-stats.mjs";
import { scoreNumbers } from "./score-stats.mjs";

export const SIDES = ["lio", "sae"];
export const NO_WINNER_LINE =
  "Every game ended with no winner (there is no victory rule yet), so win shares are left out.";

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
const emptySide = () => ({ picks: 0, event: 0, points: 0, gamesPlayedIn: 0, wins: 0 });

/**
 * The report for `summaries`. `cards` lists card ids to report even if nobody touched them; every card in a log
 * is reported too, in the order first met. `nameOf(id)` gives a card's name. `eras` (optional, see eraNumbers)
 * adds the "By era" numbers under `byEra`; without it the report has no such key.
 */
export function balanceStats(summaries, { cards = [], nameOf = (id) => id, eras } = {}) {
  const sides = Object.fromEntries(SIDES.map((s) => [s, { wins: 0, losses: 0, draws: 0, reasons: {} }]));
  const perCard = new Map(cards.map((id) => [id, { lio: emptySide(), sae: emptySide() }]));
  const cardFor = (id) => {
    if (!perCard.has(id)) perCard.set(id, { lio: emptySide(), sae: emptySide() });
    return perCard.get(id);
  };
  let answers = 0;
  for (const game of summaries) {
    const { winner, reason } = game.status;
    answers += game.answers;
    for (const side of SIDES) {
      const result = sides[side];
      if (winner === null) result.draws += 1;
      else if (winner === side) result.wins += 1;
      else result.losses += 1;
      result.reasons[reason] = (result.reasons[reason] ?? 0) + 1;
    }
    const touched = new Set();
    for (const answer of game.log) {
      const value = answer.value;
      if (value?.kind !== "chooseCard" && value?.kind !== "playCardAs") continue;
      const counts = cardFor(value.card)[answer.side];
      if (value.kind === "chooseCard") counts.picks += 1;
      else counts[value.as] += 1;
      touched.add(`${answer.side} ${value.card}`);
    }
    for (const key of touched) {
      const [side, card] = key.split(" ");
      const counts = cardFor(card)[side];
      counts.gamesPlayedIn += 1;
      if (winner === side) counts.wins += 1;
    }
  }
  const games = summaries.length;
  const map = mapNumbers(summaries);
  const eraEnds = eraEndNumbers(summaries);
  const score = scoreNumbers(summaries);
  return {
    games,
    averageAnswers: games === 0 ? 0 : round(answers / games, 2),
    noWinner: summaries.every((g) => g.status.winner === null),
    sides,
    cards: [...perCard].map(([id, bySide]) => ({
      id,
      name: nameOf(id),
      ...Object.fromEntries(SIDES.map((s) => [s, sideNumbers(bySide[s])])),
    })),
    ...(eras === undefined ? {} : { byEra: eraNumbers(summaries, eras) }),
    ...(map === undefined ? {} : { map }),
    ...(eraEnds === undefined ? {} : { eraEnds }),
    ...(score === undefined ? {} : { score }),
  };
}

/**
 * The "By era" numbers. `eras` lists each era as { era, cards }, where `cards` is its card ids (from the ruleset's
 * `card.era`) or null when the run leaves it out. Per era: its number of cards, the average per game of distinct
 * cards of that era picked or played by either side (a card both sides used in one game counts once), that as a
 * share of the era's cards, and the average picks plus plays per game of its cards.
 */
function eraNumbers(summaries, eras) {
  const games = summaries.length;
  const average = (n, places) => (games === 0 ? 0 : round(n / games, places));
  return eras.map(({ era, cards }) => {
    if (cards === null) return { era, leftOut: true };
    const ofEra = new Set(cards);
    let distinct = 0;
    let uses = 0;
    for (const game of summaries) {
      const used = new Set();
      for (const { value } of game.log) {
        if (value?.kind !== "chooseCard" && value?.kind !== "playCardAs") continue;
        if (!ofEra.has(value.card)) continue;
        uses += 1;
        used.add(value.card);
      }
      distinct += used.size;
    }
    const shareUsed = ofEra.size === 0 ? null : round(games === 0 ? 0 : distinct / games / ofEra.size, 3);
    return {
      era,
      leftOut: false,
      cards: ofEra.size,
      averageCardsUsed: average(distinct, 2),
      shareUsed,
      averageUses: average(uses, 2),
    };
  });
}

function sideNumbers({ picks, event, points, gamesPlayedIn, wins }) {
  const winShare = gamesPlayedIn === 0 ? null : round(wins / gamesPlayedIn, 3);
  return { picks, event, points, gamesPlayedIn, winShare };
}
