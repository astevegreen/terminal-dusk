// The end of a game: check it again from its seed and move log, then reveal the seed.
import { verifyGame } from "@terminal-dusk/engine";
import type { Answer, GameState, Ruleset } from "@terminal-dusk/engine";
import type { HostError, MatchSecret } from "./types.ts";

/** JSON with object keys sorted, so equal values match whatever order their keys arrived in. */
const canonical = (value: unknown): string | undefined =>
  JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) // keys are never equal
      : v,
  );

/**
 * Replays the whole game from the secret's seed and setup with `log`, and compares the result with
 * `state`. Returns null when they match, else a `verifyFailed` error whose message never holds the seed.
 */
export function checkFinished(
  ruleset: Ruleset,
  secret: MatchSecret,
  log: readonly Answer[],
  state: GameState,
): HostError | null {
  const verified = verifyGame(ruleset, secret.setup, secret.seed, log);
  if (!verified.ok) {
    return { code: "verifyFailed", message: `The finished game did not check out (${verified.error.code}).` };
  }
  if (canonical(verified.value.state) !== canonical(state)) {
    return { code: "verifyFailed", message: "The finished game does not match its move log." };
  }
  return null;
}
