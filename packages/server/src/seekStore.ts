// The matchmaking port (docs/architecture.md, Decision 5, `seek` and "Scheduled jobs", Matchmaking; #681), and an
// in-memory store for tests. A ticket is one player's search for a ranked game. Tickets persist until paired.
import type { Side } from "@terminal-dusk/engine";
import type { Platform, PlayerId } from "@terminal-dusk/host";
import { later } from "./later.ts";
import type { RankedPreset } from "./rankedPresets.ts";
import type { MatchWrite, MemoryStore } from "./store.ts";

/**
 * One open search. `rating` is the player's rating, rounded to a whole number when they searched. `side` is the side
 * they prefer, or null for no preference. `createdAt` (whole milliseconds) decides how wide their rating band is.
 * Nothing hidden: no game data, seed or secret.
 */
export type SeekTicket = {
  id: string;
  player: PlayerId;
  rating: number;
  preset: RankedPreset;
  side: Side | null;
  createdAt: number;
  /** The platform they searched on: the Full Game is checked for exactly this one, again at pairing. */
  platform: Platform;
};

/** `saved`: the ticket is stored. `limit`: the player already has `limit` unfinished ranked matches plus tickets. */
export type CreateSeekResult = "saved" | "limit";
/** `paired`: both tickets were removed and the match stored. `unavailable`: a ticket was gone; nothing was stored. */
export type PairResult = "paired" | "unavailable";

export interface SeekStore {
  /** Stores the ticket unless the player's unfinished ranked matches plus open tickets already reach `limit`. One step. */
  create(ticket: SeekTicket, limit: number): Promise<CreateSeekResult>;
  /** Removes the ticket `id` when it is `player`'s own. True when one was removed; false when none was (no such ticket, or not theirs). */
  cancel(id: string, player: PlayerId): Promise<boolean>;
  /** Every open ticket, oldest first (by `createdAt`, then id). */
  open(): Promise<SeekTicket[]>;
  /** In one step: when both tickets still exist, removes them and stores the match in `write`. Else stores nothing. */
  pair(ids: readonly [string, string], write: MatchWrite): Promise<PairResult>;
}

// The server tsconfig has no DOM or Node types, so structuredClone (in Node and Deno) is declared here.
declare function structuredClone<T>(value: T): T;
const copy = <T>(value: T): T => structuredClone(value);
const compareText = (a: string, b: string): number => (a < b ? -1 : Number(a > b));

/** The order tickets are paired in. */
export const byAge = (a: SeekTicket, b: SeekTicket): number => a.createdAt - b.createdAt || compareText(a.id, b.id);

/** A `SeekStore` held in memory, storing matches in the given `MemoryStore`. Each call is one step. */
export class MemorySeekStore implements SeekStore {
  readonly #tickets = new Map<string, SeekTicket>();
  readonly #matches: MemoryStore;

  constructor(matches: MemoryStore) {
    this.#matches = matches;
  }

  create(ticket: SeekTicket, limit: number): Promise<CreateSeekResult> {
    return later((): CreateSeekResult => {
      const tickets = [...this.#tickets.values()].filter((t) => t.player === ticket.player).length;
      if (tickets + this.#matches.unfinishedRanked(ticket.player) >= limit) return "limit";
      this.#tickets.set(ticket.id, copy(ticket));
      return "saved";
    });
  }

  cancel(id: string, player: PlayerId): Promise<boolean> {
    return later(() => {
      if (this.#tickets.get(id)?.player !== player) return false;
      this.#tickets.delete(id);
      return true;
    });
  }

  open(): Promise<SeekTicket[]> {
    return later(() => [...this.#tickets.values()].sort(byAge).map(copy));
  }

  pair(ids: readonly [string, string], write: MatchWrite): Promise<PairResult> {
    return later((): PairResult => {
      if (!ids.every((id) => this.#tickets.has(id))) return "unavailable";
      for (const id of ids) this.#tickets.delete(id);
      this.#matches.insert(write.record.matchId, write);
      return "paired";
    });
  }
}
