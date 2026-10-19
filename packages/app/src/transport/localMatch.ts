// A match run entirely in memory: it keeps the host's record and secret, and gives each viewer a transport.
// The app only hands the record and secret back to the host; it never reads the secret (hard rule 2).
// The seed and the clock are passed in, so there is no platform code here (hard rule 8).
import type { Ruleset, Seed, Side, Viewer } from "@terminal-dusk/engine";
import { hostArchive, hostCreate, hostSubmit } from "@terminal-dusk/host";
import type {
  Frame,
  HostError,
  HostResult,
  MatchConfig,
  MatchRecord,
  MatchSecret,
  ReplayArchive,
  Submission,
} from "@terminal-dusk/host";
import type { MatchTransport, SubmitResult } from "./matchTransport.ts";

/** Builds the replay archive of a finished match; hostArchive unless a test passes another. */
export type ArchiveWith = (
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
) => { ok: true; value: ReplayArchive } | { ok: false; error: HostError };

export type LocalMatch = {
  transportFor(viewer: Viewer): MatchTransport;
  /** The replay archive once the game is over, else null. Only the transport and the sessions may read it. */
  archive(): ReplayArchive | null;
  /** The code of a failed archive step (a bug to report), or null. */
  archiveError(): string | null;
};

const VIEWERS: readonly Viewer[] = ["lio", "sae", "spectator"];
const notPlayer: SubmitResult = { ok: false, error: { code: "notPlayer" } };

export function createLocalMatch(
  ruleset: Ruleset,
  config: MatchConfig,
  seed: Seed,
  clock: () => number,
  archiveWith: ArchiveWith = hostArchive,
): { ok: true; value: LocalMatch } | { ok: false; error: HostError } {
  const created = hostCreate(ruleset, config, seed, clock());
  if (!created.ok) return created;
  let current: HostResult = created.value;
  const subscribers: Record<Viewer, Set<(frame: Frame) => void>> = {
    lio: new Set(),
    sae: new Set(),
    spectator: new Set(),
  };
  // Every submission waits its turn here, so one finishes (including its frame delivery) before the next starts.
  // A submission made from inside an onFrame callback therefore runs after every subscriber has the current frame.
  let queue: Promise<unknown> = Promise.resolve();
  let archive: ReplayArchive | null = null;
  let archiveError: string | null = null;

  const deliver = (): void => {
    for (const viewer of VIEWERS) {
      for (const onFrame of [...subscribers[viewer]]) {
        if (subscribers[viewer].has(onFrame)) onFrame(current.frames[viewer]);
      }
    }
  };

  const finalizeGame = (): void => {
    const built = archiveWith(ruleset, current.record, current.secret);
    if (built.ok) archive = built.value;
    else archiveError = built.error.code;
  };

  const send = (side: Side, build: (player: string) => Submission): Promise<SubmitResult> => {
    const run = queue.then((): SubmitResult => {
      const submission = build(current.record.players[side]);
      const outcome = hostSubmit(ruleset, current.record, current.secret, submission, clock());
      if (!outcome.ok) return { ok: false, error: outcome.error };
      current = outcome.value;
      // The archive is made before any frame goes out, so a subscriber handling the game-over frame can read it.
      if (outcome.value.effects.some((effect) => "finalize" in effect)) finalizeGame();
      // Other host effects (notify) are ignored for now. The AI turn hooks in here.
      deliver();
      return { ok: true };
    });
    queue = run.catch(() => undefined);
    return run;
  };

  const transportFor = (viewer: Viewer): MatchTransport => ({
    subscribe(onFrame) {
      subscribers[viewer].add(onFrame);
      onFrame(current.frames[viewer]);
      return () => {
        subscribers[viewer].delete(onFrame);
      };
    },
    submit(s) {
      if (viewer === "spectator") return Promise.resolve(notPlayer);
      return send(viewer, (player) => ({
        player,
        expectedSeq: s.expectedSeq,
        decisionId: s.decisionId,
        value: s.value,
      }));
    },
    resign() {
      if (viewer === "spectator") return Promise.resolve(notPlayer);
      return send(viewer, (player) => ({ player, resign: true }));
    },
  });

  return { ok: true, value: { transportFor, archive: () => archive, archiveError: () => archiveError } };
}
