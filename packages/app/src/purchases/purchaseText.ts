// The words of the purchase controls (#685). No price is ever written here: the payment page shows it.
import type { PurchaseArrival, PurchaseRefusal } from "../platform/purchases.ts";

/** The buy button's words, on the Full Game offer and in the account area. */
export const OFFER_BUY = "Get the Full Game";
export const RESTORE = "Restore purchase";
export const GIFT_CODE = "Redeem a gift code";
export const REDEEM = "Redeem";
/** The offer's way to the two controls above, kept folded so the offer stays small. */
export const RESTORE_OR_REDEEM = "Restore or redeem a gift code";

export const ACCOUNT_TITLE = "The Full Game";
export const OWNED = "You own the Full Game.";
export const RESTORED = "Your Full Game is restored.";
export const NOTHING_TO_RESTORE = "No purchase found on this account.";
export const REDEEMED = "Gift code redeemed.";

export const PURCHASE_REFUSAL: Record<PurchaseRefusal, string> = {
  notSignedIn: "The server didn't accept your sign-in. Sign out under Play online, then sign in again.",
  badCode: "That doesn't look like a gift code. Check it and try again.",
  unknownCode: "No gift code matches that. Check it and try again.",
  codeUsed: "That gift code has already been used.",
  alreadyOwned: "You already own the Full Game.",
  tooManyGuesses: "Too many tries. Wait a while and try again.",
  checkoutUnavailable: "Buying isn't available right now. Try again later.",
  network: "Couldn't reach the server. Check your connection and try again.",
};

/** What the home screen says after a return from the payment page, while the purchase isn't there yet. */
export const ARRIVAL: Record<Exclude<PurchaseArrival, "none">, string> = {
  waiting: "Looking for your new purchase…",
  late: "Placeholder: your purchase is still being processed. Press Restore purchase.",
};
