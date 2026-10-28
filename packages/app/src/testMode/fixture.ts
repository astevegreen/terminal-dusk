// DEVELOPER FIXTURE for test mode. It is never game content: the cards are placeholders named
// "Test card 1", "Test card 2" and so on, with no history text and no real names. It is a small ruleset
// that has every kind of prompt: markers, yes/no questions and Contingency draws, cards of both sides and
// neutral ones, 2 turns and 2 plays per turn.
import type { CardDef, CardId, Ruleset, Step } from "@terminal-dusk/engine";
import type { MatchConfig } from "@terminal-dusk/host";
import { firstDeckTestMap } from "@terminal-dusk/host/first-deck";

export const DEFAULT_SEED = "test-mode";

const COUNT = 16;
const ids: CardId[] = Array.from({ length: COUNT }, (_, i) => `t${i + 1}`);
/** A card's display name: "Test card 3" for the third. Display data only. */
export const cardName = (id: CardId): string => `Test card ${id.slice(1)}`;
/** A card's yes/no question: the fixture cards have no rules text, so none, and their prompts keep the plain text. */
export const cardQuestion: (id: CardId) => string | undefined = () => undefined;

/** Cards 1-6 are LIO's, 7-12 are SAE's, 13-16 are neutral. */
const affiliationOf = (n: number): CardDef["affiliation"] => (n <= 6 ? "lio" : n <= 12 ? "sae" : "neutral");

/** The event of card `n`: it always shows a marker, and some ask a side yes or no or draw a contingency. */
function effectOf(n: number): Step[] {
  const label = `${cardName(`t${n}`)} event`;
  if (affiliationOf(n) === "neutral") return [];
  if (n % 3 === 0)
    return [
      { op: "drawContingency", side: affiliationOf(n) as "lio" | "sae", bind: "n" },
      { op: "marker", label, var: "n" },
    ];
  if (n % 3 === 2) {
    return [
      { op: "choose", who: n % 2 === 0 ? "lio" : "sae", decision: { kind: "yesNo" }, bind: "a" },
      { op: "marker", label, var: "a" },
    ];
  }
  return [{ op: "marker", label }];
}

export const fixtureRuleset: Ruleset = {
  id: "developer-test-fixture",
  cards: ids.map((id, i) => ({
    id,
    era: "test",
    ops: 1 + (i % 3),
    affiliation: affiliationOf(i + 1),
    effect: effectOf(i + 1),
  })),
};

/** Whose a fixture card is, from the same table as the ruleset, so the prompts offer only the plays it allows. */
export const cardAffiliation = (id: CardId): CardDef["affiliation"] | undefined =>
  fixtureRuleset.cards.find((card) => card.id === id)?.affiliation;

/** Each hand has the 6 non-neutral cards two turns of an opening card and 2 plays need, one of them the rival's. */
export const fixtureConfig: MatchConfig = {
  matchId: "test-mode",
  players: { lio: "developer-lio", sae: "developer-sae" },
  setup: {
    hands: {
      lio: ["t1", "t2", "t3", "t4", "t5", "t7", "t13"],
      sae: ["t9", "t10", "t11", "t12", "t8", "t6", "t14"],
    },
    deck: ["t15", "t16"],
    turns: 2,
    playsPerTurn: 2,
    // The smallest hand size: the dealt hands never drop below it, so this game draws no cards.
    handSize: 3,
    contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
  },
};

/**
 * The test mode's own game: fixtureConfig on R14's test map (a fresh copy each call, from the host), so the map
 * shows in the running app. fixtureConfig itself, which the vs-AI fixture game also uses, keeps no map.
 */
export const testModeConfig = (): MatchConfig => ({
  ...fixtureConfig,
  setup: { ...fixtureConfig.setup, firstEra: "era-1", map: firstDeckTestMap() },
});
