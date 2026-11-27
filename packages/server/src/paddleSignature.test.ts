import { describe, expect, it } from "vitest";
import { paddleSignatureMatches } from "./paddleSignature.ts";

// Computed with Node's createHmac, apart from the code under test: HMAC-SHA256 over `<ts>:<raw body>`, in hex, with
// the secret's text as the key. The body carries non-ASCII text, so the bytes signed must be its UTF-8 bytes.
const SECRET = "test-paddle-secret";
const TS = "1671552777";
const BODY = '{"event_id":"evt_test","note":"é – ü"}';
const MAC = "34cbc032777d2ec99f5e6aabdd2d5e12646111108887b20d60bf8a14975dc1bf";
const HEADER = `ts=${TS};h1=${MAC}`;
const OTHER_MAC = "0".repeat(64);

describe("Paddle webhook signature", () => {
  it("accepts a body signed with the secret", async () => {
    expect(await paddleSignatureMatches(SECRET, HEADER, BODY)).toBe(true);
  });

  it("accepts any one of several signatures, as sent while a secret is rotated", async () => {
    expect(await paddleSignatureMatches(SECRET, `ts=${TS};h1=${OTHER_MAC};h1=${MAC}`, BODY)).toBe(true);
    expect(await paddleSignatureMatches(SECRET, `ts=${TS};h1=${MAC};h1=${OTHER_MAC}`, BODY)).toBe(true);
  });

  it("refuses a changed body, timestamp or secret", async () => {
    expect(await paddleSignatureMatches(SECRET, HEADER, `${BODY} `)).toBe(false);
    expect(await paddleSignatureMatches(SECRET, `ts=1671552778;h1=${MAC}`, BODY)).toBe(false);
    expect(await paddleSignatureMatches("another-secret", HEADER, BODY)).toBe(false);
  });

  it.each([
    ["no header", null],
    ["an empty header", ""],
    ["no timestamp", `h1=${MAC}`],
    ["an empty timestamp", `ts=;h1=${MAC}`],
    ["a timestamp that is not a number", `ts=soon;h1=${MAC}`],
    ["two timestamps", `ts=${TS};ts=${TS};h1=${MAC}`],
    ["no signature", `ts=${TS}`],
    ["an empty signature", `ts=${TS};h1=`],
    ["a shortened signature", `ts=${TS};h1=${MAC.slice(0, 32)}`],
    ["a signature under another scheme's name", `ts=${TS};h2=${MAC}`],
    ["plain text", "signed, honestly"],
  ])("refuses %s", async (_name, header) => {
    expect(await paddleSignatureMatches(SECRET, header, BODY)).toBe(false);
  });

  it("refuses everything while no secret is configured", async () => {
    expect(await paddleSignatureMatches("", HEADER, BODY)).toBe(false);
  });
});
