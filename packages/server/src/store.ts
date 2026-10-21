// The storage port behind `submit` (docs/architecture.md, Decision 5), and an in-memory store for tests.
// The secret is passed through unopened: server code never looks inside the game state.
import type { Viewer } from "@terminal-dusk/engine";
import type { Frame, MatchRecord, MatchSecret } from "@terminal-dusk/host";

/** What `load` gives: the readable record and the server-only secret. */
export type LoadedMatch = { record: MatchRecord; secret: MatchSecret };

/** What `commit` saves, all together: the new record, the new secret and each viewer's latest frame. */
export type MatchWrite = { record: MatchRecord; secret: MatchSecret; frames: Record<Viewer, Frame> };

/** `saved`: all three were written. `conflict`: the stored seq had moved on, so nothing was written. */
export type CommitResult = "saved" | "conflict";

/** Where matches live. The Supabase adapter (a later task) and the in-memory store both implement it. */
export interface MatchStore {
  /** The match, or `null` when no match has this id. */
  load(matchId: string): Promise<LoadedMatch | null>;
  /** Saves `write` only when the stored `record.seq` still equals `expectedSeq` (`where seq = expectedSeq`). */
  commit(matchId: string, expectedSeq: number, write: MatchWrite): Promise<CommitResult>;
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A `MatchStore` held in memory. It keeps copies, so callers cannot change what is stored by accident. */
export class MemoryStore implements MatchStore {
  readonly #matches = new Map<string, MatchWrite>();

  /** Puts in a match just made by `hostCreate` (seq 0). Creating matches through the port is a later task. */
  insert(matchId: string, write: MatchWrite): void {
    this.#matches.set(matchId, copy(write));
  }

  /** A copy of everything stored for the match, frames included, or `null`. For tests. */
  stored(matchId: string): MatchWrite | null {
    const found = this.#matches.get(matchId);
    return found ? copy(found) : null;
  }

  async load(matchId: string): Promise<LoadedMatch | null> {
    const found = this.#matches.get(matchId);
    return found ? copy({ record: found.record, secret: found.secret }) : null;
  }

  async commit(matchId: string, expectedSeq: number, write: MatchWrite): Promise<CommitResult> {
    const found = this.#matches.get(matchId);
    if (!found || found.record.seq !== expectedSeq) return "conflict";
    this.#matches.set(matchId, copy(write));
    return "saved";
  }
}
