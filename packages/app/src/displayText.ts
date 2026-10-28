// The words the game screens share: side names and who each side is, era names, why a game ended, and what the log calls cards and
// eras. Display data only; era names come from the first deck through the host (the app may not import content).
import type { CardId, EraId, GameStatus, PublicState, RegionId, Side } from "@terminal-dusk/engine";
import { firstDeckEraName } from "@terminal-dusk/host/first-deck";

/** A card's shown name. */
export type Label = (card: CardId) => string;

/** What a log line calls a card and an era. */
export type GameNames = { card: Label; era: (era: EraId) => string; region: (region: RegionId) => string };

/** A region's shown name from the frame's map; an id the map lacks (or a game with no map) shows as it is. */
export const regionNamer =
  (pub: PublicState): GameNames["region"] =>
  (id) =>
    pub.map?.regions.find((r) => r.id === id)?.name ?? id;

/** The score track's value in words: "LIO 3", "SAE 2" or "even". Negative leans LIO. */
export function scoreText(score: number): string {
  if (score === 0) return "even";
  return `${score < 0 ? "LIO" : "SAE"} ${Math.abs(score)}`;
}

/** Escalation's level names (docs/design/map-and-points.md), by level 0 to 6. */
export const ESCALATION_NAME: readonly string[] = [
  "Durable Peace",
  "Stable Peace",
  "Unstable Peace",
  "Confrontation",
  "Show of Force",
  "Brink",
  "Crisis",
];

/** A card's rules text, shown under its name in the hand; undefined when the game has none for it. */
export type CardRules = (card: CardId) => string | undefined;

export const SIDE_NAME: Record<Side, string> = { lio: "LIO", sae: "SAE" };

/** Each side spelled out and who it is, in the words of docs/design/sides.md. */
const SIDE_SPELLED: Record<Side, string> = {
  lio: "Liberal International Order",
  sae: "Strategic Authoritarian Entente",
};
export const SIDE_WHO: Record<Side, string> = {
  lio: "The US-led bloc of real states.",
  sae: "Russia and China as one unified side.",
};

/** "LIO (Liberal International Order)". */
export const sideFullName = (side: Side): string => `${SIDE_NAME[side]} (${SIDE_SPELLED[side]})`;

/** An era's shown name, such as "Era 2 (2001–2008)"; an id with no name shows as it is. */
export const eraText = (era: EraId): string => firstDeckEraName(era);

/**
 * "Plays this turn: 2 of 2". The frame's `playsMade` counts both sides' plays together, and each side makes
 * `playsPerTurn`, so the turn's total is twice that (#410).
 */
export const playsText = ({ playsMade, playsPerTurn }: { playsMade: number; playsPerTurn: number }): string =>
  `Plays this turn: ${playsMade} of ${2 * playsPerTurn}`;

/** Why a game ended, in words, for each reason the engine gives (apply.ts, turn.ts). */
const REASON_TEXT: Record<string, string> = {
  turnLimitReached: "the last turn ended",
  trackEnd: "the score track reached its end",
  resigned: "the other side resigned",
  timeout: "time ran out",
};

/** A game-over reason in words; a reason with no words shows as it is. */
export const reasonText = (reason: string): string =>
  Object.hasOwn(REASON_TEXT, reason) ? (REASON_TEXT[reason] ?? reason) : reason;

/** "Game over: LIO, the other side resigned", or "Game over: no winner, …". */
export const gameOverText = (status: Extract<GameStatus, { kind: "over" }>): string =>
  `Game over: ${status.winner === null ? "no winner" : SIDE_NAME[status.winner]}, ${reasonText(status.reason)}`;
