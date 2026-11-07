// The deps the submit and invite Edge Functions serve with. The Deno entries only call these, so what they wire
// is checked here: above all that both pass a notify store, or no turn alert is ever queued in production.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ruleset } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { inviteFunctionDeps, submitFunctionDeps } from "./functionDeps.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { SupabaseInviteStore } from "./supabaseInviteStore.ts";
import { SupabaseNotifyStore } from "./supabaseNotifyStore.ts";
import { SupabaseStore } from "./supabaseStore.ts";

// Building the deps makes no call, so a stand-in client with nothing in it is enough.
const db = {} as unknown as SupabaseClient;
const ruleset = { id: "first-deck" } as unknown as Ruleset;

describe("submitFunctionDeps", () => {
  const deps = submitFunctionDeps(db, { rulesets: [ruleset], now: () => 7, log: () => {} });

  it("queues turn alerts: it passes a notify store on the same client", () => {
    expect(deps.notify).toBeInstanceOf(SupabaseNotifyStore);
  });

  it("saves through SupabaseStore and finds only the rulesets it was given", () => {
    expect(deps.store).toBeInstanceOf(SupabaseStore);
    expect(deps.ruleset("first-deck" as Ruleset["id"])).toBe(ruleset);
    expect(deps.ruleset("unknown" as Ruleset["id"])).toBeUndefined();
    expect(deps.now()).toBe(7);
  });
});

describe("inviteFunctionDeps", () => {
  const random = { matchId: () => "m", seed: () => "s", randomHostSide: () => "lio" as const };
  const deps = inviteFunctionDeps(db, { now: () => 9, random });

  it("queues the new match's turn alerts on joining: it passes a notify store", () => {
    expect(deps.notify).toBeInstanceOf(SupabaseNotifyStore);
  });

  it("uses the Supabase invite and entitlement stores, the given random parts and clock", () => {
    expect(deps.invites).toBeInstanceOf(SupabaseInviteStore);
    expect(deps.entitlements).toBeInstanceOf(SupabaseEntitlementStore);
    expect([deps.matchId(), deps.seed(), deps.randomHostSide(), deps.now()]).toEqual(["m", "s", "lio", 9]);
  });
});
