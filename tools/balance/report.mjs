// The balance report as text: the numbers from stats.mjs laid out as plain tables.
import { ACTIONS } from "./map-stats.mjs";
import { LEVELS } from "./region-stats.mjs";
import { HOWS } from "./score-stats.mjs";
import { NO_WINNER_LINE, SIDES } from "./stats.mjs";

const LABEL = { lio: "LIO", sae: "SAE" };

/** Pads every column of `rows` (arrays of text) to its widest cell, two spaces apart. */
function table(rows) {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => String(r[c]).length)));
  return rows.map((r) =>
    r
      .map((cell, c) => String(cell).padEnd(widths[c]))
      .join("  ")
      .trimEnd(),
  );
}

const share = (winShare) => (winShare === null ? "-" : winShare.toFixed(3));

/** The text report for `stats` (from balanceStats). `title` is its first line. */
export function formatText(stats, title = "Balance report") {
  const lines = [`${title}: ${stats.games} games`, `Average answers per game: ${stats.averageAnswers}`, ""];
  lines.push("Results by side");
  lines.push(
    ...table([
      ["side", "wins", "losses", "draws", "end reasons"],
      ...SIDES.map((s) => {
        const r = stats.sides[s];
        const reasons = Object.entries(r.reasons).map(([reason, n]) => `${reason} ${n}`);
        return [LABEL[s], r.wins, r.losses, r.draws, reasons.join(", ")];
      }),
    ]),
  );
  lines.push("");
  if (stats.noWinner) lines.push(NO_WINNER_LINE, "");
  const perSide = stats.noWinner ? ["picks", "event", "points", "games"] : ["picks", "event", "points", "games", "win"];
  lines.push("Cards, per side (picks: opening picks; event, points: plays; games: games played in; win: win share)");
  const header = ["id", "name", ...SIDES.flatMap((s) => perSide.map((h) => `${LABEL[s]} ${h}`))];
  const rows = stats.cards.map((card) => [
    card.id,
    card.name,
    ...SIDES.flatMap((s) => {
      const n = card[s];
      const cells = [n.picks, n.event, n.points, n.gamesPlayedIn];
      return stats.noWinner ? cells : [...cells, share(n.winShare)];
    }),
  ]);
  lines.push(...table([header, ...rows]));
  if (stats.byEra !== undefined) lines.push("", ...eraLines(stats.byEra));
  if (stats.map !== undefined) lines.push("", ...mapLines(stats.map));
  if (stats.eraEnds !== undefined) lines.push("", ...eraEndLines(stats.eraEnds));
  if (stats.score !== undefined) lines.push("", ...scoreLines(stats.score));
  return `${lines.join("\n")}\n`;
}

const HOW_LABEL = { trackEnd: "track end", ahead: "ahead after the last era", even: "even track (a draw)" };

/** The "Score" section, on a map with scoring: where the track ended, how games ended, swings, deciding regions. */
function scoreLines(score) {
  const { final, results } = score;
  return [
    `Score track (positive favours SAE; starts at ${score.start}): ends at ${final.average} on average, ` +
      `from ${final.min} to ${final.max}; ${score.games} games`,
    ...table([
      ["how the game ended", "games", "share", "LIO wins", "SAE wins"],
      ...HOWS.map((h) => [
        HOW_LABEL[h],
        results[h].games,
        results[h].share,
        results[h].lio ?? "-",
        results[h].sae ?? "-",
      ]),
    ]),
    "",
    "Score per era (averages over the games that scored it: points each side got, net swing = SAE minus LIO)",
    ...table([
      ["era", "games", "LIO points", "SAE points", "swing"],
      ...score.perEra.map((e) => [e.era, e.games, e.lio, e.sae, e.swing]),
    ]),
    "",
    "Score per region (the same, and how many games the region decided: it pushed the track over its end, or moved " +
      "it most towards the winner)",
    ...table([
      ["region", "games", "LIO points", "SAE points", "swing", "decided", "decided share"],
      ...score.perRegion.map((r) => [r.region, r.games, r.lio, r.sae, r.swing, r.decided, r.decidedShare]),
    ]),
  ];
}

/** The "Map" section, on a scenario with a map: one row per side. */
function mapLines(map) {
  const header = ["side", "influence", "countries controlled", ...ACTIONS.map((a) => `${a} points`)];
  const rows = SIDES.map((s) => [
    LABEL[s],
    map[s].influence,
    map[s].controlled,
    ...ACTIONS.map((a) => map[s].spent[a]),
  ]);
  return [
    "Map, per side (averages per game: influence on the map and countries controlled at game end; " +
      "place, intervene, realign points: points spent on each action of the menu)",
    ...table([header, ...rows]),
  ];
}

/** The "Era ends" section, on a scenario with a map: one row per era end and side. */
function eraEndLines(eraEnds) {
  const header = ["era", "side", "countries", "battlegrounds", ...LEVELS.map((l) => `regions ${LEVEL_LABEL[l]}`)];
  const rows = eraEnds.flatMap((end) =>
    SIDES.map((s) => [
      end.era,
      LABEL[s],
      end[s].countries,
      end[s].battlegrounds,
      ...LEVELS.map((l) => end[s].levels[l]),
    ]),
  );
  return [
    "Era ends, per side (averages per game, when the next era starts or the game ends: countries and battlegrounds " +
      "controlled, with the ending era's battleground list; regions at each level, the highest only. This " +
      "section is control only: amounts and the score are in the Score section, when the map has scoring)",
    ...table([header, ...rows]),
  ];
}

const LEVEL_LABEL = { present: "present", ahead: "ahead", everyBattleground: "every BG" };

/** The "By era" section: one row per era, or "left out" with no numbers. */
function eraLines(byEra) {
  const header = ["era", "cards", "used per game", "share used", "uses per game"];
  const rows = byEra.map((e) =>
    e.leftOut
      ? [e.era, "left out", "", "", ""]
      : [e.era, e.cards, e.averageCardsUsed, share(e.shareUsed), e.averageUses],
  );
  return [
    "By era (used per game: distinct cards of the era picked or played by either side, per game; " +
      "share used: that out of the era's cards; uses per game: picks plus plays of its cards)",
    ...table([header, ...rows]),
  ];
}
