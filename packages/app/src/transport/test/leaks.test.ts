// The rehearsal's leak check itself (#379, #380): a card the viewer was shown and a public deck list are not leaks
// where they only show up as what the viewer may see, and are leaks anywhere else.
import { hostCreate } from "@terminal-dusk/host";
import type { MatchSecret } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { canonical, leaksFor } from "./leaks.ts";

const made = hostCreate(
  firstDeckRuleset,
  { ...firstDeckConfig(), matchId: "m1", players: { lio: "alice", sae: "bob" } },
  "seed-1",
  1_700_000_000_000,
);
if (!made.ok) throw new Error(`hostCreate failed: ${made.error.code}`);
const start: MatchSecret = made.value.secret;

/** The match after sae picked its first card, with lio shown that card when `known`. */
function picked(known: boolean): { secret: MatchSecret; card: string } {
  const secret = structuredClone(start);
  const card = secret.state.private.sae.hand[0] as string;
  secret.state.private.sae.picks = [{ group: "g1", decisionId: "d1-sae", value: { kind: "chooseCard", card } }];
  if (known) secret.state.private.lio.knowledge = [card];
  return { secret, card };
}

describe("leaksFor and a rival's pick card the viewer was shown (#379)", () => {
  it("does not flag a rival pick card whose only appearance is the viewer's own knowledge list", () => {
    const { secret, card } = picked(true);
    expect(leaksFor(canonical({ mine: { knowledge: [card] } }), secret, "lio")).toEqual([]);
  });

  it("still flags the same card anywhere else in the text", () => {
    const { secret, card } = picked(true);
    const text = canonical({ mine: { knowledge: [card] }, elsewhere: [card] });
    expect(leaksFor(text, secret, "lio")).toContain(`sae's unrevealed pick card ${JSON.stringify(card)}`);
  });

  it("still flags it in a knowledge list when the viewer was not shown it", () => {
    const { secret, card } = picked(false);
    const text = canonical({ mine: { knowledge: [card] } });
    expect(leaksFor(text, secret, "lio")).toContain(`sae's unrevealed pick card ${JSON.stringify(card)}`);
  });
});

const FULL = [1, 2, 3, 4, 5, 6];

/** The match with sae's hidden order `order` and the given public lists; the other decks' orders match nothing. */
function ordered(order: number[], lists: Partial<MatchSecret["state"]["public"]["contingency"]>): MatchSecret {
  const secret = structuredClone(start);
  secret.state.secret.contingency = { lio: [6, 1, 5], sae: order, world: [5, 1, 6] };
  secret.state.public.contingency = {
    lio: { cards: FULL, left: FULL },
    sae: { cards: FULL, left: FULL },
    world: { cards: FULL, left: FULL },
    ...lists,
  };
  return secret;
}

describe("leaksFor and a hidden order that equals a public deck list (#380)", () => {
  it("does not flag an order whose only match is the decks' public cards and left lists", () => {
    const secret = ordered([...FULL], {});
    const text = canonical({ contingency: secret.state.public.contingency });
    expect(leaksFor(text, secret, "lio")).toEqual([]);
  });

  it("does not flag an order whose only match is another deck's public left list", () => {
    const secret = ordered([2, 5], { lio: { cards: FULL, left: [2, 5] }, sae: { cards: FULL, left: [2, 5, 6] } });
    const text = canonical({ contingency: secret.state.public.contingency });
    expect(leaksFor(text, secret, "lio")).toEqual([]);
  });

  it("still flags the same order under any other key", () => {
    const secret = ordered([...FULL], {});
    const decks = secret.state.public.contingency;
    for (const text of [
      canonical({ contingency: decks, top: FULL }),
      canonical({ contingency: { sae: { drawn: FULL } } }),
      canonical({ x: { left: FULL } }),
    ]) {
      expect(leaksFor(text, secret, "lio"), text).toEqual(["sae's Contingency order"]);
    }
  });

  it("still flags an order in a deck-shaped list that is not the deck's public list", () => {
    const secret = ordered([4, 1, 6], { sae: { cards: FULL, left: [1, 4, 6] } });
    const text = canonical({ contingency: { sae: { cards: FULL, left: [4, 1, 6] } } });
    expect(leaksFor(text, secret, "lio")).toEqual(["sae's Contingency order"]);
  });
});
