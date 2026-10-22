import { describe, expect, it } from "vitest";
import { RESEND_SEND_URL, resendMailer } from "./resendMailer.ts";
import type { MailFetch } from "./resendMailer.ts";

const API_KEY = "test-key-not-real-123";
const FROM = "Terminal Dusk <sender@example.test>";
const EMAIL = { to: "player@example.test", subject: "Hello", text: "Body text" };

type Call = { url: string; init: { method: string; headers: Record<string, string>; body: string } };

/** A fake fetch that records each call and answers with `status` (and a reply text that names the key). */
function fakeFetch(status: number): { fetch: MailFetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: MailFetch = async (url, init) => {
    calls.push({ url, init });
    return { status, text: async () => `provider says: bad key ${API_KEY}` } as { status: number };
  };
  return { fetch, calls };
}

describe("resendMailer", () => {
  it("sends one POST to Resend with the key only in the Authorization header", async () => {
    const { fetch, calls } = fakeFetch(200);
    await resendMailer({ apiKey: API_KEY, from: FROM, fetch }).send(EMAIL);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.url).toBe(RESEND_SEND_URL);
    expect(call!.init.method).toBe("POST");
    expect(call!.init.headers["Authorization"]).toBe(`Bearer ${API_KEY}`);
    expect(call!.init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(call!.init.body)).toEqual({ from: FROM, to: EMAIL.to, subject: EMAIL.subject, text: EMAIL.text });
    expect(call!.init.body).not.toContain(API_KEY);
    expect(call!.url).not.toContain(API_KEY);
  });

  it("a 2xx reply is ok", async () => {
    for (const status of [200, 201, 299]) {
      expect(await resendMailer({ apiKey: API_KEY, from: FROM, fetch: fakeFetch(status).fetch }).send(EMAIL)).toEqual({
        ok: true,
      });
    }
  });

  it("a 4xx reply is rejected, and the reply's text is not copied into the result", async () => {
    for (const status of [400, 401, 422, 429, 499]) {
      const result = await resendMailer({ apiKey: API_KEY, from: FROM, fetch: fakeFetch(status).fetch }).send(EMAIL);
      expect(result).toEqual({ ok: false, code: "rejected" });
      expect(JSON.stringify(result)).not.toContain(API_KEY);
      expect(JSON.stringify(result)).not.toContain("provider says");
    }
  });

  it("a 5xx reply is unavailable", async () => {
    for (const status of [500, 502, 503]) {
      const result = await resendMailer({ apiKey: API_KEY, from: FROM, fetch: fakeFetch(status).fetch }).send(EMAIL);
      expect(result).toEqual({ ok: false, code: "unavailable" });
    }
  });

  it("a network error (a rejected fetch) is unavailable and does not throw", async () => {
    const fetch: MailFetch = () => Promise.reject(new Error(`network down for ${API_KEY}`));
    const result = await resendMailer({ apiKey: API_KEY, from: FROM, fetch }).send(EMAIL);
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("a fetch that throws synchronously is unavailable and does not throw", async () => {
    const fetch: MailFetch = () => {
      throw new Error(`boom ${API_KEY}`);
    };
    const result = await resendMailer({ apiKey: API_KEY, from: FROM, fetch }).send(EMAIL);
    expect(result).toEqual({ ok: false, code: "unavailable" });
  });

  it("a reply with no usable status is unavailable", async () => {
    const fetch = (async () => ({})) as unknown as MailFetch;
    expect(await resendMailer({ apiKey: API_KEY, from: FROM, fetch }).send(EMAIL)).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});
