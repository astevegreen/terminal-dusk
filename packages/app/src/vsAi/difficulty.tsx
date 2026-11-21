// The AI's difficulty (#508): Easy, Medium or Hard, chosen before a game against the AI. Medium is the default for
// a new player, since Hard wins about 3 games in 4 against Medium (#507) and would put new players off. The choice
// is sent to the AI worker as its `tier`, and shown in the game's Details and in its replay.
import type { KeyValueStore } from "../platform/storage.ts";
import type { AiTier } from "./aiOpponent.ts";

export const AI_TIERS: readonly AiTier[] = ["easy", "medium", "hard"];
export const DEFAULT_TIER: AiTier = "medium";
export const TIER_NAME: Record<AiTier, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** The line that names the AI's difficulty, in the game's Details and in its replay. */
export const difficultyText = (tier: AiTier): string => `AI difficulty: ${TIER_NAME[tier]}`;

const TAP = { minHeight: 44, minWidth: 44 } as const;

/** Three radio buttons, each 44 px tall, one per difficulty; `tier` is the checked one. */
export function DifficultyPicker({ tier, onTier }: Readonly<{ tier: AiTier; onTier: (tier: AiTier) => void }>) {
  return (
    <fieldset>
      <legend>AI difficulty</legend>
      {AI_TIERS.map((t) => (
        <label key={t} style={{ ...TAP, display: "inline-flex", alignItems: "center", marginInlineEnd: 16 }}>
          <input type="radio" name="ai-difficulty" value={t} checked={t === tier} onChange={() => onTier(t)} />
          {TIER_NAME[t]}
        </label>
      ))}
    </fieldset>
  );
}

/** The storage key the chosen difficulty is kept under (Platform.storage, Decision 7). */
export const TIER_KEY = "vsAi.difficulty";

/** The saved difficulty; Medium when nothing is saved or the saved value is not one of the three. */
export async function loadTier(store: KeyValueStore): Promise<AiTier> {
  const saved = await store.get(TIER_KEY);
  return AI_TIERS.find((t) => t === saved) ?? DEFAULT_TIER;
}

/** Keeps the chosen difficulty for the next visit. */
export function saveTier(store: KeyValueStore, tier: AiTier): Promise<void> {
  return store.set(TIER_KEY, tier);
}
