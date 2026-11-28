// The words of the "Find a ranked game" screen (#682).
import type { Side } from "@terminal-dusk/engine";
import type { RankedPreset } from "./ranked.ts";

/**
 * The preset names as the screen shows them. PLACEHOLDER: the owner has approved three presets but not their hours
 * (open design question on #681), so no hours are shown. The hours live in one place, the server's
 * rankedPresets.ts; when they are settled, add them to these lines.
 */
export const PRESET_LABEL: Record<RankedPreset, string> = { fast: "Fast", normal: "Normal", slow: "Slow" };

export const SIDE_CHOICE: [string, Side | null][] = [
  ["No preference", null],
  ["LIO", "lio"],
  ["SAE", "sae"],
];

export const SEARCHING = "Searching for an opponent…";
export const SEARCHING_HINT =
  "You can close the app. When a game starts you get a notification, and the game appears under My games.";
export const AI_LINK = "Play the AI while you wait";
export const FULL_GAME_OFFER =
  "Ranked games are for owners of the Full Game. Your free game and the games you are invited to stay free.";
/** PLACEHOLDER notification text, until the owner writes the real words. */
export const STARTED_NOTIFICATION_PLACEHOLDER = "Placeholder notification text: your ranked game has started.";
