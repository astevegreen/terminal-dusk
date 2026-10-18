// Starting a match: checks the config, creates the game with the engine, and splits the result into
// what everyone may read (the record), what only the host may read (the secret) and one frame per viewer.
import { createGame, pendingFor, seedHash, SIDES } from "@terminal-dusk/engine";
import type { Ruleset, Seed, Setup } from "@terminal-dusk/engine";
import { copyJson, framesFor } from "./frames.ts";
import type { HostEffect, HostError, HostOutcome, MatchConfig } from "./types.ts";

/**
 * Starts a match. The ruleset comes first, as in the engine's apply, and only its id is stored. `now`
 * is the time as a whole number. Bad input returns an error; it never throws, and never changes its inputs.
 */
export function hostCreate(ruleset: Ruleset, config: MatchConfig, seed: Seed, now: number): HostOutcome {
  const bad = configError(config) ?? timeError(now);
  if (bad) return { ok: false, error: bad };
  // A seed that is not text gets no fingerprint here; createGame then refuses it as invalidSeed.
  const setup: Setup = copyJson({ ...config.setup, seedHash: typeof seed === "string" ? seedHash(seed) : "" });
  const created = createGame(ruleset, setup, seed);
  if (!created.ok) return { ok: false, error: created.error };
  const { state, events } = created.value;
  const players = { lio: config.players.lio, sae: config.players.sae };
  return {
    ok: true,
    value: {
      record: {
        matchId: config.matchId,
        players,
        ruleset: state.meta.ruleset,
        seedHash: state.meta.seedHash,
        seq: state.meta.seq,
        status: copyJson(state.public.status),
        createdAt: now,
        updatedAt: now,
      },
      secret: { seed, setup, state, log: [] },
      frames: framesFor(config.matchId, state, events),
      effects: SIDES.filter((side) => pendingFor(state, side) !== null).map((side): HostEffect => ({
        notify: players[side],
      })),
    },
  };
}

/** Why the config is unusable, or null: an empty match id, a missing or empty player id, one player on both sides. */
function configError(config: MatchConfig): HostError | null {
  if (typeof config?.matchId !== "string" || config.matchId.length === 0) {
    return invalidConfig("The match needs a matchId.");
  }
  for (const side of SIDES) {
    const player: unknown = config.players?.[side];
    if (typeof player !== "string" || player.length === 0) return invalidConfig(`The ${side} side needs a player id.`);
  }
  if (config.players.lio === config.players.sae) return invalidConfig("One player cannot play both sides.");
  return null;
}

/** Why `now` is unusable, or null: it must be a whole number, 0 or more. */
function timeError(now: number): HostError | null {
  if (Number.isInteger(now) && now >= 0) return null;
  return { code: "invalidTime", message: "The time must be a whole number, 0 or more." };
}

const invalidConfig = (message: string): HostError => ({ code: "invalidConfig", message });
