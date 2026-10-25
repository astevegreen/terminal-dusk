// The invite port behind private games (docs/architecture.md, Decision 5), and an in-memory store for tests.
// An invite is a code a signed-in host shares; the second player joins with it and a match is created.
import type { Side } from "@terminal-dusk/engine";
import type { PlayerId } from "@terminal-dusk/host";
import { later } from "./later.ts";
import type { MatchWrite, MemoryStore } from "./store.ts";

/**
 * How the sides are assigned (owner decision, 21 Oct, on #162): drawn at random when the invitee joins,
 * chosen by the host (the invitee takes the other side), or chosen by the invitee when joining.
 */
export type SideMode = { mode: "random" } | { mode: "host"; hostSide: Side } | { mode: "invitee" };

/** A new invite, as `createInvite` saves it. `createdAt` is the time as a whole number. */
export type Invite = { code: string; host: PlayerId; sides: SideMode; createdAt: number };

/** An invite as stored: `accepted` is null until someone joins, then holds who joined and the match made. */
export type StoredInvite = Invite & { accepted: { joiner: PlayerId; matchId: string } | null };

/** `saved`: the invite was stored. `clash`: an invite (used or not) already has this code; nothing was stored. */
export type SaveResult = "saved" | "clash";

/** `accepted`: the invite is now used and the match is stored. `unavailable`: unknown or already used; nothing stored. */
export type AcceptResult = "accepted" | "unavailable";

/** Where invites live. The Supabase adapter (a later task) and the in-memory store both implement it. */
export interface InviteStore {
  /** Stores a new, unused invite. Never overwrites an existing code, used or not. */
  save(invite: Invite): Promise<SaveResult>;
  /** The invite with this code, or `null`. */
  find(code: string): Promise<StoredInvite | null>;
  /**
   * In one step: marks the unused invite `code` used by `joiner` with the id of the match in `write`, and
   * stores that match. When the invite is unknown or already used, it stores nothing.
   */
  accept(code: string, joiner: PlayerId, write: MatchWrite): Promise<AcceptResult>;
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * An `InviteStore` held in memory, storing matches in O1's `MemoryStore`. It keeps copies, so callers
 * cannot change what is stored by accident. Each call runs without a pause, so `accept` is one step.
 */
export class MemoryInviteStore implements InviteStore {
  readonly #invites = new Map<string, StoredInvite>();
  readonly #matches: MemoryStore;

  constructor(matches: MemoryStore) {
    this.#matches = matches;
  }

  save(invite: Invite): Promise<SaveResult> {
    return later((): SaveResult => {
      if (this.#invites.has(invite.code)) return "clash";
      this.#invites.set(invite.code, { ...copy(invite), accepted: null });
      return "saved";
    });
  }

  find(code: string): Promise<StoredInvite | null> {
    return later(() => {
      const found = this.#invites.get(code);
      return found ? copy(found) : null;
    });
  }

  accept(code: string, joiner: PlayerId, write: MatchWrite): Promise<AcceptResult> {
    return later((): AcceptResult => {
      const found = this.#invites.get(code);
      if (!found || found.accepted !== null) return "unavailable";
      const matchId = write.record.matchId;
      this.#invites.set(code, { ...found, accepted: { joiner, matchId } });
      this.#matches.insert(matchId, write);
      return "accepted";
    });
  }
}
