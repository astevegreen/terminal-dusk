// The store contracts (test/contracts/) run against the Supabase stores on the local Supabase stack, as
// stores.contract.test.ts runs them against the in-memory stores. Without a running local stack, one test says
// so and how to start it.
import type { MatchConfig } from "@terminal-dusk/host";
import { onLocalStack, putIn, writeOf } from "./test/stack.ts";
import { inviteStoreContract } from "./test/contracts/inviteStore.ts";
import { matchStoreContract } from "./test/contracts/matchStore.ts";
import { notifyStoreContract } from "./test/contracts/notifyStore.ts";
import { inviteStack } from "./test/inviteStack.ts";
import { created } from "./test/match.ts";
import { SupabaseInviteStore } from "./supabaseInviteStore.ts";
import { SupabaseNotifyStore } from "./supabaseNotifyStore.ts";
import { SupabaseStore } from "./supabaseStore.ts";

const TIMEOUT = 60_000;

await onLocalStack("the Supabase stores keep the store contracts on the local Supabase stack", (keys) => {
  const stack = inviteStack(keys);
  /** A new game at seq 0 between test users, its id kept for clean-up. */
  const fresh = (players: MatchConfig["players"] = { lio: stack.host.id, sae: stack.joiner.id }) =>
    created(stack.matchId(), players);

  matchStoreContract(
    () => ({
      store: new SupabaseStore(stack.service),
      fresh: () => fresh(),
      putIn: (write) => putIn(stack.service, write),
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
});
