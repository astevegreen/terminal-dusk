// The entitlement port (docs/architecture.md, Decision 5): which full-game copies a player owns, and an in-memory
// store for tests. Rows come only from verified sources (a store, a gift code); nothing here decides who may play,
// which is the host's createOnlineRefusal.
import type { Entitlement, PlayerId } from "@terminal-dusk/host";

/** One stored entitlement: whose it is, the platform it is for, and where it came from. */
export type EntitlementRow = { player: PlayerId } & Entitlement;

/** Where entitlements live. The Supabase adapter and the in-memory store both implement it. */
export interface EntitlementStore {
  /** That player's entitlements, oldest first; an empty list when they have none. */
  forPlayer(player: PlayerId): Promise<Entitlement[]>;
}

const entitlementOf = ({ platform, source }: Entitlement): Entitlement => ({ platform, source });

/**
 * An `EntitlementStore` held in memory, for tests. It keeps copies, so callers cannot change what is stored by
 * accident, and returns a player's entitlements in the order they were given or granted.
 */
export class MemoryEntitlementStore implements EntitlementStore {
  readonly #rows: EntitlementRow[];

  constructor(rows: readonly EntitlementRow[] = []) {
    this.#rows = rows.map((row) => ({ player: row.player, ...entitlementOf(row) }));
  }

  async forPlayer(player: PlayerId): Promise<Entitlement[]> {
    return this.#rows.filter((row) => row.player === player).map(entitlementOf);
  }

  /** Adds an entitlement after the player's earlier ones. */
  async grant(player: PlayerId, entitlement: Entitlement): Promise<void> {
    this.#rows.push({ player, ...entitlementOf(entitlement) });
  }

  /** Removes every entitlement of that player. */
  async revokeAll(player: PlayerId): Promise<void> {
    const kept = this.#rows.filter((row) => row.player !== player);
    this.#rows.splice(0, this.#rows.length, ...kept);
  }
}
