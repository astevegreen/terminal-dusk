// Test helper: plays one real card through the real engine and tells what happened, in a short story.
// The game has one turn with two plays each. The card's owner (for a neutral card LIO, or playedBy) plays it for its
// event as the first of its plays; every other play is a plain filler card of ops 2 played for points, so the story
// also shows what the card leaves behind: modifiers, then triggers that fire after later plays and at the end of the turn.
// A test can also play other real cards first (`before`), one per earlier turn of the same game, so the card under
// test can read a lasting tag they recorded; their turns are left out of the story.
import { apply, createGame, seedHash } from "@terminal-dusk/engine";
import type { Answer, CardDef, CardId, GameEvent, Ruleset, Side } from "@terminal-dusk/engine";
import { cardDef } from "../era1.ts";
import { FIRST_DECK_CARDS } from "../firstDeckRules.ts";

/** Yes/no answers by side. A side asked a question with no answer here fails the test. */
export type YesAnswers = Partial<Record<Side, boolean>>;

/** A real card played for its event in an earlier turn, with the answers to its own questions. */
export type EarlierCard = { card: CardId; yes?: YesAnswers };

export type PlayOptions = {
  /** What each side answers when its yes/no question comes up. A missing answer fails the test. */
  yes?: YesAnswers;
  /** The number on top of every Contingency deck, so the draw is known. Default: decks 1 to 6. */
  draw?: number;
  /**
   * The numbers drawn from every Contingency deck, in order: `[5, 2]` makes each deck's first draw 5 and its
   * second 2. Any later draw comes from the numbers 1 to 6. Not together with `draw`.
   */
  draws?: readonly number[];
  /** The side that plays a neutral card under test. Default: LIO. Only for neutral cards. */
  playedBy?: Side;
  /**
   * Real cards played for their events before the card under test, in this order, one per earlier turn of the same
   * game: each by its owner (LIO for a neutral card), as that side's first play of its turn. A card id alone answers
   * no questions. The story leaves these turns out. Default: none, so the game has one turn.
   */
  before?: readonly (CardId | EarlierCard)[];
};

const filler = (affiliation: Side, n: number): CardDef => ({
  id: `fill-${affiliation}-${n}`,
  era: "era-1",
  ops: 2,
  affiliation,
  effect: [],
});
/** Each turn uses three cards of each hand (an opening pick and two plays); four are left for the last turn. */
const fillers = (side: Side, earlierTurns: number): CardDef[] =>
  Array.from({ length: 4 + 3 * earlierTurns }, (_, i) => filler(side, i + 1));

const modText = (mod: { side: string; add: number; min?: number }): string =>
  `mod:${mod.side}:${mod.add > 0 ? "+" : ""}${mod.add}${mod.min === undefined ? "" : `:min${mod.min}`}`;

