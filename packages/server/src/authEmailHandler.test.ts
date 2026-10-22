import { describe, expect, it } from "vitest";
import { handleAuthEmail } from "./authEmailHandler.ts";
import { signInCodeEmail } from "./mailMessages.ts";
import { NOW_MS, TEST_CODE, TEST_EMAIL, authEmailWorld, payload, signedRequest } from "./test/authEmail.ts";

const errorBody = (status: number) => ({ error: { http_code: status, message: expect.any(String) } });

describe("auth-email hook: signed calls send the sign-in code", () => {
  it("a correctly signed magiclink call sends exactly one email with the code and answers 200 {}", async () => {
    const w = authEmailWorld();
    const reply = await handleAuthEmail(w.deps, await signedRequest(payload("magiclink")));
    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.body)).toEqual({});
    expect(w.mailer.sent).toEqual([signInCodeEmail(TEST_EMAIL, TEST_CODE)]);
  });

  it("a correctly signed signup call sends exactly one email with the code and answers 200 {}", async () => {
    const w = authEmailWorld();
    const reply = await handleAuthEmail(w.deps, await signedRequest(payload("signup")));
    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.body)).toEqual({});
    expect(w.mailer.sent).toEqual([signInCodeEmail(TEST_EMAIL, TEST_CODE)]);
  });

  it("a timestamp within 5 minutes either way of now is accepted (seconds against milliseconds)", async () => {
    for (const offset of [-299, 299]) {
      const w = authEmailWorld();
      const timestamp = String(NOW_MS / 1000 + offset);
      const reply = await handleAuthEmail(w.deps, await signedRequest(payload("magiclink"), { timestamp }));
      expect(reply.status).toBe(200);
      expect(w.mailer.sent).toHaveLength(1);
    }
  });

  it("a signature list with an extra wrong entry still matches the right one", async () => {
    const w = authEmailWorld();
    const request = await signedRequest(payload("magiclink"));
    const reply = await handleAuthEmail(w.deps, {
      ...request,
      webhookSignature: `v1,AAAA ${request.webhookSignature}`,
    });
    expect(reply.status).toBe(200);
  });
});

describe("auth-email hook: refusals send nothing", () => {
  it("a bad signature answers 401 in the hook's error shape and sends nothing", async () => {
    const w = authEmailWorld();
    const wrongKey = await signedRequest(payload("magiclink"), { secret: "v1,whsec_c29tZW9uZS1lbHNlcy1rZXk=" });
    const tampered = { ...(await signedRequest(payload("magiclink"))), body: payload("signup") };
    for (const request of [wrongKey, tampered]) {
      const reply = await handleAuthEmail(w.deps, request);
      expect(reply.status).toBe(401);
      expect(JSON.parse(reply.body)).toEqual(errorBody(401));
    }
    expect(w.mailer.sent).toEqual([]);
  });

  it("a missing signature, id or timestamp answers 401 and sends nothing", async () => {
    const w = authEmailWorld();
    const request = await signedRequest(payload("magiclink"));
    for (const missing of [{ webhookSignature: null }, { webhookId: null }, { webhookTimestamp: null }]) {
      expect((await handleAuthEmail(w.deps, { ...request, ...missing })).status).toBe(401);
    }
    expect(w.mailer.sent).toEqual([]);
  });

  it("an old timestamp (more than 5 minutes from now) answers 401 and sends nothing, even when signed", async () => {
    const w = authEmailWorld();
    for (const offset of [-301, 301, -3600]) {
      const timestamp = String(NOW_MS / 1000 + offset);
      const reply = await handleAuthEmail(w.deps, await signedRequest(payload("magiclink"), { timestamp }));
      expect(reply.status).toBe(401);
    }
    // A timestamp in milliseconds is far from now in seconds.
    const millis = await signedRequest(payload("magiclink"), { timestamp: String(NOW_MS) });
    expect((await handleAuthEmail(w.deps, millis)).status).toBe(401);
    expect(w.mailer.sent).toEqual([]);
  });

  it("an empty or unusable hook secret matches no signature: 401", async () => {
    const w = authEmailWorld();
    const request = await signedRequest(payload("magiclink"));
    for (const hookSecret of ["", "v1,whsec_", "v1,whsec_not base64!"]) {
      expect((await handleAuthEmail({ ...w.deps, hookSecret }, request)).status).toBe(401);
    }
    expect(w.mailer.sent).toEqual([]);
  });

  it("an unsupported action type answers 400 in the hook's error shape and sends nothing", async () => {
    const w = authEmailWorld();
    for (const action of ["recovery", "invite", "email_change", "reauthentication"]) {
      const reply = await handleAuthEmail(w.deps, await signedRequest(payload(action)));
      expect(reply.status).toBe(400);
      expect(JSON.parse(reply.body)).toEqual(errorBody(400));
    }
    expect(w.mailer.sent).toEqual([]);
  });

  it("a signed payload without an address or a 6-digit code answers 400 and sends nothing", async () => {
    const w = authEmailWorld();
    const bodies = [
      "not json",
      JSON.stringify({ user: {}, email_data: { token: TEST_CODE, email_action_type: "magiclink" } }),
      JSON.stringify({ user: { email: TEST_EMAIL }, email_data: { token: "12345", email_action_type: "magiclink" } }),
    ];
    for (const body of bodies) expect((await handleAuthEmail(w.deps, await signedRequest(body))).status).toBe(400);
    expect(w.mailer.sent).toEqual([]);
  });

  it("a method other than POST answers 405; OPTIONS answers 204 with an empty body", async () => {
    const w = authEmailWorld();
    const request = await signedRequest(payload("magiclink"));
    expect((await handleAuthEmail(w.deps, { ...request, method: "GET" })).status).toBe(405);
    expect(await handleAuthEmail(w.deps, { ...request, method: "OPTIONS" })).toMatchObject({ status: 204, body: "" });
    expect(w.mailer.sent).toEqual([]);
  });
});

describe("auth-email hook: mailer failures are reported to Auth", () => {
  it("a mailer rejected and a mailer unavailable each answer a 5xx in the hook's error shape", async () => {
    for (const failure of ["rejected", "unavailable"] as const) {
      const w = authEmailWorld();
      w.mailer.failNext(failure);
      const reply = await handleAuthEmail(w.deps, await signedRequest(payload("magiclink")));
      expect(reply.status).toBeGreaterThanOrEqual(500);
      expect(reply.status).toBeLessThan(600);
      expect(JSON.parse(reply.body)).toEqual(errorBody(reply.status));
      expect(w.mailer.sent).toEqual([]);
    }
  });

  it("a mailer that throws answers 500 in the hook's error shape", async () => {
    const w = authEmailWorld();
    const deps = { ...w.deps, mailer: { send: () => Promise.reject(new Error("boom")) } };
    const reply = await handleAuthEmail(deps, await signedRequest(payload("magiclink")));
    expect(reply.status).toBe(500);
    expect(JSON.parse(reply.body)).toEqual(errorBody(500));
  });
});
