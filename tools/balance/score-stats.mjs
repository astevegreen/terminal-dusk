// The score numbers of the balance report, on a map with scoring (R21: docs/design/map-and-points.md, "Scoring").
// One game's numbers come only from the public part of what the host hands out: the score track at the start and at
// the end, the final status, and the regionScored events (what each region gave each side at an era's end). The
// amounts, the bonus per battleground and the clamping are the engine's own; nothing here re-works them.
export const SIDES = ["lio", "sae"];
/** How a game with a map and scoring ended: the track end, the side ahead after the last era, or an even track. */
export const HOWS = ["trackEnd", "ahead", "even"];

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
const average = (values) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);

/** The way a game ended, from its final status: a track end, a winner on the turn limit, or no winner (even). */
export function howEnded(status) {
  if (status.reason === "trackEnd") return "trackEnd";
  return status.winner === null ? "even" : "ahead";
}

/**
 * One game's score numbers, or null when the game has no score track (`start` undefined). `rows` are the game's
 * regionScored events in order, each { era, region, lio, sae }; `status` is the final status. The deciding region is
 * the one that pushed the track over its end (trackEnd), else the one that moved the track most towards the winner
 * over the whole game (the earliest, on a tie); an even game has none.
 */
export function scoreSummary(start, final, status, rows) {
  if (start === undefined || final === undefined) return null;
  const how = howEnded(status);
  let decider = null;
  if (how === "trackEnd") decider = rows.at(-1)?.region ?? null;
  else if (how === "ahead") {
    const towards = new Map();
    for (const row of rows) towards.set(row.region, (towards.get(row.region) ?? 0) + (row.sae - row.lio));
    const sign = status.winner === "sae" ? 1 : -1;
    let best = 0;
    for (const [region, swing] of towards) {
      if (swing * sign > best) {
        best = swing * sign;
        decider = region;
      }
    }
  }
  return { start, final, winner: status.winner, how, decider, rows };
}

/** Rows for one group key: games that scored it, average points each side got and the net swing (SAE minus LIO). */
function swings(summaries, keyOf) {
  const groups = new Map();
  for (const game of summaries) {
    const perGame = new Map();
    for (const row of game.score.rows) {
      const key = keyOf(row);
      const own = perGame.get(key) ?? { lio: 0, sae: 0 };
      own.lio += row.lio;
      own.sae += row.sae;
      perGame.set(key, own);
    }
    for (const [key, own] of perGame) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(own);
    }
  }
  return [...groups].map(([key, list]) => ({
    key,
    games: list.length,
    lio: round(average(list.map((p) => p.lio)), 2),
    sae: round(average(list.map((p) => p.sae)), 2),
    swing: round(average(list.map((p) => p.sae - p.lio)), 2),
  }));
}

/** For each way a game can end: how many games, their share, and each side's wins (none for an even track). */
function resultsByHow(games, share) {
  const results = {};
  for (const how of HOWS) {
    const ofHow = games.filter((g) => g.score.how === how);
    results[how] = { games: ofHow.length, share: share(ofHow.length) };
    if (how === "even") continue;
    for (const side of SIDES) results[how][side] = ofHow.filter((g) => g.score.winner === side).length;
  }
  return results;
}

/** How many games each region decided. */
function decidedCounts(games) {
  const decided = new Map();
  for (const g of games) {
    if (g.score.decider !== null) decided.set(g.score.decider, (decided.get(g.score.decider) ?? 0) + 1);
  }
  return decided;
}

/** The values of `pick(row)` over every scored row, in the order first seen. */
function firstSeen(games, pick) {
  return [...new Set(games.flatMap((g) => g.score.rows.map(pick)))];
}

/**
 * The report's score numbers for `summaries` (each with its `score` from scoreSummary): where the track ended, how
 * games ended and who won, the average swing (SAE points minus LIO points, so positive favours SAE) per era and per
 * region over the games that scored it, and how often each region decided a game. Undefined when no game has a track.
 */
export function scoreNumbers(summaries) {
  const games = summaries.filter((game) => game.score !== null && game.score !== undefined);
  if (games.length === 0) return undefined;
  const n = games.length;
  const share = (count) => round(count / n, 3);
  const finals = games.map((g) => g.score.final);
  const results = resultsByHow(games, share);
  const decided = decidedCounts(games);
  const regionOrder = firstSeen(games, (row) => row.region);
  const eraOrder = firstSeen(games, (row) => row.era);
  const sorted = (rows, order) => order.map((key) => rows.find((r) => r.key === key)).filter(Boolean);
  return {
    games: n,
    start: games[0].score.start,
    final: { average: round(average(finals), 2), min: Math.min(...finals), max: Math.max(...finals) },
    sideWins: Object.fromEntries(SIDES.map((s) => [s, games.filter((g) => g.score.winner === s).length])),
    results,
    perEra: sorted(
      swings(games, (row) => row.era),
      eraOrder,
    ).map(({ key, ...rest }) => ({ era: key, ...rest })),
    perRegion: sorted(
      swings(games, (row) => row.region),
      regionOrder,
    ).map(({ key, ...rest }) => ({
      region: key,
      ...rest,
      decided: decided.get(key) ?? 0,
      decidedShare: share(decided.get(key) ?? 0),
    })),
  };
}
