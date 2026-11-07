// The fuzz check of passed plays (docs/design/core-loop.md, "No card left"; owner, 7 Nov 2026): a side with no card
// left passes a play it owes, and the game log shows it with a playPassed event. play.ts runs it after every answer.
import { pendingFor } from "@terminal-dusk/engine";
import type { Answer, CardId, GameEvent, GameState, Side } from "@terminal-dusk/engine";

/**
 * The passed plays of one step (`prior` the state before `answer`, `events` its events, `state` the state after):
 * (a) one playPassed event for each play the plays counter moved past without a play; (b) each names the side whose
 * play it was, LIO on even plays and SAE on odd ones, in play order; (c) the passing side's hand was empty: every
 * card in it now was drawn after the pass, since only the next turn's refill puts cards back in a hand.
 */
export function checkPassedPlays(
  prior: GameState,
  answer: Answer,
  events: readonly GameEvent[],
  state: GameState,
): void {
  const passes = events.flatMap((event, at) => (event.kind === "playPassed" ? [{ side: event.side, at }] : []));
  // A normal play counts once; Hypersonics' extra play (an extraPlay decision) is not counted (turn.ts).
  const played = "decisionId" in answer && pendingFor(prior, answer.side)?.kind === "playCardAs" ? 1 : 0;
  const before = prior.public;
  const after = state.public;
  // A turn ends only once all its plays are counted, and the next one opens on its opening picks, with none.
  const counted = after.turn === before.turn ? after.playsMade : 2 * before.playsPerTurn + after.playsMade;
  const passed = counted - before.playsMade - played;
  if (passed < 0) throw new Error(`the plays counter fell by ${-passed} at answer ${JSON.stringify(answer)}`);
  if (passes.length !== passed) {
    throw new Error(`the plays counter shows ${passed} passed plays, but ${passes.length} playPassed events came`);
  }
  // The passes follow the answered play, if any. 2 x plays per turn is even, so the parity runs on past a turn's end.
  const first = before.playsMade + played;
  passes.forEach(({ side, at }, n) => {
    const due: Side = (first + n) % 2 === 0 ? "lio" : "sae";
    if (side !== due) throw new Error(`playPassed event ${at} names ${side}, but the passed play was ${due}'s`);
    const drawn = drawnAfter(events, at, side);
    const kept = state.private[side].hand.filter((card) => !drawn.includes(card));
    if (kept.length > 0) {
      throw new Error(`${side} passed a play at event ${at}, yet holds ${JSON.stringify(kept)}, not drawn since`);
    }
  });
}

/** The cards `side` drew in `events` after index `at`. */
const drawnAfter = (events: readonly GameEvent[], at: number, side: Side): CardId[] =>
  events.slice(at + 1).flatMap((e) => (e.kind === "cardDrawn" && e.side === side ? [e.card] : []));
