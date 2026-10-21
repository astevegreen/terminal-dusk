import { describe, expect, it } from "vitest";
import { INVITE_CODE_ALPHABET, inviteCode } from "./inviteCode.ts";

describe("inviteCode", () => {
  it("gives 8 characters with no look-alikes (no 0, O, 1, I or L)", () => {
    for (let i = 0; i < 200; i++) {
      const code = inviteCode();
      expect(code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
    expect(INVITE_CODE_ALPHABET).toHaveLength(31);
  });

  it("uses the secure random source, so codes differ", () => {
    const codes = new Set(Array.from({ length: 50 }, () => inviteCode()));
    expect(codes.size).toBe(50);
  });

  it("maps random bytes onto the alphabet and skips bytes that would make some characters likelier", () => {
    const bytes = [255, 248, 0, 1, 2, 30, 31, 247, 3, 4, 5];
    let at = 0;
    const source = {
      getRandomValues(array: Uint8Array): Uint8Array {
        for (let i = 0; i < array.length; i++) array[i] = bytes[at++ % bytes.length]!;
        return array;
      },
    };
    // 255 and 248 are skipped; 0, 1, 2, 30, 31 (= 0), 247 (= 30), 3, 4 are used.
    expect(inviteCode(source)).toBe("234Z2Z56");
  });
});
