import { describe, expect, it } from "vitest";
import { sameText, secretKey, sign, signatureMatches } from "./webhookSignature.ts";

// The worked example published with the Standard Webhooks specification.
const SPEC = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: "1614265330",
  body: '{"test": 2432232314}',
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};

describe("Standard Webhooks signature", () => {
  it("signs the specification's example to its published signature", async () => {
    expect(`v1,${await sign(secretKey(SPEC.secret)!, SPEC.id, SPEC.timestamp, SPEC.body)}`).toBe(SPEC.signature);
  });

  it("accepts the example with Supabase's v1,whsec_ secret form, and refuses a changed body or id", async () => {
    const headers = { id: SPEC.id, timestamp: SPEC.timestamp, signature: SPEC.signature };
    expect(await signatureMatches(`v1,${SPEC.secret}`, headers, SPEC.body)).toBe(true);
    expect(await signatureMatches(SPEC.secret, headers, '{"test": 1}')).toBe(false);
    expect(await signatureMatches(SPEC.secret, { ...headers, id: "msg_other" }, SPEC.body)).toBe(false);
  });

  it("compares texts of different lengths or contents as different", () => {
    expect(sameText("abc", "abc")).toBe(true);
    expect(sameText("abc", "abd")).toBe(false);
    expect(sameText("abc", "abcd")).toBe(false);
  });
});
