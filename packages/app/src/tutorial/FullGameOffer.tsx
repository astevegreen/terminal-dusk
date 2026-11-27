// The Full Game offer at the end of a free player's tutorial (#647) and of the free game against the AI (#668): the
// free game stops after Era 1's scoring, and this says the Full Game plays on. Its words are placeholders, labelled as
// such, until the owner writes them. Where the Platform sells the game (#685, Decision 7) the buy button works, the
// Platform's sentence about the purchase is shown, and Restore purchase and the gift code field are one tap away;
// elsewhere the button stays disabled.
import { useContext } from "react";
import { BuyButton, RestoreAndRedeem } from "../purchases/PurchaseControls.tsx";
import { PurchaseDeskContext } from "../purchases/desk.ts";
import { RESTORE_OR_REDEEM } from "../purchases/purchaseText.ts";
import "./tutorial.css";

export { OFFER_BUY } from "../purchases/purchaseText.ts";

/** Shown above the offer while its words are placeholders. */
export const OFFER_PLACEHOLDER_LABEL = "Placeholder offer";
/** The offer's heading and words (placeholders). */
export const OFFER_TITLE = "The Full Game";
export const OFFER_TEXT = "Placeholder: the free game ends after Era 1. The Full Game plays on to 2025.";

const TAP = { minHeight: 44, minWidth: 44 } as const;

export function FullGameOffer() {
  const desk = useContext(PurchaseDeskContext);
  return (
    <section className="full-game-offer" aria-label={OFFER_TITLE}>
      <p className="tutorial-label">{OFFER_PLACEHOLDER_LABEL}</p>
      <h2>{OFFER_TITLE}</h2>
      <p>{OFFER_TEXT}</p>
      <BuyButton />
      {desk && (
        <>
          <p>{desk.note}</p>
          <details>
            <summary style={{ ...TAP, lineHeight: "44px", cursor: "pointer" }}>{RESTORE_OR_REDEEM}</summary>
            <RestoreAndRedeem />
          </details>
        </>
      )}
    </section>
  );
}
