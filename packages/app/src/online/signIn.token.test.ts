import { describe, expect, it } from "vitest";
import { memoryStore } from "../platform/storage.ts";
import { SESSION_KEY } from "./signIn.ts";
import { CODE, EMAIL, STORED, heldStore, rig, rigOnCode, rigWith, settle } from "./test/signInRig.ts";

describe("createSignIn: accessToken", () => {
  it("returns null unless signed in", async () => {
    const r = rig();
    expect(await r.signIn.accessToken()).toBeNull();
    await r.signIn.start();
    expect(await r.signIn.accessToken()).toBeNull();
    await r.signIn.sendCode(EMAIL);
    expect(await r.signIn.accessToken()).toBeNull();
    expect(r.fake.requests).toHaveLength(1);
  });

  it("returns the session's token while it is fresh, with no request", async () => {
    const r = await rigWith(STORED);
    await r.signIn.start();
    expect(await r.signIn.accessToken()).toBe("access-0");
    expect(r.fake.requests).toHaveLength(0);
  });

  it("refreshes a session near expiry and saves the refreshed session to the store", async () => {
    const r = await rigWith(STORED);
    await r.signIn.start();
    r.clock.now = STORED.expiresAt;
    expect(await r.signIn.accessToken()).toBe("access-r1");
    await settle();
    expect(JSON.parse((await r.store.get(SESSION_KEY)) ?? "null")).toEqual({
      accessToken: "access-r1",
      refreshToken: "refresh-r1",
      expiresAt: STORED.expiresAt + 3_600_000,
      userId: "user-1",
    });
    expect(r.signIn.getSnapshot()).toEqual({ kind: "signedIn", userId: "user-0", busy: false, refusal: null });
  });

  it("a failed refresh removes the session and the snapshot becomes email", async () => {
    const r = await rigWith(STORED);
    await r.signIn.start();
    r.clock.now = STORED.expiresAt;
    r.fake.answerNext({ status: 400, body: { msg: "Invalid Refresh Token" } });
    expect(await r.signIn.accessToken()).toBeNull();
    await settle();
    expect(await r.store.get(SESSION_KEY)).toBeNull();
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: null });
  });
});

describe("createSignIn: late results are ignored", () => {
  it("a refresh that resolves after signOut changes no snapshot and stores nothing", async () => {
    const r = await rigWith(STORED);
    await r.signIn.start();
    r.clock.now = STORED.expiresAt;
    const release = r.fake.hold();
    const token = r.signIn.accessToken();
    await settle();
    await r.signIn.signOut();
    const seenAtSignOut = r.seen.length;
    release();
    expect(await token).toBeNull();
    await settle();
    expect(r.fake.requests).toHaveLength(1);
    expect(await r.store.get(SESSION_KEY)).toBeNull();
    expect(r.seen).toHaveLength(seenAtSignOut);
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: null });
  });

  it("a failed refresh that resolves after signOut changes no snapshot", async () => {
    const r = await rigWith(STORED);
    await r.signIn.start();
    r.clock.now = STORED.expiresAt;
    r.fake.answerNext({ status: 400, body: {} });
    const release = r.fake.hold();
    const token = r.signIn.accessToken();
    await settle();
    await r.signIn.signOut();
    const seenAtSignOut = r.seen.length;
    release();
    expect(await token).toBeNull();
    await settle();
    expect(r.seen).toHaveLength(seenAtSignOut);
  });

  it("an enterCode that resolves after useOtherEmail changes no snapshot and stores nothing", async () => {
    const r = await rigOnCode();
    const release = r.fake.hold();
    const pending = r.signIn.enterCode(CODE);
    await settle();
    r.signIn.useOtherEmail();
    const seenAtSwitch = r.seen.length;
    release();
    await pending;
    expect(r.seen).toHaveLength(seenAtSwitch);
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: null });
    expect(await r.store.get(SESSION_KEY)).toBeNull();
  });

  it("a resendCode that resolves after useOtherEmail changes no snapshot", async () => {
    const r = await rigOnCode();
    r.fake.answerNext({ status: 429, body: {} });
    const release = r.fake.hold();
    const pending = r.signIn.resendCode();
    await settle();
    r.signIn.useOtherEmail();
    const seenAtSwitch = r.seen.length;
    release();
    await pending;
    expect(r.seen).toHaveLength(seenAtSwitch);
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: null });
  });

  it("a sendCode that resolves after signOut changes no snapshot", async () => {
    const r = rig();
    await r.signIn.start();
    const release = r.fake.hold();
    const pending = r.signIn.sendCode(EMAIL);
    await settle();
    await r.signIn.signOut();
    const seenAtSignOut = r.seen.length;
    release();
    await pending;
    expect(r.seen).toHaveLength(seenAtSignOut);
    expect(r.signIn.getSnapshot().kind).toBe("email");
  });

  it("a start that resolves after signOut changes no snapshot", async () => {
    const base = memoryStore();
    await base.set(SESSION_KEY, JSON.stringify(STORED));
    const held = heldStore(base);
    const r = rig(held.store);
    const pending = r.signIn.start();
    await settle();
    await r.signIn.signOut();
    const seenAtSignOut = r.seen.length;
    held.release();
    await pending;
    expect(r.seen).toHaveLength(seenAtSignOut);
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: null });
    expect(await base.get(SESSION_KEY)).toBeNull();
  });
});

describe("createSignIn: secrets", () => {
  it("no snapshot in a full sign-in contains the code, an access token or a refresh token", async () => {
    const r = rig();
    await r.signIn.start();
    r.fake.answerNext({ status: 400, body: {} });
    await r.signIn.sendCode(EMAIL);
    await r.signIn.sendCode(EMAIL);
    r.fake.answerNext({ status: 403, body: {} });
    await r.signIn.enterCode(CODE);
    await r.signIn.resendCode();
    await r.signIn.enterCode(CODE);
    r.clock.now += 3_600_000;
    expect(await r.signIn.accessToken()).toBe("access-r1");
    await settle();
    await r.signIn.signOut();
    expect(r.seen.map((s) => s.kind)).toContain("signedIn");
    const text = JSON.stringify(r.seen);
    for (const secret of [CODE, "access-1", "refresh-1", "access-r1", "refresh-r1"]) {
      expect(text).not.toContain(secret);
    }
  });
});
