// Test helper: where a real card ends up once a one-turn game is over, by the way it was used. It proves a
// once-only card (flags.removeAfterEvent) leaves the game whenever its event happens, and is discarded otherwise.
import { apply } from "@terminal-dusk/engine";
import type { Answer, CardId, GameState, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { startCardGame } from "./playCard.ts";

/**
 * How the card is used: its owner plays it for its event or for its points, the rival plays it for its points
 * (its event still runs, before the points), or its owner picks it as the opening card.
 */
export type CardUse = "event" | "points" | "rivalPoints" | "opening";

/** Where a card is: "removed", "discard", "inPlay", "hand", "deck", or "nowhere". */
export function placeOf(state: GameState, card: CardId): string {
  if (state.public.removed.includes(card)) return "removed";
  if (state.public.discard.includes(card)) return "discard";
  if (state.public.inPlay.includes(card)) return "inPlay";
  if (state.private.lio.hand.includes(card) || state.private.sae.hand.includes(card)) return "hand";
  return state.secret.deck.includes(card) ? "deck" : "nowhere";
}

const rivalOf = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/**
 * Plays first-deck card `id` (the real file) once, used as `use`, in the one-turn card-test game; every other
 * pick and play is a filler card played for its points. Returns where the card is when the game is over.
 */
export function whereCardEnds(id: CardId, use: CardUse): string {
  const { ruleset, state: start, owner } = startCardGame(id, {}, use === "rivalPoints" ? "rival" : "owner");
  const user: Side = use === "rivalPoints" ? rivalOf(owner) : owner;
  let state = start;
  const step = (answer: Answer) => {
    const r = apply(ruleset, state, answer);
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    state = r.value.state;
  };
  const nextFiller: Record<Side, number> = { lio: 1, sae: 1 };
  const filler = (side: Side): CardId => `fill-${side}-${nextFiller[side]++}`;
  let used = false;
  for (let guard = 0; guard < 40 && state.public.status.kind !== "over"; guard++) {
    const d = state.public.pending[0];
    if (!d) throw new Error("the game is waiting for nobody");
    const mine = d.side === user && !used;
    if (d.kind === "chooseCard") {
      const card = mine && use === "opening" ? id : filler(d.side);
      if (card === id) used = true;
      step({ decisionId: d.id, side: d.side, value: { kind: "chooseCard", card } });
    } else if (d.kind === "playCardAs") {
      if (mine && use !== "opening") {
        used = true;
        const as = use === "event" ? "event" : "points";
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: id, as } });
      } else {
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: filler(d.side), as: "points" } });
      }
    } else if (d.kind === "rivalEventOrder") {
      step({ decisionId: d.id, side: d.side, value: { kind: "rivalEventOrder", event: "before" } });
    } else {
      throw new Error(`unexpected decision ${d.kind}`);
    }
  }
  if (!used) throw new Error(`${id} was never used as ${use}`);
  return placeOf(state, id);
}

/**
 * The four tests of a once-only card: it leaves the game (`removed`) whenever its event happens (played for its
 * event, played by the rival for its points, or picked as an opening card), and goes to the discard pile when its
 * own side plays it for its points only.
 */
export function describeOnceOnly(id: CardId, name: string): void {
  describe(`${id} ${name} is once-only`, () => {
    it("played by its own side for its event, it is removed from the game, not discarded", () => {
      expect(whereCardEnds(id, "event")).toBe("removed");
    });
    it("played by its own side for its points, it goes to the discard pile", () => {
      expect(whereCardEnds(id, "points")).toBe("discard");
    });
    it("played by the rival for its points, its event still runs and it is removed from the game", () => {
      expect(whereCardEnds(id, "rivalPoints")).toBe("removed");
    });
    it("picked as an opening card, it is removed from the game", () => {
      expect(whereCardEnds(id, "opening")).toBe("removed");
    });
  });
}
