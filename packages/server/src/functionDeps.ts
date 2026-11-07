// The deps the submit and invite Edge Functions serve with, built from one service-role client. Kept here, not in
// the Deno entries, so what they wire is tested (functionDeps.test.ts): above all the notify store, without
// which no turn alert is ever queued.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ruleset } from "@terminal-dusk/engine";
import { supabaseAuthenticate } from "./edge.ts";
import type { InviteDeps } from "./invite.ts";
import type { InviteHandlerDeps } from "./inviteHandler.ts";
import type { SubmitHandlerDeps } from "./submitHandler.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { SupabaseInviteStore } from "./supabaseInviteStore.ts";
import { SupabaseNotifyStore } from "./supabaseNotifyStore.ts";
import { SupabaseStore } from "./supabaseStore.ts";

/** The submit function's deps: the rulesets it runs, the clock and its logger (match ids and seqs only). */
export function submitFunctionDeps(
  db: SupabaseClient,
  runtime: { rulesets: readonly Ruleset[]; now: () => number; log: (line: string) => void },
): SubmitHandlerDeps {
  return {
    store: new SupabaseStore(db),
    notify: new SupabaseNotifyStore(db),
    ruleset: (id) => runtime.rulesets.find((ruleset) => ruleset.id === id),
    authenticate: supabaseAuthenticate(db),
    now: runtime.now,
    log: runtime.log,
  };
}

/** The invite function's deps: the clock and the secure random parts (`secureInviteRandom`). */
export function inviteFunctionDeps(
  db: SupabaseClient,
  runtime: { now: () => number; random: Pick<InviteDeps, "matchId" | "seed" | "randomHostSide"> },
): InviteHandlerDeps {
  return {
    invites: new SupabaseInviteStore(db),
    entitlements: new SupabaseEntitlementStore(db),
    notify: new SupabaseNotifyStore(db),
    ...runtime.random,
    authenticate: supabaseAuthenticate(db),
    now: runtime.now,
  };
}
