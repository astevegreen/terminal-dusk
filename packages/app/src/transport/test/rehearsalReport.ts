// The phase 4 rehearsal's short report: what one run played and checked, and every problem it found, each with
// its match and seq. It shows no seed, card or other hidden value, so it is safe to print.
import type { GameResult } from "./rehearsal.ts";

const count = (n: number): string => n.toLocaleString("en-GB");

export function rehearsalReport(title: string, games: readonly GameResult[]): string {
  const finished = games.filter((g) => g.finished);
  const wins = (winner: GameResult["winner"]) => finished.filter((g) => g.winner === winner).length;
  const steps = games.map((g) => g.steps);
  const sum = (pick: (g: GameResult) => number) => games.reduce((total, g) => total + pick(g), 0);
  const problems = (pick: (g: GameResult) => string[]) =>
    games.flatMap((g) => pick(g).map((problem) => `  - ${g.matchId}: ${problem}`));
  const desyncs = problems((g) => g.desyncs);
  const leaks = problems((g) => g.leaks);
  const refusals = problems((g) => g.refusals);
  const lines = [
    title,
    `Games: ${count(games.length)} played, ${count(finished.length)} finished ` +
      `(LIO won ${wins("lio")}, SAE won ${wins("sae")}, no winner ${wins(null)})`,
    games.length === 0
      ? "Steps: 0"
      : `Steps: ${count(sum((g) => g.steps))} (shortest game ${Math.min(...steps)}, longest ${Math.max(...steps)})`,
    `Frames checked against the server: ${count(sum((g) => g.framesChecked))}`,
    `Responses checked for hidden data: ${count(sum((g) => g.responsesChecked))}`,
    `Desyncs: ${count(desyncs.length)}`,
    ...desyncs,
    `Leaks: ${count(leaks.length)}`,
    ...leaks,
    `Games stopped early: ${count(refusals.length)}`,
    ...refusals,
    desyncs.length + leaks.length + refusals.length === 0 && finished.length === games.length
      ? "Result: PASS"
      : "Result: FAIL",
  ];
  return lines.join("\n");
}
