// Which edition a player's tutorial is (#647): the Full Game when they own it on this platform, otherwise the free
// game, which the engine ends after Era 1's scoring. The app reads the entitlements in ../entitlements/ (#686).
import { ownsFullGame } from "@terminal-dusk/host";
import type { Entitlement, Platform, TutorialEdition } from "@terminal-dusk/host";

/** The player's owned copies and the platform they are checked against; they travel together (Decision 7). */
export type OwnedEntitlements = { owned: Entitlement[]; platform: Platform };

/** "full" when one of `entitlements` is for its platform; "free" when it does not, or when it is left out. */
export function tutorialEdition(entitlements?: OwnedEntitlements): TutorialEdition {
  return entitlements && ownsFullGame(entitlements.owned, entitlements.platform) ? "full" : "free";
}
