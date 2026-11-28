// The ranked deadline presets (docs/architecture.md, Decision 5; #681). A search names a preset, and two
// players are paired only on the same name. Ranked always uses loss on time (Decision 5, "Scheduled jobs").
import type { MatchDeadline } from "@terminal-dusk/host";

/** The three presets the owner approved (27 Nov 2026). Their NAMES are settled. */
export const RANKED_PRESETS = ["fast", "normal", "slow"] as const;
export type RankedPreset = (typeof RANKED_PRESETS)[number];

/**
 * PLACEHOLDER, NOT A SETTLED VALUE. The owner has approved three presets but not given their hours (open design
 * question on #681), so these days are stand-ins until they do. This is the one place the hours live: change
 * them here, and nowhere else. Every preset uses loss on time.
 */
export const PLACEHOLDER_PRESET_DEADLINE: Record<RankedPreset, MatchDeadline> = {
  fast: { rule: "lossOnTime", days: 1 },
  normal: { rule: "lossOnTime", days: 3 },
  slow: { rule: "lossOnTime", days: 7 },
};

export const isRankedPreset = (value: unknown): value is RankedPreset => RANKED_PRESETS.includes(value as RankedPreset);
