// What the purchase controls need, handed down by App to whichever screen draws them (#685): the Platform's
// purchases, its sentence about them, whether this player owns the game here, and the way to sign-in. Null where the
// Platform sells nothing, and the controls are then off or left out.
import { createContext } from "react";
import type { Purchases } from "../platform/purchases.ts";

export type PurchaseDesk = {
  purchases: Purchases;
  /** Said beside the buy button: what a purchase on this platform does not unlock. */
  note: string;
  owned: boolean;
  openSignIn: () => void;
};

export const PurchaseDeskContext = createContext<PurchaseDesk | null>(null);
