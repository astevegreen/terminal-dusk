// A move on the board is the answer of the side that makes it (#616): the online log relies on this to tell a
// stand-in's moves from the other events of its step. pointsSpent and cardsDiscarded are left out: a card's
// event gives those without an answer.
import type { Answer, GameEvent } from "@terminal-dusk/engine";

/** Throws when a step of `answer` has a placement, intervention, realignment or tech race try that is not its own. */
export function checkOwnMoves(answer: Answer, events: readonly GameEvent[]): void {
  for (const event of events) {
    switch (event.kind) {
      case "influencePlaced":
      case "intervened":
      case "realigned":
      case "techRaceAttempted":
        if (!("decisionId" in answer)) throw new Error(`${event.kind} came from a system answer`);
        if (event.side !== answer.side) {
          throw new Error(`${event.kind} is ${event.side}'s move, but the answer was ${answer.side}'s`);
        }
    }
  }
}
