// A sign-in session wired to the fake Supabase Auth, a memory store and a hand-moved clock, for the tests.
import { AUTH_ANON_KEY, AUTH_URL, createFakeAuth } from "../../transport/test/fakeAuth.ts";
import type { FakeAuth } from "../../transport/test/fakeAuth.ts";
import type { Session } from "../../transport/emailAuth.ts";
import { memoryStore } from "../../platform/storage.ts";
import type { KeyValueStore } from "../../platform/storage.ts";
import { SESSION_KEY, createSignIn } from "../signIn.ts";
import type { SignIn, SignInSnapshot } from "../signIn.ts";

export const START = 10_000_000;
export const EMAIL = "ana@example.com";
export const CODE = "123456";

/** A stored session that has an hour left at START. */
export const STORED: Session = {
  accessToken: "access-0",
  refreshToken: "refresh-0",
  expiresAt: START + 3_600_000,
  userId: "user-0",
};

export type Rig = {
  fake: FakeAuth;
  store: KeyValueStore;
  clock: { now: number };
  signIn: SignIn;
  /** Every snapshot the session published, in order, starting with the first one. */
  seen: SignInSnapshot[];
};

export function rig(store: KeyValueStore = memoryStore()): Rig {
  const fake = createFakeAuth();
  const clock = { now: START };
  const signIn = createSignIn({
    auth: { url: AUTH_URL, anonKey: AUTH_ANON_KEY, fetch: fake.fetch },
    store,
    now: () => clock.now,
  });
  const seen: SignInSnapshot[] = [signIn.getSnapshot()];
  signIn.subscribe(() => seen.push(signIn.getSnapshot()));
  return { fake, store, clock, signIn, seen };
}

/** A rig whose store already holds `session` (or the raw text given). */
export async function rigWith(stored: Session | string): Promise<Rig> {
  const store = memoryStore();
  await store.set(SESSION_KEY, typeof stored === "string" ? stored : JSON.stringify(stored));
  return rig(store);
}

/** A rig that has started, sent a code to EMAIL and waits for the code. */
export async function rigOnCode(): Promise<Rig> {
  const r = rig();
  await r.signIn.start();
  await r.signIn.sendCode(EMAIL);
  return r;
}

/** Lets pending promise callbacks run. */
export const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

/** A memory store whose reads wait until the returned function is called. */
export function heldStore(base: KeyValueStore): { store: KeyValueStore; release: () => void } {
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    store: { ...base, get: async (key) => gate.then(() => base.get(key)) },
    release,
  };
}
