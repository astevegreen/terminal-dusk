// The first deck as a game the app can start: the ruleset, a match config with a seeded deal, and card names.
// The app may not import content (docs/architecture.md), so this is the route from the real cards to the screens.
// The deal is a stopgap: hands are fixed at the start and never refilled (docs/design/cards/deck-plan.md, Owner
// question 27), so each side gets 9 of its own cards, 4 of the rival's and 4 neutral ones, all 34 cards dealt.
import {
  ERA_1_CARDS,
  FIRST_DECK_RULESET,
  FIRST_DECK_SCENARIO,
  cardName,
  scenarioSetup,
} from "@terminal-dusk/content/first-deck";
import type { CardId, Ruleset, Seed } from "@terminal-dusk/engine";
import type { MatchConfig } from "./types.ts";

export const FIRST_DECK_NOTE =
  "First deck, Eras 1 and 2 (TEST scenario with placeholder numbers; Era 2 joins on turn 3)";
export const firstDeckRuleset: Ruleset = FIRST_DECK_RULESET;
export { cardName as firstDeckCardName };

const OWN = 9;
const RIVAL = 4;
const NEUTRAL = 4;

/** A small seeded random generator (no Math.random): the same seed always gives the same numbers. */
function randomFrom(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  let a = h;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** The match config for the first deck: the TEST scenario's numbers and a deal that depends only on `seed`. */
export function firstDeckConfig(seed: Seed): MatchConfig {
  const next = randomFrom(`deal:${String(seed)}`);
  const ids = (side: string): CardId[] =>
    shuffled(
      ERA_1_CARDS.filter((c) => c.affiliation === side).map((c) => c.id),
      next,
    );
  const lio = ids("lio");
  const sae = ids("sae");
  const neutral = ids("neutral");
  return {
    matchId: "first-deck",
    players: { lio: "player-lio", sae: "player-sae" },
    setup: {
      hands: {
        lio: [...lio.slice(0, OWN), ...sae.slice(OWN, OWN + RIVAL), ...neutral.slice(0, NEUTRAL)],
        sae: [...sae.slice(0, OWN), ...lio.slice(OWN, OWN + RIVAL), ...neutral.slice(NEUTRAL, 2 * NEUTRAL)],
      },
      deck: [],
      ...scenarioSetup(FIRST_DECK_SCENARIO),
    },
  };
}
