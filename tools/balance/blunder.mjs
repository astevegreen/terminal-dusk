// Decision 8's third gate, "no tier loses to its own Escalation blunder" (docs/architecture.md; "tension track" is
// Escalation's old name). Reads only the public events and the final status and score, never hidden cards or the seed.
// The definition is the architect's on #695: a game counts only when it has a winner and ended at the track's end or
// at the turn limit (draws, resignations and timeouts never do).

const rivalOf = (side) => (side === "lio" ? "sae" : "lio");

/**
 * The side that lost game `status` to its own crisis (docs/design/map-and-points.md, "Crisis at 6"), or null.
 * - Track's end: the move that reached the end was the loser's own crisis: the game's last scoreChanged comes
 *   straight after an escalationCrisis naming the loser. Earlier crises do not count: the overshoot is not public.
 * - Turn limit: the loser's own crises cost at least the final margin (|final score|) between them, and at least 1,
 *   so without them it would have been even or ahead.
 */
export function ownBlunder(status, events, finalScore) {
  if (status.kind !== "over" || status.winner === null) return null;
  const loser = rivalOf(status.winner);
  if (status.reason === "trackEnd") {
    const last = events.findLastIndex((e) => e.kind === "scoreChanged");
    const before = events[last - 1];
    return before?.kind === "escalationCrisis" && before.side === loser ? loser : null;
  }
  if (status.reason !== "turnLimitReached") return null;
  const cost = events.filter((e) => e.kind === "escalationCrisis" && e.side === loser).reduce((n, e) => n + e.value, 0);
  return cost >= 1 && cost >= Math.abs(finalScore) ? loser : null;
}
