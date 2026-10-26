// The shared setup for the invite tests on the local Supabase stack: a service-role client and three fresh test
// users (a host with a "web" entitlement and two joiners with none) made before the tests, and every test
// entitlement, invite, match and user removed after them.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Side } from "@terminal-dusk/engine";
import { hostCreate } from "@terminal-dusk/host";
import type { HostResult, PlayerId } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { afterAll, beforeAll } from "vitest";
import type { InviteDeps } from "../invite.ts";
import { inviteCode } from "../inviteCode.ts";
import type { InviteStore } from "../inviteStore.ts";
import { client, type StackKeys } from "../migrations/localStack.ts";
import { SupabaseEntitlementStore } from "../supabaseEntitlementStore.ts";
import { SupabaseInviteStore } from "../supabaseInviteStore.ts";
import { cleanUp, freshMatchId, makeUser } from "./stack.ts";
import type { TestUser } from "./stack.ts";

export const STACK_SEED = "invite-stack-seed";

/** What an invite stack test file works with. `service` and the users can be read once `beforeAll` has run. */
export type InviteStack = {
  readonly service: SupabaseClient;
  readonly host: TestUser;
  readonly joiner: TestUser;
  readonly third: TestUser;
  /** Codes and match ids made so far, kept for clean-up. */
  readonly codes: string[];
  readonly matchIds: string[];
  /** Invite deps over `invites` (a SupabaseInviteStore by default) with fresh, kept codes and match ids. */
  deps(randomHostSide?: Side, invites?: InviteStore): InviteDeps;
  /** A fresh code, kept for clean-up. */
  code(): string;
  /** A fresh match id, kept for clean-up. */
  matchId(): string;
};

/** The match `joinInvite` makes for these players, id and time, with the stack seed. */
export function expectedStart(matchId: string, players: Record<Side, PlayerId>, now: number): HostResult {
  const made = hostCreate(firstDeckRuleset, { matchId, players, setup: firstDeckConfig().setup }, STACK_SEED, now);
  if (!made.ok) throw new Error(`hostCreate failed: ${made.error.code}`);
  return made.value;
}

/** Registers the `beforeAll` and `afterAll` of one invite stack test file; call it inside its `onLocalStack` block. */
export function inviteStack(keys: StackKeys): InviteStack {
  let service: SupabaseClient | undefined;
  const users: TestUser[] = [];
  const codes: string[] = [];
  const matchIds: string[] = [];

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    for (const name of ["host", "joiner", "third"]) users.push(await makeUser(keys, service, name));
    // The host owns the full game on the web, so it may create invites; the joiners own nothing.
    const granted = await service
      .from("entitlement")
      .insert({ player: user(0).id, platform: "web", source: "test", created_at: 0 });
    if (granted.error) throw new Error(`granting the test host an entitlement failed: ${granted.error.code}`);
  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    // Entitlements have no link to auth.users, so removing the users would leave them behind.
    if (users.length > 0)
      await service
        .from("entitlement")
        .delete()
        .in(
          "player",
          users.map((u) => u.id),
        );
    // Removing a match removes its invite; unjoined invites are removed by code.
    if (codes.length > 0) await service.from("match_invite").delete().in("code", codes);
    await cleanUp(service, matchIds, users);
  }, 60_000);

  const user = (i: number): TestUser => {
    const found = users[i];
    if (!found) throw new Error("the invite stack test setup has not run yet");
    return found;
  };

  const stack: InviteStack = {
    get service() {
      if (!service) throw new Error("the invite stack test setup has not run yet");
      return service;
    },
    get host() {
      return user(0);
    },
    get joiner() {
      return user(1);
    },
    get third() {
      return user(2);
    },
    codes,
    matchIds,
    code() {
      const code = inviteCode();
      codes.push(code);
      return code;
    },
    matchId() {
      const id = freshMatchId();
      matchIds.push(id);
      return id;
    },
    deps(randomHostSide = "lio", invites = new SupabaseInviteStore(stack.service)) {
      return {
        invites,
        entitlements: new SupabaseEntitlementStore(stack.service),
        code: () => stack.code(),
        matchId: () => stack.matchId(),
        seed: () => STACK_SEED,
        randomHostSide: () => randomHostSide,
      };
    },
  };
  return stack;
}
