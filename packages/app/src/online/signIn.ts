// The state behind signing in by email code (docs/architecture.md, Decisions 5 and 7): asks for a code,
// trades it for a session through transport/emailAuth.ts, keeps the session in Platform storage, reloads it
// on start and signs out. The snapshot never holds the code or a token; `accessToken()` hands the token to
// the online screens. A result that arrives after the player moved on (useOtherEmail, signOut) is ignored.
import { requestCode, sessionToken, verifyCode } from "../transport/emailAuth.ts";
import type { AuthEndpoint, AuthRefusal, Session } from "../transport/emailAuth.ts";
import type { KeyValueStore } from "../platform/storage.ts";

/** The one key the session is stored under. */
export const SESSION_KEY = "terminal-dusk.session";

type Status = { busy: boolean; refusal: AuthRefusal | null };

export type SignInSnapshot =
  | ({ kind: "loading" } & Status)
  | ({ kind: "email" } & Status)
  | ({ kind: "code"; email: string } & Status)
  | ({ kind: "signedIn"; userId: string } & Status);

export type SignInOptions = { auth: AuthEndpoint; store: KeyValueStore; now: () => number };

export type SignIn = {
  getSnapshot(): SignInSnapshot;
  subscribe(listener: () => void): () => void;
  /** Reads the stored session: signedIn when it is well formed, else email. */
  start(): Promise<void>;
  /** Asks for a code for `email`; moves to code on success. */
  sendCode(email: string): Promise<void>;
  /** Trades the code for a session, stores it and moves to signedIn. */
  enterCode(code: string): Promise<void>;
  /** Goes back to asking for an address. */
  useOtherEmail(): void;
  /** Asks for a new code for the same address. */
  resendCode(): Promise<void>;
  /** Forgets the stored session (no server call) and goes back to asking for an address. */
  signOut(): Promise<void>;
  /** The access token to pass to createRemoteMatch, refreshed when near expiry; null unless signed in. */
  accessToken(): Promise<string | null>;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const filled = (v: unknown): v is string => typeof v === "string" && v !== "";

/** The stored session, or null when the text is not a well-formed one. */
function parseSession(raw: string): Session | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  const { accessToken, refreshToken, expiresAt, userId } = value;
  if (!filled(accessToken) || !filled(refreshToken) || !filled(userId)) return null;
  if (typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt)) return null;
  return { accessToken, refreshToken, expiresAt, userId };
}

/** Only the four session fields, so nothing else a reply carried is stored. */
const sessionJson = (s: Session): string =>
  JSON.stringify({
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    expiresAt: s.expiresAt,
    userId: s.userId,
  });

export function createSignIn({ auth, store, now }: SignInOptions): SignIn {
  const listeners = new Set<() => void>();
  let snapshot: SignInSnapshot = { kind: "loading", busy: false, refusal: null };
  // Bumped whenever the player moves on; a call that finds it changed drops its result.
  let epoch = 0;
  let token: (() => Promise<string | null>) | null = null;

  const publish = (next: SignInSnapshot): void => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  const toEmail = (): void => {
    epoch++;
    token = null;
    publish({ kind: "email", busy: false, refusal: null });
  };

  const signedIn = (session: Session): void => {
    const mine = epoch;
    const save = (s: Session): void => {
      if (epoch === mine) void store.set(SESSION_KEY, sessionJson(s));
    };
    const get = sessionToken(auth, session, now, save);
    token = async () => {
      const value = await get();
      if (epoch !== mine) return null;
      if (value === null) {
        toEmail();
        await store.remove(SESSION_KEY);
      }
      return value;
    };
    publish({ kind: "signedIn", userId: session.userId, busy: false, refusal: null });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async start() {
      if (snapshot.kind !== "loading" || snapshot.busy) return;
      const mine = epoch;
      publish({ ...snapshot, busy: true });
      let raw: string | null;
      try {
        raw = await store.get(SESSION_KEY);
      } catch {
        raw = null;
      }
      if (epoch !== mine) return;
      const session = raw === null ? null : parseSession(raw);
      if (session !== null) {
        signedIn(session);
        return;
      }
      toEmail();
      if (raw !== null) await store.remove(SESSION_KEY);
    },

    async sendCode(email) {
      if (snapshot.kind !== "email" || snapshot.busy) return;
      const mine = epoch;
      publish({ kind: "email", busy: true, refusal: null });
      const result = await requestCode(auth, email);
      if (epoch !== mine) return;
      if (result.ok) publish({ kind: "code", email, busy: false, refusal: null });
      else publish({ kind: "email", busy: false, refusal: result.error.code });
    },

    async enterCode(code) {
      if (snapshot.kind !== "code" || snapshot.busy) return;
      const { email } = snapshot;
      const mine = epoch;
      publish({ kind: "code", email, busy: true, refusal: null });
      const result = await verifyCode(auth, email, code, now());
      if (epoch !== mine) return;
      if (!result.ok) {
        publish({ kind: "code", email, busy: false, refusal: result.error.code });
        return;
      }
      signedIn(result.value);
      await store.set(SESSION_KEY, sessionJson(result.value));
    },

    useOtherEmail() {
      toEmail();
    },

    async resendCode() {
      if (snapshot.kind !== "code" || snapshot.busy) return;
      const { email } = snapshot;
      const mine = epoch;
      publish({ kind: "code", email, busy: true, refusal: null });
      const result = await requestCode(auth, email);
      if (epoch !== mine) return;
      publish({ kind: "code", email, busy: false, refusal: result.ok ? null : result.error.code });
    },

    async signOut() {
      toEmail();
      await store.remove(SESSION_KEY);
    },

    accessToken() {
      return token === null ? Promise.resolve(null) : token();
    },
  };
}
