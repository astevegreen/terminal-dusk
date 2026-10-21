// The default invite code: 8 characters drawn with the platform's secure random source, so a code is hard
// to guess. The alphabet leaves out look-alike characters (0 and O; 1, I and L), so a code is easy to type.

/** The characters a code is made of: 2 to 9 and A to Z without I, L and O (31 in all). */
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 8;

/** The one part of the Web Crypto API used here. The packages' compiler settings name no DOM or Node types. */
type RandomSource = { getRandomValues(array: Uint8Array): Uint8Array };

/** The largest multiple of the alphabet size below 256: bytes from here up are skipped, so every character is equally likely. */
const LIMIT = 256 - (256 % INVITE_CODE_ALPHABET.length);

/** A new random invite code. `source` is for tests; it defaults to the global `crypto`. */
export function inviteCode(source: RandomSource = (globalThis as unknown as { crypto: RandomSource }).crypto): string {
  let code = "";
  while (code.length < INVITE_CODE_LENGTH) {
    for (const byte of source.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH))) {
      if (byte < LIMIT && code.length < INVITE_CODE_LENGTH)
        code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
    }
  }
  return code;
}
