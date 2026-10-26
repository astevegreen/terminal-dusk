// The online game screen's words: whose turn it is, and how long the waiting side has before its deadline.
// Plain functions of the snapshot, so they are tested as tables. Display only: the server's deadline sweep
// decides what a missed deadline does.
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
  return `${count(days, "day")}${hours === 0 ? "" : ` ${count(hours, "hour")}`} left`;
}

/** The deadline line: the time left at the read, then the extension still to come when there is one. */
export function deadlineText(deadline: OnlineDeadline): string {
  const t = deadline.at - deadline.now;
  const extra = t > 0 && deadline.rule === "graceThenLoss" && deadline.graceLeft;
  return `${timeLeft(t)}${extra ? ", then one extra deadline" : ""}`;
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
