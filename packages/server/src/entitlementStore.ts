// The entitlement port (docs/architecture.md, Decision 5): which full-game copies a player owns, and an in-memory
// store for tests. Rows come only from verified sources (a store, a gift code); nothing here decides who may play,
// which is the host's createOnlineRefusal.
import type { Entitlement, PlayerId } from "@terminal-dusk/host";
import type {
  EntitlementReceipts,
  GrantStatus,
  ReversalStatus,
  RevokeStatus,
  UnmatchedReason,
} from "./entitlementReceipts.ts";

/** One stored entitlement: whose it is, the platform it is for, and where it came from. */
export type EntitlementRow = { player: PlayerId } & Entitlement;
/** A row as the memory store holds it: a purchase's row also keeps its receipt reference. */
type StoredRow = EntitlementRow & { receiptRef?: string };

/** A receipt's chargeback record: the latest time of each kind, and the buyer kept while it is charged back. */
type Dispute = { chargedBackAt: number; reversedAt: number; held?: EntitlementRow | undefined };

/** Where entitlements live. The Supabase adapter and the in-memory store both implement it. */
export interface EntitlementStore {
  /** That player's entitlements, oldest first; an empty list when they have none. */
  forPlayer(player: PlayerId): Promise<Entitlement[]>;
}

const entitlementOf = ({ platform, source }: Entitlement): Entitlement => ({ platform, source });
const keyOf = (source: string, receiptRef: string): string => JSON.stringify([source, receiptRef]);
const chargedBack = (dispute: Dispute): boolean => dispute.chargedBackAt > dispute.reversedAt;
const isFor =
  (source: string, receiptRef: string) =>
  (row: StoredRow): boolean =>
    row.source === source && row.receiptRef === receiptRef;

/**
 * An `EntitlementStore` and `EntitlementReceipts` held in memory, for tests. It keeps copies, so callers cannot
 * change what is stored by accident, and returns a player's entitlements in the order they were given or granted.
 */
export class MemoryEntitlementStore implements EntitlementStore, EntitlementReceipts {
  readonly #rows: StoredRow[];
  readonly #refunded = new Set<string>();
  readonly #disputes = new Map<string, Dispute>();
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
    const key = keyOf(source, receiptRef);
    if (this.#refunded.has(key)) return "refunded";
    const dispute = this.#disputes.get(key);
    if (dispute && chargedBack(dispute)) {
      dispute.held ??= { player, ...entitlementOf(entitlement) };
      return "chargedBack";
    }
    if (this.#rows.some(isFor(source, receiptRef))) return "already";
    this.#rows.push({ player, ...entitlementOf(entitlement), receiptRef });
    return "granted";
  }

  async revokeReceipt(source: string, receiptRef: string): Promise<RevokeStatus> {
    this.#refunded.add(keyOf(source, receiptRef));
    return this.#remove(source, receiptRef) > 0 ? "revoked" : "remembered";
  }

  async chargeBackReceipt(source: string, receiptRef: string, at: number): Promise<RevokeStatus> {
    const dispute = this.#dispute(source, receiptRef);
    dispute.chargedBackAt = Math.max(dispute.chargedBackAt, at);
    const row = this.#rows.find(isFor(source, receiptRef));
    if (!row || !chargedBack(dispute)) return "remembered";
    dispute.held = { player: row.player, ...entitlementOf(row) };
    this.#remove(source, receiptRef);
    return "revoked";
  }

  async reverseChargeback(source: string, receiptRef: string, at: number): Promise<ReversalStatus> {
    const dispute = this.#dispute(source, receiptRef);
    dispute.reversedAt = Math.max(dispute.reversedAt, at);
    const { held } = dispute;
    if (!held || chargedBack(dispute) || this.#refunded.has(keyOf(source, receiptRef))) return "remembered";
    if (this.#rows.some(isFor(source, receiptRef))) return "remembered";
    this.#rows.push({ ...held, receiptRef });
    dispute.held = undefined;
    return "restored";
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

  /** The receipt's chargeback record, made empty the first time. */
  #dispute(source: string, receiptRef: string): Dispute {
    const key = keyOf(source, receiptRef);
    const dispute = this.#disputes.get(key) ?? { chargedBackAt: 0, reversedAt: 0 };
    this.#disputes.set(key, dispute);
    return dispute;
  }

  /** Removes the receipt's rows, and answers how many there were. */
  #remove(source: string, receiptRef: string): number {
    const matches = isFor(source, receiptRef);
    return this.#keep((row) => !matches(row));
  }

  /** Keeps only the rows `wanted` accepts, and answers how many it removed. */
  #keep(wanted: (row: StoredRow) => boolean): number {
    const before = this.#rows.length;
    this.#rows.splice(0, before, ...this.#rows.filter(wanted));
    return before - this.#rows.length;
  }
}
