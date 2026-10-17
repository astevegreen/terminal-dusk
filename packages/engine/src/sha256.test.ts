import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { seedHash } from "./sha256.ts";

// Every expected digest below was computed beforehand with a standard SHA-256 tool, outside the repo.
const REPLACEMENT = String.fromCharCode(0xfffd);
const HIGH = String.fromCharCode(0xd800);
const LOW = String.fromCharCode(0xdc00);
const EMOJI = String.fromCharCode(0xd83d, 0xde00); // a valid surrogate pair (U+1F600)

describe("seedHash: known SHA-256 digests", () => {
  it("the empty string gives the standard digest", () => {
    expect(seedHash("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it('"abc" gives the standard digest', () => {
    expect(seedHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("the standard 56-letter test message gives the standard digest", () => {
    expect(seedHash("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });
  it.each([
    [55, "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318"],
    [56, "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a"],
    [63, "7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34"],
    [64, "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb"],
    [65, "635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0"],
  ])("a message of %i ASCII bytes (a padding edge) gives its digest", (length, digest) => {
    expect(seedHash("a".repeat(length))).toBe(digest);
  });
  it("accented letters, an emoji and a 3-byte character are hashed as UTF-8", () => {
    const seed = `caf${String.fromCharCode(0xe9)} ${EMOJI} ${String.fromCharCode(0x20ac)}`;
    expect(seedHash(seed)).toBe("e85d05b66de4dcbd304438a17856f85e0d42371892c54fdaadec3afca2ed1f2a");
  });
});

describe("seedHash: lone surrogates encode as U+FFFD, like TextEncoder", () => {
  it("a lone high surrogate alone", () => {
    expect(seedHash(HIGH)).toBe(seedHash(REPLACEMENT));
  });
  it("a lone low surrogate alone", () => {
    expect(seedHash(LOW)).toBe(seedHash(REPLACEMENT));
  });
  it("a lone high surrogate before a letter keeps the letter", () => {
    expect(seedHash(`${HIGH}a`)).toBe(seedHash(`${REPLACEMENT}a`));
  });
  it("a lone high surrogate before a valid pair keeps the emoji", () => {
    expect(seedHash(`${HIGH}${EMOJI}`)).toBe(seedHash(`${REPLACEMENT}${EMOJI}`));
  });
  it("a lone low surrogate before a letter keeps the letter", () => {
    expect(seedHash(`${LOW}a`)).toBe(seedHash(`${REPLACEMENT}a`));
  });
  it("a pair in the wrong order is two replacement characters", () => {
    expect(seedHash(`${LOW}${HIGH}`)).toBe(seedHash(`${REPLACEMENT}${REPLACEMENT}`));
  });
});

describe("seedHash: general behaviour", () => {
  it("the same seed always gives the same digest, and different seeds differ", () => {
    expect(seedHash("terminal-dusk")).toBe(seedHash("terminal-dusk"));
    expect(seedHash("terminal-dusk")).not.toBe(seedHash("terminal-dusk "));
  });
  it("never throws, and always gives 64 lowercase hex characters, for any string", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 200 }), (seed) => {
        expect(seedHash(seed)).toMatch(/^[0-9a-f]{64}$/);
      }),
      { numRuns: 200 },
    );
  });
});
