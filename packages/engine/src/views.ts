// Views: the part of the state one viewer may see, the part they cannot, and rebuilding the whole.
import { copyJson as copy } from "./copy.ts";
import type { GameState, HiddenPart, PlayerView, Side, Viewer } from "./types.ts";

const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/**
 * What `viewer` may see: the public compartment, their own private compartment as `mine` (null for
 * a spectator), and counts for everything hidden. Never the secret compartment or another side's hand.
 */
export function viewFor(state: GameState, viewer: Viewer): PlayerView {
  return {
    public: copy(state.public),
    mine: viewer === "spectator" ? null : copy(state.private[viewer]),
    counts: {
      deck: state.secret.deck.length,
      hands: { lio: state.private.lio.hand.length, sae: state.private.sae.hand.length },
    },
    meta: copy(state.meta),
  };
}

/** Everything `viewer` cannot see: the opponent's private compartment and the secret compartment. */
export function hiddenPart(state: GameState, viewer: Side): HiddenPart {
  return { viewer, opponent: copy(state.private[other(viewer)]), secret: copy(state.secret) };
}

/**
 * Rebuilds a full state from a side's view and a hidden part. With the real hidden part this equals
 * the original state; the AI passes hidden cards it guessed itself. A spectator view has no own hand,
 * so it cannot be rebuilt.
 */
export function reconstruct(view: PlayerView, hidden: HiddenPart): GameState {
  if (view.mine === null) throw new Error("reconstruct needs a side's view; a spectator view has no own hand.");
  const own = copy(view.mine);
  const opponent = copy(hidden.opponent);
  return {
    public: copy(view.public),
    private: hidden.viewer === "lio" ? { lio: own, sae: opponent } : { lio: opponent, sae: own },
    secret: copy(hidden.secret),
    meta: copy(view.meta),
  };
}
