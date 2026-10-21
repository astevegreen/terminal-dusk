// The balance report's numbers, worked out from finished games only. A pure function: no games are played here,
// so tests can feed it hand-made summaries. A summary is one game: { status, answers, log }, where `status` is the
// final GameStatus, `answers` the number of answers given and `log` the answers (each with its side), oldest first.

export const SIDES = ["lio", "sae"];
export const NO_WINNER_LINE =
  "Every game ended with no winner (there is no victory rule yet), so win shares are left out.";

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
const emptySide = () => ({ picks: 0, event: 0, points: 0, gamesPlayedIn: 0, wins: 0 });

/**
 * The report for `summaries`. `cards` lists card ids to report even if nobody touched them; every card in a log
 * is reported too, in the order first met. `nameOf(id)` gives a card's name.
 */
export function balanceStats(summaries, { cards = [], nameOf = (id) => id } = {}) {
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
  };
}

function sideNumbers({ picks, event, points, gamesPlayedIn, wins }) {
  const winShare = gamesPlayedIn === 0 ? null : round(wins / gamesPlayedIn, 3);
  return { picks, event, points, gamesPlayedIn, winShare };
}
