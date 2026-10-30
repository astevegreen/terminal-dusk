// The types of what a viewer receives (views.ts). types.ts re-exports them, so imports stay the same.
import type { MetaState, PrivateState, PublicState, SecretState, Side } from "./types.ts";

/** Sizes of everything a viewer cannot see. A hand the viewer cannot see is only ever a number. */
export type HiddenCounts = { deck: number; hands: Record<Side, number> };
/** Every meta field is public: `seedHash` is the published hash, never the seed. */
export type PublicMeta = MetaState;
/** What one viewer receives. `mine` is the viewer's own private compartment, or null for a spectator. */
export type PlayerView = { public: PublicState; mine: PrivateState | null; counts: HiddenCounts; meta: PublicMeta };
/**
 * What a replay's omniscient viewer receives: the public compartment, both sides' private compartments,
 * the counts and the meta. Never the secret compartment: a finished game's seed and move log recompute it.
 * It has no `mine`, so it can never stand in for a live frame's PlayerView.
 */
export type OmniscientView = {
  public: PublicState;
  sides: Record<Side, PrivateState>;
  counts: HiddenCounts;
  meta: PublicMeta;
};
/** What `viewer` cannot see: the opponent's private compartment and the secret compartment. */
export type HiddenPart = { viewer: Side; opponent: PrivateState; secret: SecretState };
