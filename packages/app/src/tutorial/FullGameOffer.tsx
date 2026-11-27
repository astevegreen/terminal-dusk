// The Full Game offer at the end of a free player's tutorial (#647): the free game stops after Era 1's scoring, and
// this says the Full Game plays on. Its words are placeholders, labelled as such, until the owner writes them. The buy
// button stays disabled until web checkout (phase 6) gives it an action through the Platform (Decision 7).

/** Shown above the offer while its words are placeholders. */
export const OFFER_PLACEHOLDER_LABEL = "Placeholder offer";
/** The offer's heading and words (placeholders). */
export const OFFER_TITLE = "The Full Game";
export const OFFER_TEXT = "Placeholder: the free game ends after Era 1. The Full Game plays on to 2025.";
/** The buy button's words; it has no action yet. */
export const OFFER_BUY = "Get the Full Game";

const TAP = { minHeight: 44, minWidth: 44 } as const;

export function FullGameOffer() {
  return (
    <section className="full-game-offer" aria-label={OFFER_TITLE}>
      <p className="tutorial-label">{OFFER_PLACEHOLDER_LABEL}</p>
      <h2>{OFFER_TITLE}</h2>
      <p>{OFFER_TEXT}</p>
      <button type="button" style={TAP} disabled>
        {OFFER_BUY}
      </button>
    </section>
  );
}
