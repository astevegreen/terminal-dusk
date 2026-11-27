// The online game screen's words: whose turn it is, and how long the waiting side has before its deadline.
// Plain functions of the snapshot, so they are tested as tables. Display only: the server's deadline sweep
// decides what a missed deadline does.
import type { GameEvent, Side, Viewer } from "@terminal-dusk/engine";
import type { StandInRun } from "@terminal-dusk/host";
import type { OnlineDeadline } from "./matchClock.ts";
import type { OnlineGameSnapshot } from "./onlineGame.ts";
import { SIDE_NAME } from "./lobbyText.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const count = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** How much of `t` milliseconds is left, in whole days and hours rounded down. */
export function timeLeft(t: number): string {
  if (t <= 0) return "time is up";
  if (t < HOUR) return "less than an hour left";
  if (t < DAY) return `${count(Math.floor(t / HOUR), "hour")} left`;
  const days = Math.floor(t / DAY);
  const hours = Math.floor((t % DAY) / HOUR);
  const parts = hours === 0 ? [count(days, "day")] : [count(days, "day"), count(hours, "hour")];
  return `${parts.join(" ")} left`;
}

/** The deadline line: the time left at the read, then the extension still to come when there is one. */
export function deadlineText(deadline: OnlineDeadline): string {
  const t = deadline.at - deadline.now;
  const extra = t > 0 && deadline.rule === "graceThenLoss" && deadline.graceLeft;
  return `${timeLeft(t)}${extra ? ", then one extra deadline" : ""}`;
}

/**
 * The deadline in full, for the Details panel (#504): whose it is, the time left, and whether an extra deadline is
 * still to come or already used. The top bar's line may be cut short at 844 px; this one is not.
 */
export function deadlineDetail(deadline: OnlineDeadline, viewer: Viewer): string {
  const whose = deadline.side === viewer ? "Your deadline" : `${SIDE_NAME[deadline.side]}'s deadline`;
  const used = deadline.at > deadline.now && deadline.rule === "graceThenLoss" && !deadline.graceLeft;
  return `${whose}: ${deadlineText(deadline)}${used ? ", and the extra deadline is used" : ""}`;
}

/**
 * One log line for a move the host made for a side whose deadline passed (#605): marked, and showing only the
 * side's name. `line` is the ordinary log line of the same event, which the viewer may see anyway.
 */
export function standInLine(side: Side, line: string): string {
  return `Played for ${SIDE_NAME[side]} (deadline passed): ${line}`;
}

/** The event kinds that are a side's own move, so a stand-in step marks them when they are the covered side's. */
const MOVE_KINDS: ReadonlySet<GameEvent["kind"]> = new Set<GameEvent["kind"]>([
  "pointsSpent",
  "influencePlaced",
  "intervened",
  "realigned",
  "techRaceAttempted",
  "cardsDiscarded",
]);

/**
 * True when `event` is `side`'s own move (Decision (architect), #616). The event's side is enough to tell: influence
 * moves, and the tech race is tried, only by that side's own answer, even with points a rival's card gave
 * (tests/fuzz/moveChecks.ts checks it).
 */
const isMoveOf = (event: GameEvent, side: Side): boolean =>
  MOVE_KINDS.has(event.kind) && "side" in event && event.side === side;

/**
 * The log lines for `events`, where `runs` says which of them the host played for a late side (#605). Inside a run
 * only that side's own moves are marked with standInLine; draws, scoring and the other side's events read as usual
 * (#616). A run with none of its events marked, or with no events at all, adds one marked line after it, "the
 * default answer", naming no card, so no stand-in passes without a trace.
 */
export function logLines(
  events: readonly GameEvent[],
  runs: readonly StandInRun[] | undefined,
  lineOf: (event: GameEvent) => string,
): string[] {
  const lines: string[] = [];
  const fallback = (run: StandInRun): void => {
    const marked = events.slice(run.start, run.start + run.count).some((e) => isMoveOf(e, run.side));
    if (!marked) lines.push(standInLine(run.side, "the default answer"));
  };
  const empty = (at: number): void => {
    for (const run of runs ?? []) if (run.count === 0 && run.start === at) fallback(run);
  };
  events.forEach((event, i) => {
    empty(i);
    const run = runs?.find((r) => i >= r.start && i < r.start + r.count);
    const line = lineOf(event);
    lines.push(run !== undefined && isMoveOf(event, run.side) ? standInLine(run.side, line) : line);
    if (run !== undefined && i === run.start + run.count - 1) fallback(run);
  });
  empty(events.length);
  return lines;
}

/** The turn line for a snapshot. */
export function turnText({ turn, frame }: Pick<OnlineGameSnapshot, "turn" | "frame">): string {
  if (turn === "mine") return "Your move";
  if (turn === "loading" || frame === null) return "Loading the game";
  const pub = frame.view.public;
  if (turn === "rival") {
    const waiting = pub.pending.find((d) => d.side !== frame.viewer)?.side;
    return waiting === undefined ? "Loading the game" : `Waiting for ${SIDE_NAME[waiting]}`;
  }
  if (pub.status.kind !== "over" || pub.status.winner === null) return "Draw";
  return pub.status.winner === frame.viewer ? "You won" : "You lost";
}
