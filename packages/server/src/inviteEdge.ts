// The glue between the runtime's fetch-style requests and `handleInvite`, and the secure random parts a live
// invite needs (a match id, a seed and the host's side in a random invite). Kept here, not in the Deno entry,
// so it is tested.
import type { Side } from "@terminal-dusk/engine";
import { serveFetch } from "./edge.ts";
import type { FetchRequest, MakeResponse } from "./edge.ts";
import type { InviteDeps } from "./invite.ts";
import { handleInvite } from "./inviteHandler.ts";
import type { InviteHandlerDeps } from "./inviteHandler.ts";

/** The one part of the Web Crypto API used here. The packages' compiler settings name no DOM or Node types. */
type RandomSource = { getRandomValues(array: Uint8Array): Uint8Array };

/** A fetch-style handler around `handleInvite`. An unreadable body counts as an empty one (a 400 for POST). */
export function inviteFetchHandler<R>(
  deps: InviteHandlerDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return serveFetch((request) => handleInvite(deps, request), respond);
}

/** `count` random bytes from `source`, as lowercase hex. */
const hex = (source: RandomSource, count: number): string =>
  Array.from(source.getRandomValues(new Uint8Array(count)), (byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * The random parts of the invite deps, drawn from `source` (the global `crypto` by default): a 32-character
 * match id, a 64-character seed, and the host's side in a random invite (each side equally likely).
 */
export function secureInviteRandom(
  source: RandomSource = (globalThis as unknown as { crypto: RandomSource }).crypto,
): Pick<InviteDeps, "matchId" | "seed" | "randomHostSide"> {
  return {
    matchId: () => hex(source, 16),
    seed: () => hex(source, 32),
    randomHostSide: (): Side => ((source.getRandomValues(new Uint8Array(1))[0]! & 1) === 0 ? "lio" : "sae"),
  };
}
