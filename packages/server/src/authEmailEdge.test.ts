import { describe, expect, it } from "vitest";
import { authEmailFetchHandler, unconfiguredMailer } from "./authEmailEdge.ts";
import type { FetchRequest } from "./edge.ts";
import { authEmailWorld, payload, signedRequest } from "./test/authEmail.ts";

type Made = { body: string | null; init: { status: number; headers: Record<string, string> } };
const make = (body: string | null, init: Made["init"]): Made => ({ body, init });

const request = (method: string, headers: Record<string, string>, text: () => Promise<string>): FetchRequest => ({
  method,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text,
});

describe("auth-email Edge Function glue: fetch requests to the hook handler and back", () => {
  it("reads the webhook-id, webhook-timestamp and webhook-signature headers and the body: a signed call sends", async () => {
    const w = authEmailWorld();
    const signed = await signedRequest(payload("magiclink"));
    const headers = {
      "webhook-id": signed.webhookId!,
      "webhook-timestamp": signed.webhookTimestamp!,
      "webhook-signature": signed.webhookSignature!,
    };
    const made = await authEmailFetchHandler(w.deps, make)(request("POST", headers, async () => signed.body));
    expect(made.init.status).toBe(200);
    expect(made.body).toBe("{}");
    expect(w.mailer.sent).toHaveLength(1);
  });

  it("an unsigned call answers 401 and sends nothing", async () => {
    const w = authEmailWorld();
    const made = await authEmailFetchHandler(w.deps, make)(request("POST", {}, async () => payload("magiclink")));
    expect(made.init.status).toBe(401);
    expect(w.mailer.sent).toEqual([]);
  });

  it("a body that cannot be read counts as empty: 401 for the signature, nothing sent", async () => {
    const w = authEmailWorld();
    const made = await authEmailFetchHandler(
      w.deps,
      make,
    )(request("POST", {}, () => Promise.reject(new Error("stream broke"))));
    expect(made.init.status).toBe(401);
    expect(w.mailer.sent).toEqual([]);
  });

  it("OPTIONS makes a response with a null body, as a 204 requires", async () => {
    const w = authEmailWorld();
    const made = await authEmailFetchHandler(w.deps, make)(request("OPTIONS", {}, async () => ""));
    expect(made).toEqual({ body: null, init: { status: 204, headers: expect.any(Object) } });
  });
});

describe("auth-email without a mail provider configured", () => {
  it("every signed hook call answers a 5xx in the hook's error shape and nothing is sent", async () => {
    const w = authEmailWorld();
    const deps = { ...w.deps, mailer: unconfiguredMailer() };
    for (const action of ["magiclink", "signup"]) {
      const made = await authEmailFetchHandler(deps, make)(request("POST", {}, async () => ""));
      expect(made.init.status).toBe(401);
      const signed = await signedRequest(payload(action));
      const reply = await authEmailFetchHandler(
        deps,
        make,
      )(
        request(
          "POST",
          {
            "webhook-id": signed.webhookId!,
            "webhook-timestamp": signed.webhookTimestamp!,
            "webhook-signature": signed.webhookSignature!,
          },
          async () => signed.body,
        ),
      );
      expect(reply.init.status).toBeGreaterThanOrEqual(500);
      expect(JSON.parse(reply.body!)).toEqual({ error: { http_code: reply.init.status, message: expect.any(String) } });
    }
    expect(w.mailer.sent).toEqual([]);
  });
});
