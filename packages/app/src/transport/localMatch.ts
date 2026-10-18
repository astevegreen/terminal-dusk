// A match run entirely in memory: it keeps the host's record and secret, and gives each viewer a transport.
// The app only hands the record and secret back to the host; it never reads the secret (hard rule 2).
// The seed and the clock are passed in, so there is no platform code here (hard rule 8).
import type { Ruleset, Seed, Side, Viewer } from "@terminal-dusk/engine";
import { hostCreate, hostSubmit } from "@terminal-dusk/host";
import type { Frame, HostError, HostResult, MatchConfig, Submission } from "@terminal-dusk/host";
import type { MatchTransport, SubmitResult } from "./matchTransport.ts";

export type LocalMatch = { transportFor(viewer: Viewer): MatchTransport };

const VIEWERS: readonly Viewer[] = ["lio", "sae", "spectator"];
const notPlayer: SubmitResult = { ok: false, error: { code: "notPlayer" } };

export function createLocalMatch(
  ruleset: Ruleset,
  config: MatchConfig,
  seed: Seed,
  clock: () => number,
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

  const deliver = (): void => {
    for (const viewer of VIEWERS) {
      for (const onFrame of [...subscribers[viewer]]) {
        if (subscribers[viewer].has(onFrame)) onFrame(current.frames[viewer]);
      }
    }
  };

  const send = (side: Side, build: (player: string) => Submission): Promise<SubmitResult> => {
    const run = queue.then((): SubmitResult => {
      const submission = build(current.record.players[side]);
      const outcome = hostSubmit(ruleset, current.record, current.secret, submission, clock());
      if (!outcome.ok) return { ok: false, error: outcome.error };
      current = outcome.value;
      // Host effects (notify, finalize) are ignored for now. The AI turn and the end-of-game step hook in here.
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

  return { ok: true, value: { transportFor } };
}
