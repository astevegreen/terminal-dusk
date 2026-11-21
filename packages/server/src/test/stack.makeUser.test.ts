// makeUser creates the auth user before signing it in; a sign-in that fails must not leave that user behind,
// since the caller never gets it to clean up (follow-up from the review of #531). A delete that fails as well
// must say which user was left behind (follow-up from agy on #564).
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { StackKeys } from "../migrations/localStack.ts";
import { makeUser } from "./stack.ts";

// Never dialled: every test hands makeUser a fake sign-in client.
const KEYS: StackKeys = { url: "http://stack.invalid", anonKey: "test-anon", serviceKey: "test-service" };

type DeleteAnswer = "ok" | "rejects" | "error";

/** A service client with only the two admin calls makeUser uses; `deleted` records each user id it deletes. */
function fakeService(options: { created?: boolean; deletes?: DeleteAnswer } = {}) {
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
      if (options.deletes === "rejects") return Promise.reject(new Error("fake delete failure"));
      if (options.deletes === "error")
        return Promise.resolve({ data: null, error: { message: "fake delete refusal" } });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { service: { auth: { admin } } as unknown as SupabaseClient, deleted };
}

/** A sign-in client that refuses every password; `made` records the url and key it was made with. */
function refusingSignIn() {
  const made: [string, string][] = [];
  const makeClient = (url: string, key: string) => {
    made.push([url, key]);
    const auth = {
      signInWithPassword: () =>
        Promise.resolve({ data: { user: null, session: null }, error: { message: "fake bad password" } }),
    };
    return { auth } as unknown as SupabaseClient;
  };
  return { makeClient, made };
}

describe("makeUser", () => {
  it("signs in with a client made from the stack's url and anon key", async () => {
    const f = fakeService();
    const s = refusingSignIn();
    await expect(makeUser(KEYS, f.service, "alice", s.makeClient)).rejects.toThrow("fake bad password");
    expect(s.made).toEqual([[KEYS.url, KEYS.anonKey]]);
  });

  it("deletes the user it created when the sign-in fails, and says the sign-in failed", async () => {
    const f = fakeService();
    const made = makeUser(KEYS, f.service, "alice", refusingSignIn().makeClient);
    await expect(made).rejects.toThrow("could not sign in the alice test user: fake bad password");
    await expect(made).rejects.not.toThrow("left behind");
    expect(f.deleted).toEqual(["user-1"]);
  });

  it("a delete that rejects as well still reports the sign-in failure, and names the user left behind", async () => {
    const f = fakeService({ deletes: "rejects" });
    const made = makeUser(KEYS, f.service, "alice", refusingSignIn().makeClient);
    await expect(made).rejects.toThrow("could not sign in the alice test user: fake bad password");
    await expect(made).rejects.toThrow("test user user-1 was left behind: fake delete failure");
    expect(f.deleted).toEqual(["user-1"]);
  });

  it("a delete that answers with an error still reports the sign-in failure, and names the user left behind", async () => {
    const f = fakeService({ deletes: "error" });
    const made = makeUser(KEYS, f.service, "alice", refusingSignIn().makeClient);
    await expect(made).rejects.toThrow("could not sign in the alice test user: fake bad password");
    await expect(made).rejects.toThrow("test user user-1 was left behind: fake delete refusal");
    expect(f.deleted).toEqual(["user-1"]);
  });

  it("a refused create deletes nothing and makes no sign-in client", async () => {
    const f = fakeService({ created: false });
    const s = refusingSignIn();
    await expect(makeUser(KEYS, f.service, "alice", s.makeClient)).rejects.toThrow(
      "could not create the alice test user",
    );
    expect(f.deleted).toEqual([]);
    expect(s.made).toEqual([]);
  });
});
