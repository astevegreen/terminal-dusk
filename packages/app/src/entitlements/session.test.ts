// What the app knows the player owns (#686): loaded for a signed-in player only, free while signed out, loading or
// failed, and the last known answer kept when a later read fails. Wired to the real sign-in session and a fake
// Supabase.
import { describe, expect, it } from "vitest";
import { memoryStore } from "../platform/storage.ts";
import { SESSION_KEY, createSignIn } from "../online/signIn.ts";
import { START, STORED, settle } from "../online/test/signInRig.ts";
import type { Session } from "../transport/emailAuth.ts";
import { createEntitlementSession } from "./session.ts";
import { WEB_ROW, fakeEntitlements } from "./test/fakeEntitlements.ts";

const OWNS = { status: 200, body: [WEB_ROW] };

async function setUp(stored?: Session) {
  const fake = fakeEntitlements({ [STORED.refreshToken]: STORED.userId });
  const store = memoryStore();
  if (stored) await store.set(SESSION_KEY, JSON.stringify(stored));
  const clock = { now: START };
  const endpoint = { url: "https://fake.supabase.test", anonKey: "fake-anon-key", fetch: fake.fetch };
  const signIn = createSignIn({ auth: endpoint, store, now: () => clock.now });
  const entitlements = createEntitlementSession({ endpoint, signIn });
  return { fake, store, clock, signIn, entitlements };
}

const signInAsUserOne = async (signIn: ReturnType<typeof createSignIn>): Promise<void> => {
  await signIn.sendCode("ana@example.com");
  await signIn.enterCode("123456");
  await settle();
};

describe("a signed-out player (#686)", () => {
  it("is free, and no network request is made", async () => {
    const { fake, entitlements } = await setUp();
    entitlements.start();
    await settle();
    expect(entitlements.getSnapshot()).toEqual({ owned: [], state: "signedOut", known: false });
    await entitlements.reload();
    await settle();
    expect(fake.requests).toEqual([]);
  });
});

describe("a signed-in player (#686)", () => {
  it("is free while their rows load, then owns what the table says", async () => {
    const { fake, entitlements } = await setUp(STORED);
    fake.answerNext(OWNS);
    const release = fake.hold();
    entitlements.start();
    await settle();
    expect(entitlements.getSnapshot()).toEqual({ owned: [], state: "loading", known: false });
    release();
    await settle();
    expect(entitlements.getSnapshot()).toEqual({ owned: [WEB_ROW], state: "loaded", known: true });
    expect(fake.reads()).toHaveLength(1);
    expect(fake.reads()[0]!.url).toContain("player=eq.user-0");
  });

  it("tells its subscribers each time the answer changes", async () => {
    const { fake, entitlements } = await setUp(STORED);
    fake.answerNext(OWNS);
    const seen: string[] = [];
    entitlements.subscribe(() => seen.push(entitlements.getSnapshot().state));
    entitlements.start();
    await settle();
    expect(seen).toEqual(["loading", "loaded"]);
  });

  it("is free, with the failure said, when the first read fails; reload then asks again", async () => {
    const { fake, entitlements } = await setUp(STORED);
    fake.answerNext("throw");
    entitlements.start();
    await settle();
    expect(entitlements.getSnapshot()).toEqual({ owned: [], state: "failed", known: false });
    fake.answerNext(OWNS);
    await entitlements.reload();
    expect(entitlements.getSnapshot()).toEqual({ owned: [WEB_ROW], state: "loaded", known: true });
  });

  it("keeps the last known answer when a later read fails: an offline owner stays an owner", async () => {
    const { fake, entitlements } = await setUp(STORED);
    fake.answerNext(OWNS);
    entitlements.start();
    await settle();
    fake.answerNext("throw");
    await entitlements.reload();
    expect(entitlements.getSnapshot()).toEqual({ owned: [WEB_ROW], state: "failed", known: true });
  });

  it("drops what a later read no longer lists (a refund, then Restore)", async () => {
    const { fake, entitlements } = await setUp(STORED);
    fake.answerNext(OWNS);
    entitlements.start();
    await settle();
    await entitlements.reload();
    expect(entitlements.getSnapshot()).toEqual({ owned: [], state: "loaded", known: true });
  });

  it("is failed, not signed out, when the expired token can't be refreshed for a moment", async () => {
    const { fake, entitlements } = await setUp({ ...STORED, expiresAt: START - 1 });
    fake.auth.answerNext("throw");
    entitlements.start();
    await settle();
    expect(entitlements.getSnapshot()).toEqual({ owned: [], state: "failed", known: false });
    expect(fake.reads()).toEqual([]);
  });

  it("takes only the newest read when two overlap", async () => {
    const { fake, entitlements } = await setUp(STORED);
    const release = fake.hold();
    entitlements.start(); // answers: owns nothing
    await settle();
    fake.answerNext(OWNS);
    const second = entitlements.reload();
    await settle();
    release();
    await second;
    await settle();
    expect(entitlements.getSnapshot().owned).toEqual([WEB_ROW]);
  });

  it("reads once when started, stopped and started again (React's development double effect)", async () => {
    const { fake, entitlements } = await setUp(STORED);
    fake.answerNext(OWNS);
    entitlements.start()();
    entitlements.start();
    await settle();
    expect(fake.reads()).toHaveLength(1);
    expect(entitlements.getSnapshot().state).toBe("loaded");
  });
});

describe("signing in and out (#686)", () => {
  it("reads the rows after a sign-in", async () => {
    const { fake, signIn, entitlements } = await setUp();
    entitlements.start();
    await settle();
    fake.answerNext(OWNS);
    await signInAsUserOne(signIn);
    expect(entitlements.getSnapshot()).toEqual({ owned: [WEB_ROW], state: "loaded", known: true });
    expect(fake.reads()[0]!.url).toContain("player=eq.user-1");
  });

  it("forgets what was owned on sign-out, with no further read", async () => {
    const { fake, signIn, entitlements } = await setUp(STORED);
    fake.answerNext(OWNS);
    entitlements.start();
    await settle();
    await signIn.signOut();
    await settle();
    expect(entitlements.getSnapshot()).toEqual({ owned: [], state: "signedOut", known: false });
    expect(fake.reads()).toHaveLength(1);
  });

  it("never gives one player another's answer, even one that arrives late", async () => {
    const { fake, signIn, entitlements } = await setUp(STORED);
    fake.answerNext(OWNS);
    const release = fake.hold();
    entitlements.start();
    await settle();
    await signIn.signOut();
    await settle();
    release();
    await settle();
    expect(entitlements.getSnapshot()).toEqual({ owned: [], state: "signedOut", known: false });
    fake.answerNext("throw");
    await signInAsUserOne(signIn);
    expect(entitlements.getSnapshot()).toEqual({ owned: [], state: "failed", known: false });
  });
});
