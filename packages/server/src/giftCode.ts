// Gift codes (docs/architecture.md, Decision 7, "Free copies": gift codes on the web): making one, reading what a
// player typed, and the hash the database keeps instead of the code, so a leaked table leaks no usable code.
// 20 characters from the invite alphabet give about 99 bits of chance, so guessing is hopeless and the hash needs
// no salt. Both the redeem Edge Function (Deno) and tools/gift-codes.mjs (Node) import this file as it is, so it
// imports only other plain files and describes the little Web Crypto it uses itself: the server's compiler
// settings name no DOM or Node types.
import { INVITE_CODE_ALPHABET, randomCode } from "./inviteCode.ts";
import type { RandomSource } from "./inviteCode.ts";

export const GIFT_CODE_LENGTH = 20;
const GROUP = 5;

type Digest = { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };
type WebCrypto = RandomSource & { subtle: Digest };
const webCrypto = (): WebCrypto => (globalThis as unknown as { crypto: WebCrypto }).crypto;

/** A new gift code, shown as XXXXX-XXXXX-XXXXX-XXXXX. `source` is for tests; it defaults to the global `crypto`. */
export function giftCode(source: RandomSource = webCrypto()): string {
  const code = randomCode(GIFT_CODE_LENGTH, source);
  const groups: string[] = [];
  for (let at = 0; at < code.length; at += GROUP) groups.push(code.slice(at, at + GROUP));
  return groups.join("-");
}

/**
 * What a player typed, in the stored form: capitals, without spaces or dashes. Null when it is not 20 characters
 * of the alphabet, since then it can match no code.
 */
export function normalizeGiftCode(text: string): string | null {
  const code = text.replaceAll(/[\s-]/g, "").toUpperCase();
  if (code.length !== GIFT_CODE_LENGTH) return null;
  return [...code].every((character) => INVITE_CODE_ALPHABET.includes(character)) ? code : null;
}

/**
 * The lowercase hex SHA-256 of a normalised code: what the `gift_code` table keeps. A normalised code is plain
 * ASCII, so each character is its own byte (the same bytes UTF-8 gives).
 */
export async function hashGiftCode(code: string): Promise<string> {
  const bytes = Uint8Array.from(code, (character) => character.charCodeAt(0));
  const digest = await webCrypto().subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
