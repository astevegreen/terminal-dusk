import { describe, expect, it } from "vitest";
import { webStore } from "../platform/storage.ts";
import { SESSION_KEY } from "./signIn.ts";
import { CODE, EMAIL, START, STORED, rig, rigOnCode, rigWith, settle } from "./test/signInRig.ts";

const blocked = webStore({
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
});

describe("createSignIn: start", () => {
  it("begins on loading, not busy, with no refusal", () => {
    expect(rig().signIn.getSnapshot()).toEqual({ kind: "loading", busy: false, refusal: null });
  });

  it("a well-formed stored session gives signedIn with its userId", async () => {
    const r = await rigWith(STORED);
    await r.signIn.start();
    expect(r.signIn.getSnapshot()).toEqual({ kind: "signedIn", userId: "user-0", busy: false, refusal: null });
    expect(r.fake.requests).toHaveLength(0);
  });

  it("a missing session gives email", async () => {
    const r = rig();
    await r.signIn.start();
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: null });
  });

  it("unreadable storage gives email, and nothing rejects", async () => {
    const r = rig(blocked);
    await r.signIn.start();
    expect(r.signIn.getSnapshot().kind).toBe("email");
    await r.signIn.signOut();
  });

  const malformed: [string, string][] = [
    ["not JSON", "{oops"],
    ["not an object", "42"],
    ["an empty access token", JSON.stringify({ ...STORED, accessToken: "" })],
    ["an empty refresh token", JSON.stringify({ ...STORED, refreshToken: "" })],
    ["an empty userId", JSON.stringify({ ...STORED, userId: "" })],
    ["a missing userId", JSON.stringify({ ...STORED, userId: undefined })],
    ["a fractional expiresAt", JSON.stringify({ ...STORED, expiresAt: 1.5 })],
    ["a string expiresAt", JSON.stringify({ ...STORED, expiresAt: "1000" })],
    ["an unsafe expiresAt", JSON.stringify({ ...STORED, expiresAt: 2 ** 60 })],
  ];
  for (const [name, raw] of malformed) {
    it(`a malformed session (${name}) gives email and is removed`, async () => {
      const r = await rigWith(raw);
      await r.signIn.start();
      expect(r.signIn.getSnapshot().kind).toBe("email");
      expect(await r.store.get(SESSION_KEY)).toBeNull();
    });
  }
});

describe("createSignIn: sendCode", () => {
  it("calls requestCode once and moves to code for that address", async () => {
    const r = rig();
    await r.signIn.start();
    await r.signIn.sendCode(EMAIL);
    expect(r.fake.requests).toHaveLength(1);
    expect(r.fake.requests[0]?.url).toContain("/auth/v1/otp");
    expect(r.fake.requests[0]?.body).toEqual({ email: EMAIL, create_user: true });
    expect(r.signIn.getSnapshot()).toEqual({ kind: "code", email: EMAIL, busy: false, refusal: null });
  });

  it("on refusal stays on email with the refusal code", async () => {
    const r = rig();
    await r.signIn.start();
    await r.signIn.sendCode("not an email");
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: "badEmail" });
    r.fake.answerNext({ status: 429, body: {} });
    await r.signIn.sendCode(EMAIL);
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: "tooManyRequests" });
  });

  it("a second sendCode while busy sends no request", async () => {
    const r = rig();
    await r.signIn.start();
    const release = r.fake.hold();
    const first = r.signIn.sendCode(EMAIL);
    await settle();
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: true, refusal: null });
    await r.signIn.sendCode(EMAIL);
    release();
    await first;
    expect(r.fake.requests).toHaveLength(1);
    expect(r.signIn.getSnapshot().kind).toBe("code");
  });
});

describe("createSignIn: enterCode", () => {
  it("calls verifyCode, stores the session as JSON and moves to signedIn", async () => {
    const r = await rigOnCode();
    r.clock.now = START + 5_000;
    await r.signIn.enterCode(CODE);
    expect(r.fake.requests[1]?.url).toContain("/auth/v1/verify");
    expect(r.fake.requests[1]?.body).toEqual({ type: "email", email: EMAIL, token: CODE });
    const raw = await r.store.get(SESSION_KEY);
    expect(JSON.parse(raw ?? "null")).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: START + 5_000 + 3_600_000,
      userId: "user-1",
    });
    expect(r.signIn.getSnapshot()).toEqual({ kind: "signedIn", userId: "user-1", busy: false, refusal: null });
  });

  it("on refusal stays on code with the refusal", async () => {
    const r = await rigOnCode();
    r.fake.answerNext({ status: 403, body: { msg: "Token has expired or is invalid" } });
    await r.signIn.enterCode(CODE);
    expect(r.signIn.getSnapshot()).toEqual({ kind: "code", email: EMAIL, busy: false, refusal: "wrongCode" });
    await r.signIn.enterCode("12");
    expect(r.signIn.getSnapshot()).toEqual({ kind: "code", email: EMAIL, busy: false, refusal: "badCode" });
    expect(await r.store.get(SESSION_KEY)).toBeNull();
  });

  it("a second enterCode while busy sends no request", async () => {
    const r = await rigOnCode();
    const release = r.fake.hold();
    const first = r.signIn.enterCode(CODE);
    await settle();
    expect(r.signIn.getSnapshot().busy).toBe(true);
    await r.signIn.enterCode(CODE);
    release();
    await first;
    expect(r.fake.requests).toHaveLength(2);
    expect(r.signIn.getSnapshot().kind).toBe("signedIn");
  });
});

describe("createSignIn: useOtherEmail and resendCode", () => {
  it("useOtherEmail goes back to email with no refusal", async () => {
    const r = await rigOnCode();
    r.fake.answerNext({ status: 403, body: {} });
    await r.signIn.enterCode(CODE);
    r.signIn.useOtherEmail();
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: null });
  });

  it("resendCode asks for a new code for the same address and stays on code", async () => {
    const r = await rigOnCode();
    await r.signIn.resendCode();
    expect(r.fake.requests).toHaveLength(2);
    expect(r.fake.requests[1]?.body).toEqual({ email: EMAIL, create_user: true });
    expect(r.signIn.getSnapshot()).toEqual({ kind: "code", email: EMAIL, busy: false, refusal: null });
  });

  it("resendCode sets busy while it runs and sends nothing while busy", async () => {
    const r = await rigOnCode();
    const release = r.fake.hold();
    const first = r.signIn.resendCode();
    await settle();
    expect(r.signIn.getSnapshot()).toEqual({ kind: "code", email: EMAIL, busy: true, refusal: null });
    await r.signIn.resendCode();
    await r.signIn.enterCode(CODE);
    release();
    await first;
    expect(r.fake.requests).toHaveLength(2);
  });

  it("resendCode records a failed call's refusal on the code snapshot", async () => {
    const r = await rigOnCode();
    r.fake.answerNext("throw");
    await r.signIn.resendCode();
    expect(r.signIn.getSnapshot()).toEqual({ kind: "code", email: EMAIL, busy: false, refusal: "network" });
  });
});

describe("createSignIn: signOut", () => {
  it("removes the stored session and returns to email with no refusal and no server call", async () => {
    const r = await rigWith(STORED);
    await r.signIn.start();
    await r.signIn.signOut();
    expect(await r.store.get(SESSION_KEY)).toBeNull();
    expect(r.signIn.getSnapshot()).toEqual({ kind: "email", busy: false, refusal: null });
    expect(r.fake.requests).toHaveLength(0);
  });
});
