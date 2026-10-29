// The small regions of the game screen. Each one only shows fields of the frame it is given; none works
// anything out from the cards (.claude/rules/app.md).
import { DECKS, SIDES } from "@terminal-dusk/engine";
import type { AnswerValue, CardId, DeckId, EraId, PublicState, Side } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import type { ReactNode } from "react";
import { eraText, gameOverText, playsText, sideFullName } from "../displayText.ts";
import type { Choice } from "../promptChoices.tsx";
import type { CardRules, Label } from "../displayText.ts";
import { ZoomableMap } from "./ZoomableMap.tsx";

export type { Label } from "../displayText.ts";
const DISCARD_SHOWN = 5;

/**
 * A named region: an accessible name and a test id. `role` overrides the section's region role (the log);
 * `scrolls` makes it reachable by keyboard, for a region that is itself the scrolling element.
 */
export function Region({
  id,
  title,
  className,
  role,
  scrolls,
  children,
}: Readonly<{ id: string; title: string; className?: string; role?: "log"; scrolls?: boolean; children: ReactNode }>) {
  return (
    <section aria-label={title} data-testid={id} className={className} role={role} tabIndex={scrolls ? 0 : undefined}>
      {children}
    </section>
  );
}

const upper = (side: Side): string => side.toUpperCase();
const names = (cards: CardId[], label: Label): string => (cards.length === 0 ? "none" : cards.map(label).join(", "));
const holds = (frame: Frame, side: Side): string => `${upper(side)} holds ${frame.view.counts.hands[side]} cards`;

function viewerText(frame: Frame): string {
  return frame.viewer === "spectator" ? "Spectating" : `You play ${sideFullName(frame.viewer)}`;
}

function statusText(frame: Frame): string {
  const { status } = frame.view.public;
  if (status.kind === "over") return gameOverText(status);
  if (frame.viewer === "spectator") return "Game active";
  return frame.decision ? "Your decision" : "Waiting for the other side";
}

export function StatusBar({ frame, era }: Readonly<{ frame: Frame; era: EraId | null }>) {
  const pub = frame.view.public;
  return (
    <Region id="status-bar" title="Status" className="game-status">
      <span>{viewerText(frame)}</span>
      <span>{`Turn ${pub.turn} of ${pub.turns}`}</span>
      <span>{playsText(pub)}</span>
      <span>{era === null ? "Era not shown yet" : eraText(era)}</span>
      {/* Only the state text is a polite live region, so its change is announced and the rest is not. */}
      <span role="status">{statusText(frame)}</span>
    </Region>
  );
}

/**
 * The map, zoomed out or into one region. It is itself the scrolling element, so the keyboard can reach it. The
 * waiting decision's country choices glow on it, and a tap on one sends its answer (L7, #487).
 */
export function MapArea({
  frame,
  choices,
  onAnswer,
}: Readonly<{ frame: Frame; choices?: readonly Choice[]; onAnswer?: ((value: AnswerValue) => void) | undefined }>) {
  return (
    <Region id="map-area" title="Map" className="game-map" scrolls>
      <ZoomableMap
        pub={frame.view.public}
        events={frame.events}
        {...(choices === undefined ? {} : { choices })}
        onAnswer={onAnswer}
      />
    </Region>
  );
}

/** One card in the hand: its name, with its rules text on its own line when the game has rules text for it. */
export function HandCard({
  card,
  label,
  rules,
}: Readonly<{ card: CardId; label: Label; rules: CardRules | undefined }>) {
  const text = rules?.(card);
  if (text === undefined) return <li>{label(card)}</li>;
  return (
    <li>
      <span className="hand-card-name">{label(card)}</span>
      <span className="hand-card-rules">{text}</span>
    </li>
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

export function Table({ pub, label }: Readonly<{ pub: PublicState; label: Label }>) {
  const { inPlay, discard } = pub;
  const newest = discard.slice(-DISCARD_SHOWN).reverse();
  return (
    <Region id="table" title="Table">
      <p>{`In play: ${names(inPlay, label)}`}</p>
      <p>{`Discard pile: ${discard.length} cards. Last ${DISCARD_SHOWN}, newest first: ${names(newest, label)}`}</p>
    </Region>
  );
}

/** A Contingency deck's name on screen: "LIO", "SAE" or "World". */
const deckName = (id: DeckId): string => (id === "world" ? "World" : upper(id));

export function Contingency({ pub }: Readonly<{ pub: PublicState }>) {
  return (
    <Region id="contingency" title="Contingency decks">
      {DECKS.map((id) => {
        const deck = pub.contingency[id];
        return (
          <p
            key={id}
          >{`${deckName(id)}: ${deck.left.length} left: ${deck.left.join(", ")}. Deck: ${deck.cards.join(", ")}`}</p>
        );
      })}
    </Region>
  );
}

/** The log arrives oldest first and is shown newest first. Its list can take the keyboard; its Log tab scrolls. */
export function Log({ log }: Readonly<{ log: string[] }>) {
  return (
    <Region id="log" title="Log" className="game-log" role="log">
      <ol aria-label="Log entries" tabIndex={0}>
        {[...log].reverse().map((line, i) => (
          <li key={log.length - i}>{line}</li>
        ))}
      </ol>
    </Region>
  );
}
