// The shared setup for the entitlement tests on the local Supabase stack: a service-role client and two fresh test
// users made before the tests, and their entitlement rows and the users removed after them. The entitlement table
// has no foreign key to the users, so deleting a user does not remove its rows: they are deleted first.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll } from "vitest";
import { client, type StackKeys } from "../migrations/localStack.ts";
import { cleanUp, makeUser } from "./stack.ts";
import type { TestUser } from "./stack.ts";

/** What an entitlement stack test file works with, once `beforeAll` has run. */
export type EntitlementStack = {
  readonly service: SupabaseClient;
  readonly owner: TestUser;
  readonly other: TestUser;
};

/** An entitlement row as the service role inserts it. */
export type EntitlementInsert = {
  player: string;
  platform: string | null;
  source: string | null;
  receipt_ref?: string | null;
  created_at: number;
  id?: string;
};

/** Registers the `beforeAll` and `afterAll` of one entitlement stack test file; call it inside `onLocalStack`. */
export function entitlementStack(keys: StackKeys): EntitlementStack {
  let service: SupabaseClient | undefined;
  const users: TestUser[] = [];

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    for (const name of ["owner", "other"]) users.push(await makeUser(keys, service, name));
  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    if (users.length > 0)
      await service
        .from("entitlement")
        .delete()
        .in(
          "player",
          users.map((u) => u.id),
        );
    await cleanUp(service, [], users);
  }, 60_000);

  const ready = <T>(value: T | undefined): T => {
    if (value === undefined) throw new Error("the entitlement stack test setup has not run yet");
    return value;
  };
  return {
    get service() {
      return ready(service);
    },
    get owner() {
      return ready(users[0]);
    },
    get other() {
      return ready(users[1]);
    },
  };
}
