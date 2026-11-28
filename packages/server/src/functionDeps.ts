// The deps the submit, invite and redeem Edge Functions serve with, built from one service-role client. Kept here, not in
// the Deno entries, so what they wire is tested (functionDeps.test.ts): above all the notify store, without
// which no turn alert is ever queued.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ruleset } from "@terminal-dusk/engine";
import { supabaseAuthenticate } from "./edge.ts";
import type { InviteDeps } from "./invite.ts";
import type { InviteHandlerDeps } from "./inviteHandler.ts";
import type { RedeemHandlerDeps } from "./redeemHandler.ts";
import type { SeekHandlerDeps } from "./seekHandler.ts";
import type { SubmitHandlerDeps } from "./submitHandler.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { SupabaseGiftCodeStore } from "./supabaseGiftCodeStore.ts";
import { SupabaseInviteStore } from "./supabaseInviteStore.ts";
import { SupabaseNotifyStore } from "./supabaseNotifyStore.ts";
import { SupabaseSeekStore } from "./supabaseSeekStore.ts";
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

/** The seek function's deps: the ticket store, the entitlements and ratings it reads, the clock and a ticket id source. */
export function seekFunctionDeps(
  db: SupabaseClient,
  runtime: { now: () => number; ticketId: () => string },
): SeekHandlerDeps {
  return {
    seeks: new SupabaseSeekStore(db),
    entitlements: new SupabaseEntitlementStore(db),
    matches: new SupabaseStore(db),
    ticketId: runtime.ticketId,
    authenticate: supabaseAuthenticate(db),
    now: runtime.now,
  };
}

/** The redeem function's deps: the gift code store on the same client, the clock and its logger (outcomes only). */
export function redeemFunctionDeps(
  db: SupabaseClient,
  runtime: { now: () => number; log: (line: string) => void },
): RedeemHandlerDeps {
  return { codes: new SupabaseGiftCodeStore(db), authenticate: supabaseAuthenticate(db), ...runtime };
}
