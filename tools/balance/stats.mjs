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
 * is reported too, in the order first met. `nameOf(id)` gives a card's name. `eras`, when given, adds `byEra`
 * (see eraStats); without it the report is exactly as before.
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
  const report = {
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
  if (eras !== undefined) report.byEra = eraStats(summaries, eras);
  return report;
}

/**
 * Card use per era. `eras` lists each era in report order as { era, cards }, where `cards` holds that era's card
 * ids (from the ruleset), or is null when the run left the era out. For each era in the games: its number of cards,
 * the average per game of distinct cards of the era picked or played by either side (a card both sides used in
 * one game counts once), that as a share of the era's cards (null for an era with no cards), and the average
 * picks plus plays per game of the era's cards. A left-out era gets no numbers.
 */
export function eraStats(summaries, eras) {
  const eraOf = new Map(eras.flatMap(({ era, cards }) => (cards ?? []).map((id) => [id, era])));
  const used = new Map(eras.map(({ era }) => [era, 0]));
  const uses = new Map(eras.map(({ era }) => [era, 0]));
  for (const game of summaries) {
    const touched = new Set();
    for (const { value } of game.log) {
      if (value?.kind !== "chooseCard" && value?.kind !== "playCardAs") continue;
      const era = eraOf.get(value.card);
      if (era === undefined) continue;
      uses.set(era, uses.get(era) + 1);
      touched.add(value.card);
    }
    for (const card of touched) used.set(eraOf.get(card), used.get(eraOf.get(card)) + 1);
  }
  const games = summaries.length;
  const perGame = (n) => (games === 0 ? 0 : n / games);
  return eras.map(({ era, cards }) => {
    if (cards === null) return { era, leftOut: true };
    const average = perGame(used.get(era));
    return {
      era,
      leftOut: false,
      cards: cards.length,
      averageCardsUsed: round(average, 2),
      shareUsed: cards.length === 0 ? null : round(average / cards.length, 3),
      averageUses: round(perGame(uses.get(era)), 2),
    };
  });
}

function sideNumbers({ picks, event, points, gamesPlayedIn, wins }) {
  const winShare = gamesPlayedIn === 0 ? null : round(wins / gamesPlayedIn, 3);
  return { picks, event, points, gamesPlayedIn, winShare };
}
