// Test helpers for the invite handler: O5a's in-memory invite world behind a store that counts its calls,
// fake sign-in by token, a clock, and the submit handler's deps over the same matches.
import type { Side } from "@terminal-dusk/engine";
import type { InviteHandlerDeps } from "../inviteHandler.ts";
import type { InviteStore } from "../inviteStore.ts";
import type { SubmitHandlerDeps } from "../submitHandler.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER } from "./invites.ts";
import type { InviteWorld } from "./invites.ts";

/** Tokens the fake sign-in knows: the host, the joiner and a third player. */
export const INVITE_TOKENS: Record<string, string> = {
  "token-host": HOST,
  "token-joiner": JOINER,
  "token-third": "third-tess",
};

/** A token for each player id in INVITE_TOKENS. */
export const tokenOf = (player: string): string =>
  Object.keys(INVITE_TOKENS).find((token) => INVITE_TOKENS[token] === player)!;

/** An invite store wrapper that counts every save, find and accept. */
export function countingInvites(inner: InviteStore): { store: InviteStore; calls: () => number } {
  let calls = 0;
  return {
    store: {
      save(invite) {
        calls++;
        return inner.save(invite);
      },
      find(code) {
        calls++;
        return inner.find(code);
      },
      accept(code, joiner, write) {
        calls++;
        return inner.accept(code, joiner, write);
      },
    },
    calls: () => calls,
  };
}

export type InviteHandlerWorld = InviteWorld & {
  handlerDeps: InviteHandlerDeps;
  /** The submit handler's deps over the same matches, signing in with the same tokens. */
  submitHandlerDeps: SubmitHandlerDeps;
  storeCalls: () => number;
};

const authenticate = async (token: string) => INVITE_TOKENS[token] ?? null;

/** O5a's invite world (codes CODE0001..., match ids match-1..., seeds seed-1...) behind the invite handler. */
export function inviteHandlerWorld(randomHostSide: Side = "lio"): InviteHandlerWorld {
  const world = inviteWorld(randomHostSide);
  const { store, calls } = countingInvites(world.invites);
  let clock = INVITE_NOW;
  const now = () => ++clock;
  return {
    ...world,
    handlerDeps: { ...world.deps, invites: store, authenticate, now },
    submitHandlerDeps: { ...world.submitDeps, authenticate, now },
    storeCalls: calls,
  };
}
