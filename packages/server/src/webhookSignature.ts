// The Standard Webhooks signature check Supabase Auth's hooks use: HMAC-SHA256 with the hook secret over
// `<webhook-id>.<webhook-timestamp>.<raw body>`, sent base64-encoded as `v1,<signature>` (several may be listed,
// separated by spaces). The secret is written `v1,whsec_<base64 key>`. Web Crypto, base64 and text encoding are
// reached through a typed globalThis, since the server's compiler settings name no DOM or Node types; no
// dependency is added. Nothing here logs, and a bad input answers false rather than throwing.

type CryptoKeyHandle = object;
type Subtle = {
  importKey(
    format: "raw",
    key: Uint8Array,
    algorithm: { name: "HMAC"; hash: "SHA-256" },
    extractable: false,
    usages: ["sign"],
  ): Promise<CryptoKeyHandle>;
  sign(algorithm: "HMAC", key: CryptoKeyHandle, data: Uint8Array): Promise<ArrayBuffer>;
};
type WebGlobals = {
  crypto: { subtle: Subtle };
  atob(text: string): string;
  btoa(text: string): string;
  TextEncoder: new () => { encode(text: string): Uint8Array };
};
const web = globalThis as unknown as WebGlobals;

/** The three Standard Webhooks headers, as received (null when missing). */
export type WebhookHeaders = { id: string | null; timestamp: string | null; signature: string | null };

/** The key bytes in a `v1,whsec_<base64>` (or bare `whsec_<base64>` or base64) secret, or null when unusable. */
export function secretKey(secret: string): Uint8Array | null {
  const encoded = secret.replace(/^v1,/, "").replace(/^whsec_/, "");
  if (encoded.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  try {
    return Uint8Array.from(web.atob(encoded), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The base64 HMAC-SHA256 signature of `<id>.<timestamp>.<body>` under `key`. */
export async function sign(key: Uint8Array, id: string, timestamp: string, body: string): Promise<string> {
  const handle = await web.crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(
    await web.crypto.subtle.sign("HMAC", handle, new web.TextEncoder().encode(`${id}.${timestamp}.${body}`)),
  );
  return web.btoa(String.fromCharCode(...mac));
}

/** Whether `a` and `b` are equal, taking the same time for every pair of strings of one length. */
export function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a.codePointAt(i) ?? 0) ^ (b.codePointAt(i) ?? 0);
  return difference === 0;
}

/** Whether one of the `v1,` signatures in the headers matches `body` under `secret`. Never throws. */
export async function signatureMatches(secret: string, headers: WebhookHeaders, body: string): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const key = secretKey(secret);
  if (key === null) return false;
  try {
    const expected = await sign(key, id, timestamp, body);
    const offered = signature
      .split(" ")
      .filter((entry) => entry.startsWith("v1,"))
      .map((entry) => entry.slice(3));
    let found = false;
    // Every offered signature is compared, so the time taken does not depend on which one matched.
    for (const candidate of offered) found = sameText(candidate, expected) || found;
    return found;
  } catch {
    return false;
  }
}
