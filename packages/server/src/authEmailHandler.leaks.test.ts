import { expect, it } from "vitest";
import { handleAuthEmail } from "./authEmailHandler.ts";
import type { AuthEmailRequest } from "./authEmailHandler.ts";
import { secretKey } from "./webhookSignature.ts";
import {
  NOW_MS,
  TEST_CODE,
  TEST_EMAIL,
  TEST_SECRET,
  TEST_TOKEN_HASH,
  authEmailWorld,
  payload,
  signedRequest,
} from "./test/authEmail.ts";

it("no reply and no log line contains the code, the token hash, the hook secret or the address", async () => {
  const signed = await signedRequest(payload("magiclink"));
  const cases: { request: AuthEmailRequest; fail?: "rejected" | "unavailable" }[] = [
    { request: signed },
    { request: await signedRequest(payload("signup")) },
    { request: await signedRequest(payload("recovery")) },
    { request: signed, fail: "rejected" },
    { request: signed, fail: "unavailable" },
    { request: { ...signed, webhookSignature: "v1,AAAA" } },
    { request: await signedRequest(payload("magiclink"), { timestamp: String(NOW_MS / 1000 - 3600) }) },
    { request: { ...signed, method: "GET" } },
  ];
  const secretBase64 = TEST_SECRET.replace("v1,whsec_", "");
  const secretText = String.fromCharCode(...secretKey(TEST_SECRET)!);
  const forbidden = [TEST_CODE, TEST_TOKEN_HASH, TEST_SECRET, secretBase64, secretText, TEST_EMAIL];

  const texts: string[] = [];
  for (const { request, fail } of cases) {
    const w = authEmailWorld();
    if (fail) w.mailer.failNext(fail);
    const reply = await handleAuthEmail(w.deps, request);
    texts.push(reply.body, JSON.stringify(reply.headers), ...w.logs);
    expect(w.logs.length).toBeGreaterThan(0);
  }
  for (const text of texts) for (const value of forbidden) expect(text).not.toContain(value);
});
