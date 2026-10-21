// Test helper: whole games played through `submit`, calling back after every step with what is stored.
import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import type { MatchSecret } from "@terminal-dusk/host";
import type { MemoryStore } from "../store.ts";
import { submit } from "../submit.ts";
import { bodyFor, MATCH, NOW, ruleset, setup } from "./match.ts";

/** How one game is played: which waiting side answers first, which legal answer it picks, and when to resign. */
export type Strategy = {
  name: string;
  /** The side to answer when both are waiting. */
  first: Side;
  /** Which legal answer to pick: the first or the last. */
  pick: "first" | "last";
  /** Resign (as LIO) once this many answers have been made. Leave out to play to the end. */
  resignAfter?: number;
};

export const STRATEGIES: Strategy[] = [
  { name: "LIO answers first, first answers", first: "lio", pick: "first" },
  { name: "SAE answers first, last answers", first: "sae", pick: "last" },
  { name: "LIO resigns after its opening pick", first: "lio", pick: "first", resignAfter: 1 },
  { name: "SAE answers first, then LIO resigns", first: "sae", pick: "last", resignAfter: 3 },
];

/**
 * One step: the store after it, and the secret after it. Only the secret after counts: a card hidden
 * before the step (an opening pick, say) may be revealed by it.
 */
export type Step = { store: MemoryStore; secret: MatchSecret };

/** The legal answer number `pick` stands for. */
const pickIndex = (secret: MatchSecret, side: Side, pick: Strategy["pick"]): number =>
  pick === "first" ? 0 : legalAnswers(ruleset, secret.state, side).length - 1;

/** Plays one game to the end through `submit`, calling `visit` once at seq 0 and once after every step. */
export async function playGame(strategy: Strategy, visit: (step: Step) => Promise<void>): Promise<void> {
  const { store, deps, start } = setup();
  await visit({ store, secret: start.secret });
  let now = NOW;
  for (let answers = 0; ; answers++) {
    const loaded = (await store.load(MATCH))!;
    if (loaded.record.status.kind !== "active") return;
    const resign = strategy.resignAfter !== undefined && answers >= strategy.resignAfter;
    const waiting = SIDES.filter((side) => pendingFor(loaded.secret.state, side) !== null);
    const side = waiting.includes(strategy.first) ? strategy.first : waiting[0]!;
    const body = resign
      ? { resign: true }
      : bodyFor(loaded.record.seq, loaded.secret, side, pickIndex(loaded.secret, side, strategy.pick));
    const player = resign ? loaded.record.players.lio : loaded.record.players[side];
    const result = await submit(deps, { matchId: MATCH, player, body, now: ++now });
    if (!result.ok) throw new Error(`submit refused: ${result.error.code}`);
    await visit({ store, secret: (await store.load(MATCH))!.secret });
  }
}
