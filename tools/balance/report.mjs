// The balance report as text: the numbers from stats.mjs laid out as plain tables.
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
  return `${lines.join("\n")}\n`;
}
