import { describe, expect, it } from "vitest";
import { refreshSession, requestCode, verifyCode } from "./emailAuth.ts";
import type { AuthEndpoint } from "./emailAuth.ts";
import { AUTH_ANON_KEY, AUTH_URL, createFakeAuth, sessionBody } from "./test/fakeAuth.ts";
import type { FakeAuth } from "./test/fakeAuth.ts";

const NOW = 5_000_000;

function setup(): { fake: FakeAuth; e: AuthEndpoint } {
  const fake = createFakeAuth();
  return { fake, e: { url: AUTH_URL, anonKey: AUTH_ANON_KEY, fetch: fake.fetch } };
}

describe("requestCode", () => {
  it("posts the email with create_user to /auth/v1/otp, with the anon key as apikey and no link or redirect", async () => {
    const { fake, e } = setup();
    expect(await requestCode(e, "ana@example.com")).toEqual({ ok: true, value: null });
    expect(fake.requests).toHaveLength(1);
    const [req] = fake.requests;
    expect(req?.url).toBe(`${AUTH_URL}/auth/v1/otp`);
    expect(req?.method).toBe("POST");
    expect(req?.headers.apikey).toBe(AUTH_ANON_KEY);
    expect(req?.headers["Content-Type"]).toBe("application/json");
    expect(req?.body).toEqual({ email: "ana@example.com", create_user: true });
    expect(req?.url).not.toMatch(/redirect/i);
  });

  it.each(["", "ana", "ana@@example.com", "a@b@c", "ana @example.com", "ana@example.com ", "ana\t@x.com"])(
    "refuses %j as badEmail without sending a request",
    async (email) => {
      const { fake, e } = setup();
      expect(await requestCode(e, email)).toEqual({ ok: false, error: { code: "badEmail" } });
      expect(fake.requests).toHaveLength(0);
    },
  );

  it("answers tooManyRequests to a 429", async () => {
    const { fake, e } = setup();
    fake.answerNext({
      status: 429,
      body: { msg: "For security purposes, you can only request this after 60 seconds" },
    });
    expect(await requestCode(e, "ana@example.com")).toEqual({ ok: false, error: { code: "tooManyRequests" } });
  });

  it("answers network to a thrown fetch and to a 5xx", async () => {
    const { fake, e } = setup();
    fake.answerNext("throw");
    expect(await requestCode(e, "ana@example.com")).toEqual({ ok: false, error: { code: "network" } });
    fake.answerNext({ status: 503, body: { msg: "upstream down" } });
    expect(await requestCode(e, "ana@example.com")).toEqual({ ok: false, error: { code: "network" } });
  });

  it("answers badEmail when Auth refuses the address", async () => {
    const { fake, e } = setup();
    fake.answerNext({ status: 400, body: { msg: "Unable to validate email address: invalid format" } });
    expect(await requestCode(e, "ana@example")).toEqual({ ok: false, error: { code: "badEmail" } });
  });
});

