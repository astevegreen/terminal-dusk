// The small regions of the game screen. Each one only shows fields of the frame it is given; none works
// anything out from the cards (.claude/rules/app.md).
import { SIDES } from "@terminal-dusk/engine";
import type { CardId, EraId, Side } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import type { ReactNode } from "react";

export type Label = (card: CardId) => string;
const DISCARD_SHOWN = 5;

/** A named region: `role="region"`, an accessible name and a test id. */
export function Region({
  id,
  title,
  className,
  children,
}: Readonly<{ id: string; title: string; className?: string; children: ReactNode }>) {
  return (
    <section role="region" aria-label={title} data-testid={id} className={className}>
      {children}
    </section>
  );
}

const upper = (side: Side): string => side.toUpperCase();
const names = (cards: CardId[], label: Label): string => (cards.length === 0 ? "none" : cards.map(label).join(", "));
const holds = (frame: Frame, side: Side): string => `${upper(side)} holds ${frame.view.counts.hands[side]} cards`;

function viewerText(frame: Frame): string {
  return frame.viewer === "spectator" ? "Spectating" : `You play ${upper(frame.viewer)}`;
}

function statusText(frame: Frame): string {
  const { status } = frame.view.public;
  if (status.kind === "over") return `Game over: ${status.winner ?? "no winner"}, ${status.reason}`;
  if (frame.viewer === "spectator") return "Game active";
  return frame.decision ? "Your decision" : "Waiting for the other side";
}

export function StatusBar({ frame, era }: Readonly<{ frame: Frame; era: EraId | null }>) {
  const pub = frame.view.public;
  return (
    <Region id="status-bar" title="Status" className="game-status">
      <span>{viewerText(frame)}</span>
      <span>{`Turn ${pub.turn} of ${pub.turns}`}</span>
      <span>{`Plays made: ${pub.playsMade} of ${pub.playsPerTurn}`}</span>
      <span>{era === null ? "Era not shown yet" : `Era: ${era}`}</span>
      <span>{statusText(frame)}</span>
    </Region>
  );
}

export function MapArea() {
  return (
    <Region id="map-area" title="Map" className="game-map">
      <p>Map: not designed yet</p>
    </Region>
  );
}

export function Hand({ frame, label }: Readonly<{ frame: Frame; label: Label }>) {
  const { mine } = frame.view;
  return (
    <Region id="hand" title="Your hand" className="game-hand">
      {mine ? (
        <ol>
          {mine.hand.map((card) => (
            <li key={card}>{label(card)}</li>
          ))}
        </ol>
      ) : (
        <p>{SIDES.map((s) => holds(frame, s)).join(", ")}</p>
      )}
    </Region>
  );
}

export function Opponent({ frame }: Readonly<{ frame: Frame }>) {
  if (frame.viewer === "spectator") return null;
  return (
    <Region id="opponent" title="Opponent">
      {SIDES.filter((s) => s !== frame.viewer).map((s) => (
        <p key={s}>{holds(frame, s)}</p>
      ))}
    </Region>
  );
}

export function Table({ frame, label }: Readonly<{ frame: Frame; label: Label }>) {
  const { inPlay, discard } = frame.view.public;
  const newest = discard.slice(-DISCARD_SHOWN).reverse();
  return (
    <Region id="table" title="Table">
      <p>{`In play: ${names(inPlay, label)}`}</p>
      <p>{`Discard pile: ${discard.length} cards. Last ${DISCARD_SHOWN}, newest first: ${names(newest, label)}`}</p>
    </Region>
  );
}

export function Contingency({ frame }: Readonly<{ frame: Frame }>) {
  return (
    <Region id="contingency" title="Contingency decks">
      {SIDES.map((s) => {
        const deck = frame.view.public.contingency[s];
        return (
          <p
            key={s}
          >{`${upper(s)}: ${deck.left.length} left: ${deck.left.join(", ")}. Deck: ${deck.cards.join(", ")}`}</p>
        );
      })}
    </Region>
  );
}

/** The log arrives oldest first and is shown newest first. */
export function Log({ log }: Readonly<{ log: string[] }>) {
  return (
    <Region id="log" title="Log" className="game-log">
      <ol>
        {[...log].reverse().map((line, i) => (
          <li key={log.length - i}>{line}</li>
        ))}
      </ol>
    </Region>
  );
}
