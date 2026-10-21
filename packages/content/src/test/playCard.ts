// Test helper: plays one real card through the real engine and tells what happened, in a short story.
// The game has one turn with two plays each. The card's owner (LIO for a neutral card) plays it for its event as
// the first of its plays; every other play is a plain filler card of ops 2 played for points, so the story also
// shows what the card leaves behind: modifiers, then triggers that fire after later plays and at the end of the turn.
import { apply, createGame, seedHash } from "@terminal-dusk/engine";
import type { Answer, CardDef, CardId, GameEvent, Ruleset, Side } from "@terminal-dusk/engine";
import { cardDef } from "../era1.ts";
import { FIRST_DECK_CARDS } from "../firstDeckRules.ts";

export type PlayOptions = {
  /** What each side answers when its yes/no question comes up. A missing answer fails the test. */
  yes?: Partial<Record<Side, boolean>>;
  /** The number on top of every Contingency deck, so the draw is known. Default: decks 1 to 6. */
  draw?: number;
};

const filler = (affiliation: Side, n: number): CardDef => ({
  id: `fill-${affiliation}-${n}`,
  era: "era-1",
  ops: 2,
  affiliation,
  effect: [],
});
const FILLERS: Record<Side, CardDef[]> = {
  lio: [1, 2, 3, 4].map((n) => filler("lio", n)),
  sae: [1, 2, 3, 4].map((n) => filler("sae", n)),
};

const modText = (mod: { side: string; add: number; min?: number }): string =>
  `mod:${mod.side}:${mod.add > 0 ? "+" : ""}${mod.add}${mod.min === undefined ? "" : `:min${mod.min}`}`;

/** The events that tell a card's story, as short text lines. Everything else is left out. */
export function story(events: readonly GameEvent[]): string[] {
  return events.flatMap((e) => {
    switch (e.kind) {
      case "marker":
        return [e.label];
      case "pointsSpent":
        return [`points:${e.side}:${e.amount}`];
      case "contingencyDrawn":
        return [`draw:${e.deck}:${e.value}`];
      case "modifierStarted":
        return [modText(e.mod)];
      case "triggerSet":
      case "triggerFired":
        return [`${e.kind}:${e.hook}`];
      default:
        return [];
    }
  });
}

/**
 * Starts the one-turn game that plays first-deck card `id` (the real file): each side holds its four fillers, and
 * `holder` (default: the card's owner; else its rival) also holds the card. Returns the ruleset, the opening
 * state, and the card's owner (LIO for a neutral card).
 */
export function startCardGame(id: CardId, options: PlayOptions = {}, holder: "owner" | "rival" = "owner") {
  const card = FIRST_DECK_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`no first-deck card ${id}`);
  const owner: Side = card.affiliation === "sae" ? "sae" : "lio";
  const holds: Side = holder === "owner" ? owner : owner === "lio" ? "sae" : "lio";
  const def = cardDef(card);
  const ruleset: Ruleset = {
    id: "card-test",
    cards: [
      ...FILLERS.lio,
      ...FILLERS.sae,
      def,
      ...[1, 2].map((n) => ({ ...filler("lio", n), id: `deck-${n}`, affiliation: "neutral" as const })),
    ],
  };
  const top = options.draw;
  const deckOf = top === undefined ? [1, 2, 3, 4, 5, 6] : [top, top, top];
  const hands = {
    lio: [...FILLERS.lio.map((c) => c.id), ...(holds === "lio" ? [id] : [])],
    sae: [...FILLERS.sae.map((c) => c.id), ...(holds === "sae" ? [id] : [])],
  };
  const made = createGame(
    ruleset,
    {
      seedHash: seedHash("card-test"),
      hands,
      deck: ["deck-1", "deck-2"],
      turns: 1,
      playsPerTurn: 2,
      handSize: 3,
      contingency: { lio: deckOf, sae: deckOf, world: deckOf },
    },
    "card-test",
  );
  if (!made.ok) throw new Error(`createGame failed: ${made.error.code}`);
  return { ruleset, state: made.value.state, owner };
}

/** Plays first-deck card `id` (Era 1, 2, 3 or future) (the real file) in a one-turn game and returns the story from the moment the card is played. */
export function playCard(id: CardId, options: PlayOptions = {}): string[] {
  const game = startCardGame(id, options);
  const { ruleset, owner } = game;
  let state = game.state;
  const events: GameEvent[] = [];
  const step = (answer: Answer) => {
    const r = apply(ruleset, state, answer);
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    state = r.value.state;
    events.push(...r.value.events);
  };
  let nextFiller: Record<Side, number> = { lio: 1, sae: 1 };
  let played = false;
  for (let guard = 0; guard < 40 && state.public.status.kind !== "over"; guard++) {
    const d = state.public.pending[0];
    if (!d) throw new Error("the game is waiting for nobody");
    if (d.kind === "chooseCard") {
      const first = `fill-${d.side}-1`;
      step({ decisionId: d.id, side: d.side, value: { kind: "chooseCard", card: first } });
      nextFiller = { ...nextFiller, [d.side]: 2 };
      if (d.side === "sae") events.length = 0; // Both opening picks are in; the story starts here.
    } else if (d.kind === "playCardAs") {
      if (d.side === owner && !played) {
        played = true;
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: id, as: "event" } });
      } else {
        const fill = `fill-${d.side}-${nextFiller[d.side]}`;
        nextFiller = { ...nextFiller, [d.side]: nextFiller[d.side] + 1 };
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: fill, as: "points" } });
      }
    } else if (d.kind === "yesNo") {
      const yes = options.yes?.[d.side];
      if (yes === undefined) throw new Error(`${d.side} was asked a yes/no question the test did not answer`);
      step({ decisionId: d.id, side: d.side, value: { kind: "yesNo", yes } });
    } else {
      throw new Error(`unexpected decision ${d.kind}`);
    }
  }
  return story(events);
}
