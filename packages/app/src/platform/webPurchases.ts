// The web's purchases (#685): checkout on the app's own pay page (Paddle), Restore from the server and gift codes.
// The client sends only the player's token (and a gift code): which product and price, and whose purchase it is, are
// the server's to say. No result carries the server's message text or the token.
import { isObject, postFunction } from "../online/lobbyHttp.ts";
import { PurchaseError } from "./purchases.ts";
import type { PurchaseAccount, PurchaseRefusal, PurchaseResult, Purchases } from "./purchases.ts";

export type WebPurchasesSetup = PurchaseAccount & {
  /** Leaves the app for an address, in the same tab. */
  navigate(url: string): void;
  /** The app's own origin: the only place a checkout address may point. */
  origin: string;
};

type Reply = Awaited<ReturnType<typeof postFunction>>;

const TRANSACTION = /^txn_[A-Za-z0-9]+$/;

/** The refusal codes of the `checkout` and `redeem` functions that are passed on as they are. */
const CHECKOUT_CODES: readonly PurchaseRefusal[] = ["alreadyOwned", "checkoutUnavailable"];
const REDEEM_CODES: readonly PurchaseRefusal[] = ["unknownCode", "codeUsed", "alreadyOwned", "tooManyGuesses"];

const serverCode = (body: unknown): unknown =>
  isObject(body) && body.ok === false && isObject(body.error) ? body.error.code : undefined;

/** Why a reply that is no success was refused. */
function refusalOf(reply: Reply, passedOn: readonly PurchaseRefusal[]): PurchaseRefusal {
  if (reply === null) return "network";
  if (reply.status === 401) return "notSignedIn";
  const code = serverCode(reply.body);
  return passedOn.find((known) => known === code) ?? "network";
}

/** The success body of a reply, or null. */
const success = (reply: Reply): Record<string, unknown> | null =>
  reply?.ok && isObject(reply.body) && reply.body.ok === true ? reply.body : null;

/** The address when it is the app's own pay page with a transaction, otherwise null. */
function payPage(address: unknown, origin: string): string | null {
  if (typeof address !== "string" || !URL.canParse(address)) return null;
  const url = new URL(address);
  const transaction = url.searchParams.get("_ptxn") ?? "";
  return url.origin === origin && url.pathname === "/pay/" && TRANSACTION.test(transaction) ? url.href : null;
}

export function createWebPurchases(setup: WebPurchasesSetup): Required<Purchases> {
  const { endpoint, entitlements } = setup;
  const signedOut = (): boolean => entitlements.getSnapshot().state === "signedOut";

  /** The player's token; null when signed out. Rejects with `network` when it can't be had just now. */
  const token = async (): Promise<string | null> => {
    try {
      return await setup.accessToken();
    } catch {
      throw new PurchaseError("network");
    }
  };

  const checkout = async (bearer: string): Promise<PurchaseResult> => {
    const reply = await postFunction(endpoint, bearer, "checkout", {});
    const url = payPage(success(reply)?.url, setup.origin);
    if (url !== null) {
      setup.navigate(url);
      return { status: "opened" };
    }
    const code = refusalOf(reply, CHECKOUT_CODES);
    // The app is behind the server: reading again takes the offer away.
    if (code === "alreadyOwned") await entitlements.reload();
    return { status: "refused", code };
  };

  return {
    async unlock() {
      if (signedOut()) return { status: "signIn" };
      let bearer: string | null;
      try {
        bearer = await token();
      } catch {
        return { status: "refused", code: "network" };
      }
      return bearer === null ? { status: "signIn" } : checkout(bearer);
    },
    async restore() {
      await entitlements.reload();
      const { state } = entitlements.getSnapshot();
      if (state === "signedOut") throw new PurchaseError("notSignedIn");
      if (state === "failed") throw new PurchaseError("network");
    },
    async redeemCode(code) {
      const typed = code.trim();
      if (typed === "") throw new PurchaseError("badCode");
      const bearer = await token();
      if (bearer === null) throw new PurchaseError("notSignedIn");
      const reply = await postFunction(endpoint, bearer, "redeem", { code: typed });
      const status = success(reply)?.status;
      if (status !== "redeemed" && status !== "alreadyYours") {
        // The function answers `illegalAnswer` to words that are no gift code at all.
        if (serverCode(reply?.body) === "illegalAnswer") throw new PurchaseError("badCode");
        throw new PurchaseError(refusalOf(reply, REDEEM_CODES));
      }
      await entitlements.reload();
    },
  };
}
