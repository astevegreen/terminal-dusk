// The Platform's `purchases` (docs/architecture.md, Decision 7), as every platform's implementation offers them.
// The screens know only these shapes; what a platform does behind them stays under platform/ (hard rule 8).
import type { EntitlementSession } from "../entitlements/session.ts";
import type { LobbyEndpoint } from "../online/lobbyHttp.ts";

/** Why a purchase action did not happen, as a code a screen can put in words. */
export type PurchaseRefusal =
  | "notSignedIn"
  | "badCode"
  | "unknownCode"
  | "codeUsed"
  | "alreadyOwned"
  | "tooManyGuesses"
  | "checkoutUnavailable"
  | "network";

/** The rejection of `restore` and `redeemCode`; it carries the code only, never server text or a token. */
export class PurchaseError extends Error {
  readonly code: PurchaseRefusal;
  constructor(code: PurchaseRefusal) {
    super(`purchase refused: ${code}`);
    this.name = "PurchaseError";
    this.code = code;
  }
}

/** What came of `unlock`: the player must sign in first, the payment page is opening, or it could not be opened. */
export type PurchaseResult = { status: "signIn" } | { status: "opened" } | { status: "refused"; code: PurchaseRefusal };

export type Purchases = {
  /** Starts a purchase of the Full Game. */
  unlock(): Promise<PurchaseResult>;
  /** Reads what the player owns from the server again; rejects with `PurchaseError` when it can't. */
  restore(): Promise<void>;
  /** Redeems a gift code; rejects with `PurchaseError`. Absent where the platform's store forbids codes. */
  redeemCode?(code: string): Promise<void>;
};

/** A purchase just made and not seen yet: none, still being looked for, or not there after the last try. */
export type PurchaseArrival = "none" | "waiting" | "late";

/** A platform's purchases as one app uses them. */
export type PlatformPurchases = {
  purchases: Purchases;
  /** What the offer must say about buying here. */
  note: string;
  /** Starts looking for a purchase just made, if there is one; returns the call that stops. */
  start(): () => void;
  subscribe(listener: () => void): () => void;
  getArrival(): PurchaseArrival;
};

/** What a platform's purchases are built over: the server, the signed-in player and what they own. */
export type PurchaseAccount = {
  endpoint: LobbyEndpoint;
  /** Null when signed out; rejects when an expired token can't be refreshed just now. */
  accessToken(): Promise<string | null>;
  entitlements: EntitlementSession;
};

export type PurchasesFactory = (account: PurchaseAccount) => PlatformPurchases;