describe("verifyCode", () => {
  it("posts type email, the email and the code as token to /auth/v1/verify and returns the session", async () => {
    const { fake, e } = setup();
    const result = await verifyCode(e, "ana@example.com", "123456", NOW);
    expect(result).toEqual({
      ok: true,
      value: { accessToken: "access-1", refreshToken: "refresh-1", expiresAt: NOW + 3_600_000, userId: "user-1" },
    });
    const [req] = fake.requests;
    expect(req?.url).toBe(`${AUTH_URL}/auth/v1/verify`);
    expect(req?.method).toBe("POST");
    expect(req?.headers.apikey).toBe(AUTH_ANON_KEY);
    expect(req?.body).toEqual({ type: "email", email: "ana@example.com", token: "123456" });
  });

  it("works out expiresAt as an integer in milliseconds from expires_in and the caller's now", async () => {
    const { fake, e } = setup();
    fake.answerNext({ status: 200, body: sessionBody("a", "r", 90) });
    const result = await verifyCode(e, "ana@example.com", "123456", 1_234);
    expect(result.ok && result.value.expiresAt).toBe(1_234 + 90_000);
    expect(result.ok && Number.isInteger(result.value.expiresAt)).toBe(true);
  });

  it.each(["", "12345", "1234567", "12345a", " 123456", "12 456", "１２３４５６"])(
    "refuses code %j as badCode without sending a request",
    async (code) => {
      const { fake, e } = setup();
      expect(await verifyCode(e, "ana@example.com", code, NOW)).toEqual({ ok: false, error: { code: "badCode" } });
      expect(fake.requests).toHaveLength(0);
    },
  );

  it("refuses a bad email as badEmail without sending a request", async () => {
    const { fake, e } = setup();
    expect(await verifyCode(e, "ana", "123456", NOW)).toEqual({ ok: false, error: { code: "badEmail" } });
    expect(fake.requests).toHaveLength(0);
  });

  it.each([400, 401, 403, 422])("answers wrongCode when Auth refuses or expires the code (%i)", async (status) => {
    const { fake, e } = setup();
    fake.answerNext({ status, body: { error_code: "otp_expired", msg: "Token has expired or is invalid" } });
    expect(await verifyCode(e, "ana@example.com", "123456", NOW)).toEqual({ ok: false, error: { code: "wrongCode" } });
  });

  it("answers tooManyRequests to a 429 and network to a thrown fetch, a 5xx or a reply with no session", async () => {
    const { fake, e } = setup();
    fake.answerNext({ status: 429, body: {} });
    expect(await verifyCode(e, "ana@example.com", "123456", NOW)).toEqual({
      ok: false,
      error: { code: "tooManyRequests" },
    });
    fake.answerNext("throw");
    expect(await verifyCode(e, "ana@example.com", "123456", NOW)).toEqual({ ok: false, error: { code: "network" } });
    fake.answerNext({ status: 500, body: {} });
    expect(await verifyCode(e, "ana@example.com", "123456", NOW)).toEqual({ ok: false, error: { code: "network" } });
    fake.answerNext({ status: 200, body: { access_token: "half" } });
    expect(await verifyCode(e, "ana@example.com", "123456", NOW)).toEqual({ ok: false, error: { code: "network" } });
  });

  it("carries no code, token or raw Auth text in a refusal", async () => {
    const { fake, e } = setup();
    fake.answerNext({
      status: 403,
      body: { msg: "Token 654321 has expired", access_token: "leak-a", refresh_token: "leak-r" },
    });
    const result = await verifyCode(e, "ana@example.com", "654321", NOW);
    const text = JSON.stringify(result);
    for (const secret of ["654321", "leak-a", "leak-r", "expired"]) expect(text).not.toContain(secret);
  });
});

describe("refreshSession", () => {
  it("posts the refresh token to the refresh grant and returns the new session", async () => {
    const { fake, e } = setup();
    const result = await refreshSession(e, "refresh-1", NOW);
    expect(result).toEqual({
      ok: true,
      value: { accessToken: "access-r1", refreshToken: "refresh-r1", expiresAt: NOW + 3_600_000, userId: "user-1" },
    });
    const [req] = fake.requests;
    expect(req?.url).toBe(`${AUTH_URL}/auth/v1/token?grant_type=refresh_token`);
    expect(req?.method).toBe("POST");
    expect(req?.headers.apikey).toBe(AUTH_ANON_KEY);
    expect(req?.body).toEqual({ refresh_token: "refresh-1" });
  });

  it("answers wrongCode to a refused refresh token, tooManyRequests to a 429 and network to a 5xx", async () => {
    const { fake, e } = setup();
    fake.answerNext({ status: 400, body: { msg: "Invalid Refresh Token: Already Used" } });
    expect(await refreshSession(e, "refresh-1", NOW)).toEqual({ ok: false, error: { code: "wrongCode" } });
    fake.answerNext({ status: 429, body: {} });
    expect(await refreshSession(e, "refresh-1", NOW)).toEqual({ ok: false, error: { code: "tooManyRequests" } });
    fake.answerNext({ status: 502, body: {} });
    expect(await refreshSession(e, "refresh-1", NOW)).toEqual({ ok: false, error: { code: "network" } });
    fake.answerNext("throw");
    expect(await refreshSession(e, "refresh-1", NOW)).toEqual({ ok: false, error: { code: "network" } });
  });
});
