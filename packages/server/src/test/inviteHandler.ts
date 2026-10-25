// Test helpers for the invite handler: O5a's in-memory invite world behind a store that counts its calls, fake
// sign-in by token, a clock, and submit-handler deps over the same matches so a created match can be played.
import type { Side } from "@terminal-dusk/engine";
import type { HttpReply } from "../http.ts";
import type { InviteHandlerDeps } from "../inviteHandler.ts";
import type { InviteStore } from "../inviteStore.ts";
import { later } from "../later.ts";
import type { SubmitHandlerDeps } from "../submitHandler.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER } from "./invites.ts";
import type { InviteWorld } from "./invites.ts";

export const THIRD = "third-tia";

/** Tokens the fake sign-in knows. */
export const INVITE_TOKENS: Record<string, string> = {
  "token-host": HOST,
  "token-joiner": JOINER,
  "token-third": THIRD,
};

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

export type InviteHandlerWorld = {
  world: InviteWorld;
  deps: InviteHandlerDeps;
  submitDeps: SubmitHandlerDeps;
  storeCalls: () => number;
  authCalls: string[];
};

/** O5a's invite world (codes CODE0001..., match ids match-1...) behind a counting store and fake sign-in. */
export function inviteHandlerWorld(randomHostSide: Side = "lio"): InviteHandlerWorld {
  const world = inviteWorld(randomHostSide);
  const { store, calls } = countingInvites(world.invites);
  const authCalls: string[] = [];
  let clock = INVITE_NOW;
  const authenticate = (token: string) =>
    later(() => {
      authCalls.push(token);
      return INVITE_TOKENS[token] ?? null;
    });
  const now = () => ++clock;
  return {
    world,
    deps: { ...world.deps, invites: store, authenticate, now },
    submitDeps: { ...world.submitDeps, authenticate, now },
    storeCalls: calls,
    authCalls,
  };
}

/** The reply's body as JSON. */
export const body = (reply: HttpReply): unknown => JSON.parse(reply.body);