/** The events that tell a card's story, as short text lines. Everything else is left out. */
export function story(events: readonly GameEvent[]): string[] {
  return events.flatMap((e) => {
    switch (e.kind) {
      case "marker":
        return [e.lasting ? `lasting:${e.label}` : e.label];
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

const firstDeckCard = (id: CardId) => {
  const card = FIRST_DECK_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`no first-deck card ${id}`);
  return card;
};
/** The side that plays a card for its event: its own side, or LIO for a neutral card. */
const ownerOf = (id: CardId): Side => (firstDeckCard(id).affiliation === "sae" ? "sae" : "lio");
const earlier = (options: PlayOptions): EarlierCard[] =>
  (options.before ?? []).map((e) => (typeof e === "string" ? { card: e } : e));

/** Each deck's cards in the setup, and (for `draws`) the order they are stacked in once the game is made. */
function decksFor(options: PlayOptions): { cards: number[]; order?: number[] } {
  const { draw, draws } = options;
  if (draw !== undefined && draws !== undefined) throw new Error("give draw or draws, not both");
  if (draws !== undefined) {
    const order = [...draws, 1, 2, 3, 4, 5, 6];
    return { cards: order, order };
  }
  return { cards: draw === undefined ? [1, 2, 3, 4, 5, 6] : [draw, draw, draw] };
}

/**
 * Starts the game that plays first-deck card `id` (the real file): each side holds its fillers, and `holder`
 * (default: the card's owner; else its rival) also holds the card; each `before` card is in its owner's hand.
 * The ruleset holds every first-deck card, so a card that reads a tag is always accepted. Returns the ruleset,
 * the opening state, and the side that plays the card (LIO for a neutral card, unless `playedBy` says SAE).
 */
export function startCardGame(id: CardId, options: PlayOptions = {}, holder: "owner" | "rival" = "owner") {
  return startCardGameDef(cardDef(firstDeckCard(id)), options, holder);
}

/** Starts the game of startCardGame for card `def`, which need not be a real card file. */
function startCardGameDef(def: CardDef, options: PlayOptions, holder: "owner" | "rival") {
  const id = def.id;
  if (options.playedBy !== undefined && def.affiliation !== "neutral") {
    throw new Error(`playedBy is only for neutral cards; ${id} is ${def.affiliation}'s`);
  }
  const owner: Side = def.affiliation === "neutral" ? (options.playedBy ?? "lio") : def.affiliation;
  const holds: Side = holder === "owner" ? owner : owner === "lio" ? "sae" : "lio";
  const first = earlier(options);
  if (first.some((e) => e.card === id)) throw new Error(`${id} cannot be played before itself`);
  const fill = { lio: fillers("lio", first.length), sae: fillers("sae", first.length) };
  const isRealCard = FIRST_DECK_CARDS.some((c) => c.id === id);
  const ruleset: Ruleset = {
    id: "card-test",
    cards: [
      ...fill.lio,
      ...fill.sae,
      ...FIRST_DECK_CARDS.map(cardDef),
      ...(isRealCard ? [] : [def]),
      ...[1, 2].map((n) => ({ ...filler("lio", n), id: `deck-${n}`, affiliation: "neutral" as const })),
    ],
  };
  const decks = decksFor(options);
  const deckOf = decks.cards;
  const handOf = (side: Side): CardId[] => [
    ...fill[side].map((c) => c.id),
    ...first.filter((e) => ownerOf(e.card) === side).map((e) => e.card),
    ...(holds === side ? [id] : []),
  ];
  const made = createGame(
    ruleset,
    {
      seedHash: seedHash("card-test"),
      hands: { lio: handOf("lio"), sae: handOf("sae") },
      deck: ["deck-1", "deck-2"],
      turns: first.length + 1,
      playsPerTurn: 2,
      handSize: 3,
      contingency: { lio: deckOf, sae: deckOf, world: deckOf },
    },
    "card-test",
  );
  if (!made.ok) throw new Error(`createGame failed: ${made.error.code}`);
  let state = made.value.state;
  const order = decks.order;
  if (order !== undefined) {
    // createGame shuffles each deck; stack it in the order asked instead. Same cards, so the public view still fits.
    const contingency = { lio: [...order], sae: [...order], world: [...order] };
    state = { ...state, secret: { ...state.secret, contingency } };
  }
  return { ruleset, state, owner };
}

/**
 * Plays first-deck card `id` (Era 1, 2, 3 or future) (the real file) in the card-test game, after any `before`
 * cards, and returns the story from the moment the last turn's opening picks are in.
 */
export function playCard(id: CardId, options: PlayOptions = {}): string[] {
  return playCardDef(cardDef(firstDeckCard(id)), options);
}

/** Plays card `def` as playCard does. Exported for the helper's own tests, which need made-up cards. */
export function playCardDef(def: CardDef, options: PlayOptions = {}): string[] {
  const id = def.id;
  const game = startCardGameDef(def, options, "owner");
  const { ruleset, owner } = game;
  const first = earlier(options);
  let state = game.state;
  const events: GameEvent[] = [];
  const step = (answer: Answer) => {
    const r = apply(ruleset, state, answer);
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    state = r.value.state;
    events.push(...r.value.events);
  };
  /** This turn's event card and the side that plays it: an earlier card in the earlier turns, `def` in the last. */
  const last: EarlierCard = options.yes === undefined ? { card: id } : { card: id, yes: options.yes };
  const turnCard = (): EarlierCard & { by: Side } => {
    const e = first[state.public.turn - 1];
    return e === undefined ? { ...last, by: owner } : { ...e, by: ownerOf(e.card) };
  };
  const nextFiller: Record<Side, number> = { lio: 1, sae: 1 };
  const takeFiller = (side: Side): CardId => `fill-${side}-${nextFiller[side]++}`;
  let played = false;
  for (let guard = 0; guard < 40 * (first.length + 1) && state.public.status.kind !== "over"; guard++) {
    const d = state.public.pending[0];
    if (!d) throw new Error("the game is waiting for nobody");
    const now = turnCard();
    if (d.kind === "chooseCard") {
      played = false;
      step({ decisionId: d.id, side: d.side, value: { kind: "chooseCard", card: takeFiller(d.side) } });
      if (d.side === "sae") events.length = 0; // Both opening picks are in; this turn's story starts here.
    } else if (d.kind === "playCardAs") {
      if (d.side === now.by && !played) {
        played = true;
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: now.card, as: "event" } });
      } else {
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: takeFiller(d.side), as: "points" } });
      }
    } else if (d.kind === "yesNo") {
      const yes = now.yes?.[d.side];
      if (yes === undefined) throw new Error(`${d.side} was asked a yes/no question the test did not answer`);
      step({ decisionId: d.id, side: d.side, value: { kind: "yesNo", yes } });
    } else {
      throw new Error(`unexpected decision ${d.kind}`);
    }
  }
  return story(events);
}
