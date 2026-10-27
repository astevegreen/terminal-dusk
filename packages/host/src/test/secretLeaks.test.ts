// The shared leak check itself (#379, #380, #396): a card the viewer was shown and a public deck list are not
// leaks where they only show up as what the viewer may see, and are leaks anywhere else. Every case runs on text
// with sorted keys (the app's rehearsal) and with the state's own key order (the server's responses).
import { describe, expect, it } from "vitest";
import { firstDeckConfig, firstDeckRuleset } from "../firstDeck.ts";
import { hostCreate } from "../hostCreate.ts";
import type { MatchSecret } from "../types.ts";
import { canonical, leaksFor } from "./secretLeaks.ts";

const made = hostCreate(
  firstDeckRuleset,
  { ...firstDeckConfig(), matchId: "m1", players: { lio: "alice", sae: "bob" } },
  "seed-1",
  1_700_000_000_000,
);
if (!made.ok) throw new Error(`hostCreate failed: ${made.error.code}`);
const start: MatchSecret = made.value.secret;
const copy = (secret: MatchSecret): MatchSecret => JSON.parse(JSON.stringify(secret)) as MatchSecret;

const ENCODINGS = [
  { keys: "sorted", encode: canonical },
  { keys: "in the state's own order", encode: (value: unknown): string => JSON.stringify(value) },
];

/** The match after sae picked its first card, with lio shown that card when `known`. */
function picked(known: boolean): { secret: MatchSecret; card: string } {
  const secret = copy(start);
  const card = secret.state.private.sae.hand[0] as string;
  secret.state.private.sae.picks = [{ group: "g1", decisionId: "d1-sae", value: { kind: "chooseCard", card } }];
  if (known) secret.state.private.lio.knowledge = [card];
  return { secret, card };
}

describe.each(ENCODINGS)("leaksFor and a rival's pick card the viewer was shown, keys $keys (#379)", ({ encode }) => {
  it("does not flag a rival pick card whose only appearance is the viewer's own knowledge list", () => {
    const { secret, card } = picked(true);
    expect(leaksFor(encode({ mine: { knowledge: [card] } }), secret, "lio")).toEqual([]);
  });

  it("still flags the same card anywhere else in the text", () => {
    const { secret, card } = picked(true);
    const text = encode({ mine: { knowledge: [card] }, elsewhere: [card] });
    expect(leaksFor(text, secret, "lio")).toContain(`sae's unrevealed pick card ${JSON.stringify(card)}`);
  });

  it("still flags it in a knowledge list when the viewer was not shown it, or is a spectator", () => {
    const text = (card: string): string => encode({ mine: { knowledge: [card] } });
    const unknown = picked(false);
    expect(leaksFor(text(unknown.card), unknown.secret, "lio")).toContain(
      `sae's unrevealed pick card ${JSON.stringify(unknown.card)}`,
    );
    const known = picked(true);
    expect(leaksFor(text(known.card), known.secret, "spectator")).toContain(
      `sae's unrevealed pick card ${JSON.stringify(known.card)}`,
    );
  });
});

const FULL = [1, 2, 3, 4, 5, 6];

/** The match with sae's hidden order `order` and the given public lists; the other decks' orders match nothing. */
function ordered(order: number[], lists: Partial<MatchSecret["state"]["public"]["contingency"]>): MatchSecret {
  const secret = copy(start);
  secret.state.secret.contingency = { lio: [6, 1, 5], sae: order, world: [5, 1, 6] };
  secret.state.public.contingency = {
    lio: { cards: FULL, left: FULL },
    sae: { cards: FULL, left: FULL },
    world: { cards: FULL, left: FULL },
    ...lists,
  };
  return secret;
}

describe.each(ENCODINGS)(
  "leaksFor and a hidden order that equals a public deck list, keys $keys (#380)",
  ({ encode }) => {
    it("does not flag an order whose only match is the decks' public cards and left lists", () => {
      const secret = ordered([...FULL], {});
      const text = encode({ contingency: secret.state.public.contingency });
      expect(leaksFor(text, secret, "lio")).toEqual([]);
      expect(leaksFor(text, secret, "spectator")).toEqual([]);
    });

    it("does not flag an order whose only match is another deck's public left list", () => {
      const secret = ordered([2, 5], { lio: { cards: FULL, left: [2, 5] }, sae: { cards: FULL, left: [2, 5, 6] } });
      const text = encode({ contingency: secret.state.public.contingency });
      expect(leaksFor(text, secret, "lio")).toEqual([]);
    });

    it("still flags the same order under any other key", () => {
      const secret = ordered([...FULL], {});
      const decks = secret.state.public.contingency;
      for (const text of [
        encode({ contingency: decks, top: FULL }),
        encode({ contingency: { sae: { drawn: FULL } } }),
        encode({ x: { left: FULL } }),
      ]) {
        expect(leaksFor(text, secret, "lio"), text).toEqual(["sae's Contingency order"]);
      }
    });

    it("still flags an order in a deck-shaped list that is not the deck's public list", () => {
      const secret = ordered([4, 1, 6], { sae: { cards: FULL, left: [1, 4, 6] } });
      const text = encode({ contingency: { sae: { cards: FULL, left: [4, 1, 6] } } });
      expect(leaksFor(text, secret, "lio")).toEqual(["sae's Contingency order"]);
    });
  },
);

describe.each(ENCODINGS)("leaksFor and a rival's private compartment, keys $keys (#396)", ({ encode }) => {
  it("flags the rival's whole compartment, and neither side's for a viewer who owns it", () => {
    const { secret } = picked(false);
    const text = encode({ other: secret.state.private.sae });
    expect(leaksFor(text, secret, "lio")).toContain("sae's private compartment");
    expect(leaksFor(text, secret, "spectator")).toContain("sae's private compartment");
    expect(leaksFor(text, secret, "sae")).toEqual([]);
  });

  it("flags a pick answer in the rival's compartment as an unrevealed pick", () => {
    const { secret } = picked(false);
    const [pick] = secret.state.private.sae.picks;
    expect(leaksFor(encode({ answer: pick?.value }), secret, "lio")).toContain("sae's unrevealed pick");
  });
});
