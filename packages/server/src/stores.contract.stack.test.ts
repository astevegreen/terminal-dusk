// The store contracts (test/contracts/) run against the Supabase stores on the local Supabase stack, as
// stores.contract.test.ts runs them against the in-memory stores. Without a running local stack, one test says
// so and how to start it.
import type { MatchConfig } from "@terminal-dusk/host";
import { freshId } from "./migrations/localStack.ts";
import { onLocalStack, putIn, writeOf } from "./test/stack.ts";
import { deadlineStoreContract } from "./test/contracts/deadlineStore.ts";
import { entitlementChargebacksContract } from "./test/contracts/entitlementChargebacks.ts";
import { entitlementReceiptsContract } from "./test/contracts/entitlementReceipts.ts";
import { inviteStoreContract } from "./test/contracts/inviteStore.ts";
import { matchStoreContract } from "./test/contracts/matchStore.ts";
import { notifyStoreContract } from "./test/contracts/notifyStore.ts";
import { createdWithClock } from "./test/deadlines.ts";
import { inviteStack } from "./test/inviteStack.ts";
import { created } from "./test/match.ts";
import { receiptRows } from "./test/receiptRows.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { SupabaseInviteStore } from "./supabaseInviteStore.ts";
import { SupabaseNotifyStore } from "./supabaseNotifyStore.ts";
import { SupabaseStore } from "./supabaseStore.ts";

const TIMEOUT = 60_000;

await onLocalStack("the Supabase stores keep the store contracts on the local Supabase stack", (keys) => {
  const stack = inviteStack(keys);
  const receipts = receiptRows(() => stack.service);
  /** A new game at seq 0 between test users, its id kept for clean-up. */
  const fresh = (players: MatchConfig["players"] = { lio: stack.host.id, sae: stack.joiner.id }) =>
    created(stack.matchId(), players);

  matchStoreContract(
    () => ({
      store: new SupabaseStore(stack.service),
      fresh: () => fresh(),
      putIn: (write) => putIn(stack.service, write),
      forgetRatings: async (players) => {
        await stack.service
          .from("rating")
          .delete()
          .in("player", [...players]);
        await stack.service
          .from("rating_change")
          .delete()
          .in("player", [...players]);
      },
      changesOf: async (matchId) => {
        const { data } = await stack.service
          .from("rating_change")
          .select("match_id, player, rating_before, rating_after, ranked_games, created_at")
          .eq("match_id", matchId)
          .order("player");
        return data ?? [];
      },
    }),
    TIMEOUT,
  );

  inviteStoreContract(
    () => ({
      store: new SupabaseInviteStore(stack.service),
      matches: new SupabaseStore(stack.service),
      host: stack.host.id,
      joiner: stack.joiner.id,
      third: stack.third.id,
      code: () => stack.code(),
      write: (players) => writeOf(fresh(players)),
    }),
    TIMEOUT,
  );

  notifyStoreContract(
    () => ({
      store: new SupabaseNotifyStore(stack.service),
      players: [stack.host.id, stack.joiner.id],
      matches: async (count) => {
        const ids: string[] = [];
        for (let i = 0; i < count; i += 1) {
          const game = fresh();
          await putIn(stack.service, writeOf(game));
          ids.push(game.record.matchId);
        }
        return ids;
      },
    }),
    TIMEOUT,
  );

  const stackReceipts = () => ({
    store: new SupabaseEntitlementStore(stack.service),
    player: () => freshId(),
    receipt: receipts.fresh,
    unmatched: receipts.unmatched,
  });
  entitlementReceiptsContract(stackReceipts, TIMEOUT);
  entitlementChargebacksContract(stackReceipts, TIMEOUT);

  deadlineStoreContract(
    () => ({
      store: new SupabaseStore(stack.service),
      players: [stack.host.id, stack.joiner.id],
      clocked: (rule, at) => createdWithClock(stack.matchId(), rule, at, { lio: stack.host.id, sae: stack.joiner.id }),
      plain: () => fresh(),
      unknownId: () => stack.matchId(),
      putIn: (write) => putIn(stack.service, write),
    }),
    TIMEOUT,
  );
});
