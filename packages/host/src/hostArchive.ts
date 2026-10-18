// The replay archive: a finished game re-run step by step, one omniscient frame per step (architecture.md, section 3).
import { apply, createGame, eventsFor, viewFor } from "@terminal-dusk/engine";
import type { GameEvent, GameState, Ruleset } from "@terminal-dusk/engine";
import { copyJson } from "./frames.ts";
import { canonical } from "./hostFinish.ts";
import type { HostError, MatchRecord, MatchSecret, ReplayArchive, ReplayFrame } from "./types.ts";

const failed = (message: string): { ok: false; error: HostError } => ({
  ok: false,
  error: { code: "verifyFailed", message },
});

const frameOf = (state: GameState, events: readonly GameEvent[]): ReplayFrame => ({
  seq: state.meta.seq,
  view: copyJson(viewFor(state, "omniscient")),
  events: copyJson(eventsFor(events, "omniscient")),
});

/**
 * Builds the replay archive of a finished match by re-running it from the secret's seed, setup and log.
 * Refuses with gameNotOver while the match is active, and with verifyFailed when the re-run disagrees with
 * the record or the stored final state. Messages never hold the seed. It never changes its inputs.
 */
export function hostArchive(
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
): { ok: true; value: ReplayArchive } | { ok: false; error: HostError } {
  if (record.status.kind === "active") {
    return { ok: false, error: { code: "gameNotOver", message: "The game is still being played." } };
  }
  if (ruleset.id !== record.ruleset) return failed("The ruleset is not the one this match was played with.");
  const start = createGame(ruleset, secret.setup, secret.seed);
  if (!start.ok) return failed(`The finished game did not check out (${start.error.code}).`);
  let { state } = start.value;
  const frames = [frameOf(state, start.value.events)];
  for (const [i, answer] of secret.log.entries()) {
    const step = apply(ruleset, state, answer);
    if (!step.ok) {
      return failed(`Answer ${i + 1} of ${secret.log.length} was refused (${step.error.code}).`);
    }
    state = step.value.state;
    frames.push(frameOf(state, step.value.events));
  }
  if (state.public.status.kind === "active") return failed("The answer log ends before the game does.");
  if (canonical(state) !== canonical(secret.state)) return failed("The finished game does not match its move log.");
  return {
    ok: true,
    value: {
      matchId: record.matchId,
      ruleset: record.ruleset,
      players: copyJson(record.players),
      seedHash: record.seedHash,
      seed: secret.seed,
      setup: copyJson(secret.setup),
      log: copyJson(secret.log),
      status: copyJson(state.public.status),
      frames,
    },
  };
}
