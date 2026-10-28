// The words the game screens share: side names, era names, why a game ended, and what the log calls cards and
// eras. Display data only; era names come from the first deck through the host (the app may not import content).
import type { CardId, EraId, GameStatus, Side } from "@terminal-dusk/engine";
import { firstDeckEraName } from "@terminal-dusk/host/first-deck";

/** A card's shown name. */
export type Label = (card: CardId) => string;

/** What a log line calls a card and an era. */
export type GameNames = { card: Label; era: (era: EraId) => string };

export const SIDE_NAME: Record<Side, string> = { lio: "LIO", sae: "SAE" };

/** An era's shown name, such as "Era 2 (2001–2008)"; an id with no name shows as it is. */
export const eraText = (era: EraId): string => firstDeckEraName(era);

/** Why a game ended, in words, for each reason the engine gives (apply.ts, turn.ts). */
const REASON_TEXT: Record<string, string> = {
  turnLimitReached: "the last turn ended",
  resigned: "the other side resigned",
  timeout: "time ran out",
};

/** A game-over reason in words; a reason with no words shows as it is. */
export const reasonText = (reason: string): string =>
  Object.hasOwn(REASON_TEXT, reason) ? (REASON_TEXT[reason] ?? reason) : reason;

/** "Game over: LIO, the other side resigned", or "Game over: no winner, …". */
export const gameOverText = (status: Extract<GameStatus, { kind: "over" }>): string =>
  `Game over: ${status.winner === null ? "no winner" : SIDE_NAME[status.winner]}, ${reasonText(status.reason)}`;
