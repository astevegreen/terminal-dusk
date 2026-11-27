import { describe, expect, it } from "vitest";
import { GIFT_CODE_LENGTH, giftCode, hashGiftCode, normalizeGiftCode } from "./giftCode.ts";
import { INVITE_CODE_ALPHABET } from "./inviteCode.ts";

const SHAPE = /^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/;

describe("giftCode: codes random and long enough that guessing is hopeless", () => {
  it("gives 20 characters from the invite alphabet, shown in four groups of five", () => {
    expect(GIFT_CODE_LENGTH).toBe(20);
    for (let i = 0; i < 200; i++) expect(giftCode()).toMatch(SHAPE);
  });

  it("has about 99 bits of chance in it (31 characters, 20 times), far past guessing", () => {
    expect(GIFT_CODE_LENGTH * Math.log2(INVITE_CODE_ALPHABET.length)).toBeGreaterThan(99);
  });

  it("uses the secure random source, so codes differ", () => {
    expect(new Set(Array.from({ length: 200 }, () => giftCode())).size).toBe(200);
  });

  it("maps random bytes onto the alphabet and skips bytes that would make some characters likelier", () => {
    const bytes = [255, 248, 0, 1, 2, 30, 31, 247];
    let at = 0;
    const source = {
      getRandomValues(array: Uint8Array): Uint8Array {
        for (let i = 0; i < array.length; i++) array[i] = bytes[at++ % bytes.length]!;
        return array;
      },
    };
    // 255 and 248 are skipped; 0, 1, 2, 30, 31 (= 0), 247 (= 30) repeat.
    expect(giftCode(source)).toBe("234Z2-Z234Z-2Z234-Z2Z23");
  });
});

describe("normalizeGiftCode: what a player types, made into the stored form", () => {
  it("drops dashes and spaces and makes letters capitals", () => {
    expect(normalizeGiftCode(" abcde-fghjk mnpqr-stuvw ")).toBe("ABCDEFGHJKMNPQRSTUVW");
    expect(normalizeGiftCode("ABCDEFGHJKMNPQRSTUVW")).toBe("ABCDEFGHJKMNPQRSTUVW");
  });

  it.each([
    ["too short", "ABCDE-FGHJK-MNPQR-STUV"],
    ["too long", "ABCDE-FGHJK-MNPQR-STUVWX"],
    ["a look-alike character (O)", "ABCDE-FGHJK-MNPQR-STUVO"],
    ["a zero", "ABCDE-FGHJK-MNPQR-STUV0"],
    ["a symbol", "ABCDE-FGHJK-MNPQR-STUV!"],
    ["nothing", ""],
  ])("refuses a code that is %s, so it never reaches the database", (_name, text) => {
    expect(normalizeGiftCode(text)).toBeNull();
  });
});

describe("hashGiftCode: the stored form, so a leaked table leaks no usable code", () => {
  it("is the lowercase hex SHA-256 of the normalised code", async () => {
    // SHA-256 of "ABCDEFGHJKMNPQRSTUVW", worked out separately with Node's crypto.createHash.
    expect(await hashGiftCode("ABCDEFGHJKMNPQRSTUVW")).toBe(
      "d1d5079c636ac8353aa6acc43178ca940837a4dbc13028a5d93376fff410df65",
    );
  });

  it("gives the same hash for the same code however it was typed, and different hashes for different codes", async () => {
    const a = normalizeGiftCode("abcde-fghjk-mnpqr-stuvw")!;
    const b = normalizeGiftCode("ABCDEFGHJKMNPQRSTUVW")!;
    const c = normalizeGiftCode("ABCDEFGHJKMNPQRSTUVX")!;
    expect(await hashGiftCode(a)).toBe(await hashGiftCode(b));
    expect(await hashGiftCode(a)).not.toBe(await hashGiftCode(c));
  });

  it("never contains the code itself", async () => {
    const code = normalizeGiftCode(giftCode())!;
    expect(await hashGiftCode(code)).not.toContain(code.toLowerCase());
  });
});
