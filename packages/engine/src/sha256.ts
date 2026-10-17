// The public fingerprint of a game's seed.
//
// ALGORITHM: SHA-256, as defined in FIPS 180-4. The seed is turned into UTF-8 bytes (by hand, below), hashed,
// and written as 64 lowercase hex characters.
// THIS ALGORITHM AND THE UTF-8 ENCODING MUST NEVER CHANGE. A fingerprint published when a game starts is checked
// against the seed revealed when it ends, possibly years later; changing a single line would break that check.
//
// Everything is 32-bit integer arithmetic (Math.imul, `>>> 0`, shifts). No outside library, no TextEncoder,
// no crypto, no floating-point maths. Exported through index.ts as a pure helper.

const K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

const START: readonly number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

/** UTF-8 bytes of a string. A lone surrogate becomes U+FFFD (bytes EF BF BD), exactly like the WHATWG TextEncoder. */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (next - 0xdc00);
        i++;
      } else {
        cp = 0xfffd;
      }
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      cp = 0xfffd;
    }
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    }
  }
  return bytes;
}

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** Adds the padding: a 1 bit, zeros, then the message length in bits as a 64-bit big-endian number. */
function pad(bytes: number[]): number[] {
  const length = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = length >>> 29; // bits above 2^32
  const low = (length << 3) >>> 0;
  for (const word of [high, low]) {
    bytes.push(word >>> 24, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }
  return bytes;
}

/** A word from a list known to be long enough (the compiler cannot see that, so this keeps it honest). */
const at = (list: readonly number[], i: number): number => list[i] ?? 0;

/** Runs the compression function over one 64-byte block starting at `offset`, updating the eight hash words. */
function compress(h: number[], bytes: readonly number[], offset: number): void {
  const w: number[] = [];
  for (let t = 0; t < 16; t++) {
    const j = offset + t * 4;
    w.push(((at(bytes, j) << 24) | (at(bytes, j + 1) << 16) | (at(bytes, j + 2) << 8) | at(bytes, j + 3)) >>> 0);
  }
  for (let t = 16; t < 64; t++) {
    const w15 = at(w, t - 15);
    const w2 = at(w, t - 2);
    const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
    const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
    w.push((at(w, t - 16) + s0 + at(w, t - 7) + s1) >>> 0);
  }
  let a = at(h, 0);
  let b = at(h, 1);
  let c = at(h, 2);
  let d = at(h, 3);
  let e = at(h, 4);
  let f = at(h, 5);
  let g = at(h, 6);
  let hh = at(h, 7);
  for (let t = 0; t < 64; t++) {
    const bigS1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const choose = (e & f) ^ (~e & g);
    const temp1 = (hh + bigS1 + choose + at(K, t) + at(w, t)) >>> 0;
    const bigS0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const majority = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (bigS0 + majority) >>> 0;
    hh = g;
    g = f;
    f = e;
    e = (d + temp1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) >>> 0;
  }
  const next = [a, b, c, d, e, f, g, hh];
  for (let i = 0; i < 8; i++) h[i] = (at(h, i) + at(next, i)) >>> 0;
}

/** The SHA-256 of the seed's UTF-8 bytes, as 64 lowercase hex characters. Never throws. */
export function seedHash(seed: string): string {
  const bytes = pad(utf8Bytes(seed));
  const h = [...START];
  for (let offset = 0; offset < bytes.length; offset += 64) compress(h, bytes, offset);
  let hex = "";
  for (const word of h) hex += word.toString(16).padStart(8, "0");
  return hex;
}
