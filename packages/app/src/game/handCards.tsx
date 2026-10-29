// What the hand strip shows (L6, #486; docs/design/screen-layout.md), drawn from the frame and display data only:
// each card in the hand as a small chip (its points, its name and its side's colour), a lifted card with its full
// text and the choices the waiting decision offers for it, and the counts beside the strip (the rival's hand size,
// the deck and the discard pile). The rival's cards are never shown, only their number. No hooks here: the strip
// itself (handStrip.tsx) holds which card is lifted.
import { SIDES } from "@terminal-dusk/engine";
import type { CardId, Side } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import type { ReactNode } from "react";
import type { CardAffiliation } from "../decisionPrompts.tsx";
import { SIDE_NAME } from "../displayText.ts";
import type { CardPoints, CardRules, Label } from "../displayText.ts";

/** One card in the strip: what its chip shows. A card whose side is unknown shows as neutral. */
export type StripChip = { card: CardId; name: string; points: number | undefined; side: Side | "neutral" };

export function chipsOf(
  hand: readonly CardId[],
  label: Label,
  points: CardPoints | undefined,
  affiliation: CardAffiliation,
): StripChip[] {
  return hand.map((card) => ({
    card,
    name: label(card),
    points: points?.(card),
    side: affiliation(card) ?? "neutral",
  }));
}

const sideWord = (side: StripChip["side"]): string => (side === "neutral" ? "neutral" : SIDE_NAME[side]);
const pointsWord = (points: number): string => `${points} point${points === 1 ? "" : "s"}`;

/** A chip's name for a screen reader: "Test card 1, 2 points, LIO card". Never just the card's name, which is the
 *  opening pick's button text on the lifted card. */
export const chipName = ({ name, points, side }: StripChip): string =>
  [name, ...(points === undefined ? [] : [pointsWord(points)]), `${sideWord(side)} card`].join(", ");

/** What a chip shows: its points and its name, cut short with "…" by the strip's style when it must be. */
export function ChipFace({ chip }: Readonly<{ chip: StripChip }>) {
  return (
    <>
      {chip.points !== undefined && <span className="strip-chip-points">{chip.points}</span>}
      <span className="strip-chip-name">{chip.name}</span>
    </>
  );
}

/**
 * A lifted card: its points, name and side, its rules text in full when the game has it, and `children`, the
 * waiting decision's choices for this card (none when it offers none).
 */
export function LiftedCard({
  chip,
  rules,
  children,
}: Readonly<{ chip: StripChip; rules: CardRules | undefined; children?: ReactNode }>) {
  const text = rules?.(chip.card);
  return (
    <>
      <p className="lifted-head">
        {chip.points !== undefined && <span className="strip-chip-points">{chip.points}</span>}
        <span className="hand-card-name">{chip.name}</span>
        <span className="lifted-side">{`${sideWord(chip.side)} card`}</span>
      </p>
      {text !== undefined && <p className="hand-card-rules">{text}</p>}
      {children}
    </>
  );
}

/** The counts beside the strip: the rival's hand size (both sides' for a spectator), the deck and the discard pile. */
export function StripCounts({ frame }: Readonly<{ frame: Frame }>) {
  const { counts, public: pub } = frame.view;
  const hands =
    frame.viewer === "spectator"
      ? SIDES.map((side) => ({ side, text: `${SIDE_NAME[side]} ${counts.hands[side]}` }))
      : SIDES.filter((side) => side !== frame.viewer).map((side) => ({
          side,
          text: `Rival ${counts.hands[side]}`,
        }));
  return (
    <p className="strip-counts" data-testid="strip-counts">
      {hands.map(({ side, text }) => (
        <span key={side} data-side={side}>
          {text}
        </span>
      ))}
      <span>{`Deck ${counts.deck}`}</span>
      <span>{`Discard ${pub.discard.length}`}</span>
    </p>
  );
}
