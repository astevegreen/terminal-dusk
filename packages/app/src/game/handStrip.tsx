// The hand strip along the bottom edge (L6, #486; docs/design/screen-layout.md; Decision 6's bottom sheet in its
// folded form). Each card is a chip; tapping one lifts it above the strip, over the middle third of the screen,
// with its full text and the waiting decision's choices for it. The lifted card drops back on a tap elsewhere, on
// Escape, on a second tap of its chip, or when it leaves the hand. Keyboard: the arrow keys (and Home and End) move
// along the strip, Enter lifts, Escape drops. Which card is lifted is local UI state; GameScreen stays hook-free.
import { memo, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { CardId } from "@terminal-dusk/engine";
import { ChipFace, chipName } from "./handCards.tsx";
import type { StripChip } from "./handCards.tsx";

/** The chip the keyboard moves to from chip `index` of `count` on `key`, or null for a key the strip ignores. */
export function stripMove(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return Math.min(index + 1, count - 1);
  if (key === "ArrowLeft" || key === "ArrowUp") return Math.max(index - 1, 0);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/** The lifted card, if it is still in the hand: a card that has been played or discarded drops by itself. */
export function liftedIn(chips: readonly StripChip[], lifted: CardId | null): CardId | null {
  return lifted !== null && chips.some((chip) => chip.card === lifted) ? lifted : null;
}

/** Focuses the lifted card's first button, or the card itself when it offers none. */
function focusInto(card: HTMLElement | null | undefined): void {
  (card?.querySelector<HTMLElement>("button") ?? card)?.focus();
}

function HandStripInner({
  chips,
  counts,
  children,
}: Readonly<{ chips: readonly StripChip[]; counts: ReactNode; children: readonly ReactNode[] }>) {
  const [picked, setPicked] = useState<CardId | null>(null);
  const [current, setCurrent] = useState(0);
  const lifted = liftedIn(chips, picked);
  const base = useId();
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const focusOnLift = useRef(false);
  const at = Math.min(current, Math.max(chips.length - 1, 0));
  const liftedAt = chips.findIndex((chip) => chip.card === lifted);

  // A lift moves the keyboard's place onto the card, so its buttons are the next thing Enter or Tab reaches.
  useEffect(() => {
    if (!focusOnLift.current || liftedAt < 0) return;
    focusOnLift.current = false;
    focusInto(cardRefs.current[liftedAt]);
  }, [liftedAt]);

  // While a card is lifted, Escape drops it (the keyboard's place goes back to its chip), and a tap anywhere but on
  // the card or the strip's chips drops it too.
  useEffect(() => {
    if (liftedAt < 0) return undefined;
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setPicked(null);
      chipRefs.current[liftedAt]?.focus();
    };
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (target && (cardRefs.current[liftedAt]?.contains(target) || strip.current?.contains(target))) return;
      setPicked(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [liftedAt]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next = stripMove(event.key, at, chips.length);
    if (next === null) return;
    event.preventDefault();
    setCurrent(next);
    chipRefs.current[next]?.focus();
  };

  return (
    <section aria-label="Your hand" data-testid="hand" className="game-strip">
      <div ref={strip} role="toolbar" aria-label="Your cards" className="strip-cards" onKeyDown={onKeyDown}>
        {chips.map((chip, i) => (
          <button
            key={chip.card}
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            type="button"
            className="strip-chip"
            data-side={chip.side}
            aria-label={chipName(chip)}
            aria-expanded={chip.card === lifted}
            aria-controls={`${base}-card-${i}`}
            tabIndex={i === at ? 0 : -1}
            onClick={() => {
              setCurrent(i);
              focusOnLift.current = chip.card !== lifted;
              setPicked(chip.card === lifted ? null : chip.card);
            }}
          >
            <ChipFace chip={chip} />
          </button>
        ))}
      </div>
      {counts}
      {chips.map((chip, i) => (
        <div
          key={chip.card}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          id={`${base}-card-${i}`}
          role="dialog"
          aria-label={chip.name}
          className="game-lifted"
          data-side={chip.side}
          tabIndex={-1}
          hidden={chip.card !== lifted}
        >
          {children[i]}
        </div>
      ))}
    </section>
  );
}

/**
 * Takes one lifted card per chip as children, in the chips' order. Wrapped in `memo`, like SideTabs: the test
 * walkers that call function components directly (testMode/promptTree.ts, online/test/screenTree.ts) step over its
 * hooks and walk on into the lifted cards, reaching the choices on them.
 */
export const HandStrip = memo(HandStripInner);
