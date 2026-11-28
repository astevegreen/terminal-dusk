// The `checkout` Edge Function: gives the signed-in player the address of a Paddle checkout for the web copy of
// the game. The player comes only from the token; the request body is never read. Whether they then own the game
// is decided by the payment webhook alone. Logs carry outcome and reason codes only.
import type { CheckoutLimitStore } from "./checkoutLimitStore.ts";
import type { EntitlementStore } from "./entitlementStore.ts";
import { preflight, refusal as refusalReply, reply, signedIn } from "./http.ts";
import type { Authenticate, HttpReply, HttpRequest } from "./http.ts";
import type { CreateCheckout } from "./paddleCheckout.ts";

export type CheckoutHandlerDeps = {
  authenticate: Authenticate;
  entitlements: EntitlementStore;
  /** Counts each call per player; see checkoutLimitStore.ts. */
  limit: CheckoutLimitStore;
  now: () => number;
  /** Undefined while any of Paddle's settings or the app's address is unset. */
  checkout: CreateCheckout | undefined;
  log?: (line: string) => void;
};

type Code =
  "notSignedIn" | "methodNotAllowed" | "alreadyOwned" | "tooManyRequests" | "checkoutUnavailable" | "internalError";

const STATUS: Record<Code, number> = {
  notSignedIn: 401,
  methodNotAllowed: 405,
  alreadyOwned: 409,
  tooManyRequests: 429,
  checkoutUnavailable: 503,
  internalError: 500,
};

/** Answers one checkout request. Never throws. */
export async function handleCheckout(deps: CheckoutHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  try {
    return await handle(deps, request);
  } catch {
    return refused(deps, "internalError", "Something went wrong on the server. Try again.");
  }
}

async function handle(deps: CheckoutHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return refused(deps, "methodNotAllowed", "Use POST.");
  const player = await signedIn(deps.authenticate, request.authorization);
  if (player === null) return refused(deps, "notSignedIn", "Sign in first.");
  const owned = await deps.entitlements.forPlayer(player);
  if (owned.some((e) => e.platform === "web")) {
    return refused(deps, "alreadyOwned", "You already own the full game.");
  }
  // Counted before Paddle is asked, so a loop of calls cannot pile up transactions there.
  if ((await deps.limit.claim(player, deps.now())) === "limited") {
    return refused(deps, "tooManyRequests", "Too many checkout attempts. Try again in an hour.");
  }
  const address = deps.checkout ? await deps.checkout(player) : ({ ok: false, reason: "notConfigured" } as const);
  if (!address.ok) {
    return refused(
      deps,
      "checkoutUnavailable",
      "The checkout can't be opened right now. Try again later.",
      address.reason,
    );
  }
  log(deps, "checkout outcome=created");
  return reply(200, { ok: true, url: address.url });
}

function refused(deps: CheckoutHandlerDeps, code: Code, message: string, reason?: string): HttpReply {
  const why = reason === undefined ? "" : ` reason=${reason}`;
  log(deps, `checkout error=${code}${why}`);
  return refusalReply(STATUS[code], code, message);
}

function log(deps: CheckoutHandlerDeps, line: string): void {
  try {
    deps.log?.(line);
  } catch {
    // A failing logger must not break the reply.
  }
}
