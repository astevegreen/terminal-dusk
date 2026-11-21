// makeUser creates the auth user before signing it in; a sign-in that fails must not leave that user behind,
// since the caller never gets it to clean up (follow-up from the review of #531).
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { StackKeys } from "../migrations/localStack.ts";
import { makeUser } from "./stack.ts";

// Nothing listens here, so every sign-in fails at once without a stack.
const NOWHERE: StackKeys = { url: "http://127.0.0.1:9", anonKey: "test-anon", serviceKey: "test-service" };

/** A service client with only the two admin calls makeUser uses; `deleted` records each user id it deletes. */
function fakeService(options: { created?: boolean; deleteFails?: boolean } = {}) {
  const deleted: string[] = [];
  const admin = {
    createUser: () =>
      Promise.resolve(
        options.created === false
          ? { data: { user: null }, error: { message: "fake refusal" } }
          : { data: { user: { id: "user-1" } }, error: null },
      ),
    deleteUser: (id: string) => {
      deleted.push(id);
      return options.deleteFails ? Promise.reject(new Error("fake delete failure")) : Promise.resolve({ error: null });
    },
  };
  return { service: { auth: { admin } } as unknown as SupabaseClient, deleted };
}

describe("makeUser", () => {
  it("deletes the user it created when the sign-in fails, and says the sign-in failed", async () => {
    const f = fakeService();
    await expect(makeUser(NOWHERE, f.service, "alice")).rejects.toThrow("could not sign in the alice test user");
    expect(f.deleted).toEqual(["user-1"]);
  });

  it("a delete that fails as well still reports the sign-in failure", async () => {
    const f = fakeService({ deleteFails: true });
    await expect(makeUser(NOWHERE, f.service, "alice")).rejects.toThrow("could not sign in the alice test user");
    expect(f.deleted).toEqual(["user-1"]);
  });

  it("a refused create deletes nothing", async () => {
    const f = fakeService({ created: false });
    await expect(makeUser(NOWHERE, f.service, "alice")).rejects.toThrow("could not create the alice test user");
    expect(f.deleted).toEqual([]);
  });
});
