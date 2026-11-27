// The entitlement port (docs/architecture.md, Decision 5): which full-game copies a player owns, and an in-memory
// store for tests. Rows come only from verified sources (a store, a gift code); nothing here decides who may play,
// which is the host's createOnlineRefusal.
import type { Entitlement, PlayerId } from "@terminal-dusk/host";
import type { EntitlementReceipts, GrantStatus, RevokeStatus, UnmatchedReason } from "./entitlementReceipts.ts";

/** One stored entitlement: whose it is, the platform it is for, and where it came from. */
export type EntitlementRow = { player: PlayerId } & Entitlement;
/** A row as the memory store holds it: a purchase's row also keeps its receipt reference. */
type StoredRow = EntitlementRow & { receiptRef?: string };

/** Where entitlements live. The Supabase adapter and the in-memory store both implement it. */
export interface EntitlementStore {
  /** That player's entitlements, oldest first; an empty list when they have none. */
  forPlayer(player: PlayerId): Promise<Entitlement[]>;
}

const entitlementOf = ({ platform, source }: Entitlement): Entitlement => ({ platform, source });
const keyOf = (source: string, receiptRef: string): string => JSON.stringify([source, receiptRef]);

/**
 * An `EntitlementStore` and `EntitlementReceipts` held in memory, for tests. It keeps copies, so callers cannot
 * change what is stored by accident, and returns a player's entitlements in the order they were given or granted.
 */
export class MemoryEntitlementStore implements EntitlementStore, EntitlementReceipts {
  readonly #rows: StoredRow[];
  readonly #refunded = new Set<string>();
  readonly #unmatched = new Map<string, UnmatchedReason>();

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
    this.#keep((row) => row.player !== player);
  }

  async grantReceipt(player: PlayerId, entitlement: Entitlement, receiptRef: string): Promise<GrantStatus> {
    const { source } = entitlement;
    if (this.#refunded.has(keyOf(source, receiptRef))) return "refunded";
    if (this.#rows.some((row) => row.source === source && row.receiptRef === receiptRef)) return "already";
    this.#rows.push({ player, ...entitlementOf(entitlement), receiptRef });
    return "granted";
  }

  async revokeReceipt(source: string, receiptRef: string): Promise<RevokeStatus> {
    this.#refunded.add(keyOf(source, receiptRef));
    const removed = this.#keep((row) => row.source !== source || row.receiptRef !== receiptRef);
    return removed > 0 ? "revoked" : "remembered";
  }

  async recordUnmatched(source: string, receiptRef: string, reason: UnmatchedReason): Promise<void> {
    const key = keyOf(source, receiptRef);
    if (!this.#unmatched.has(key)) this.#unmatched.set(key, reason);
  }

  /** The reason recorded for an unmatched receipt, as a list of at most one. */
  unmatchedFor(source: string, receiptRef: string): UnmatchedReason[] {
    const reason = this.#unmatched.get(keyOf(source, receiptRef));
    return reason === undefined ? [] : [reason];
  }

  /** Keeps only the rows `wanted` accepts, and answers how many it removed. */
  #keep(wanted: (row: StoredRow) => boolean): number {
    const before = this.#rows.length;
    this.#rows.splice(0, before, ...this.#rows.filter(wanted));
    return before - this.#rows.length;
  }
}
