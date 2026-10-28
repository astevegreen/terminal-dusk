// Test helper: plays one real card through the real engine and tells what happened, in a short story.
// The game has one turn with two plays each. The card's owner (for a neutral card LIO, or playedBy) plays it for its
// event as the first of its plays (or, with `rival`, the rival plays it for points or picks it as its opening card);
// every other play is a plain filler card of ops 2 played for points, so the story
// also shows what the card leaves behind: modifiers, then triggers that fire after later plays and at the end of the turn.
// A test can also play other real cards first (`before`), one per earlier turn of the same game, so the card under
// test can read a lasting tag they recorded; their turns are left out of the story.
import { apply, createGame, legalAnswers, seedHash } from "@terminal-dusk/engine";
import type { Answer, AnswerValue, CardDef, CardId, GameEvent, Ruleset, Side } from "@terminal-dusk/engine";
import { cardDef } from "../era1.ts";
import { FIRST_DECK_CARDS } from "../firstDeckRules.ts";
import { scenarioSetup } from "../scenario.ts";
import { TEST_MAP_SCENARIO } from "../testMapScenario.ts";

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
   * How the rival of the card's side (SAE for a neutral card, or LIO when `playedBy` says SAE) uses the card, instead of its own side playing it
   * for its event: "points" plays it for its points (the rival answers that the event goes first), "opening"
   * picks it as the rival's opening card. Either way the card's event happens, and the story starts with it.
   * Default: none, the card's own side plays it for its event.
   */
  rival?: "points" | "opening";
  /**
   * Real cards played for their events before the card under test, in this order, one per earlier turn of the same
   * game: each by its owner (LIO for a neutral card), as that side's first play of its turn. A card id alone answers
   * no questions. The story leaves these turns out. Default: none, so the game has one turn.
   */
  before?: readonly (CardId | EarlierCard)[];
  /**
   * Plays the card in a game with the test map (testMapScenario.ts), so Escalation is on: it starts at 2 and the
   * story shows its moves, the fall at each turn's end too. Default: off, a game with no map and no Escalation.
   */
  map?: true;
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
      case "handRevealed":
        return [`reveal:${e.side}`]; // The side whose hand was shown, never the cards in it.
      case "cardsDiscarded":
        return [`discard:${e.side}:${e.cards.length}`];
      case "escalationChanged":
        return [`escalation:${e.from}:${e.to}`];
      case "escalationCrisis":
        return [`crisis:${e.side}:${e.value}`];
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
const rivalOf = (side: Side): Side => (side === "lio" ? "sae" : "lio");
const isRealign = (a: AnswerValue): boolean => a.kind === "chooseAction" && a.action === "realign";
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
  const holds: Side = holder === "owner" ? owner : rivalOf(owner);
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
      ...(options.map === true ? { firstEra: "era-1", map: scenarioSetup(TEST_MAP_SCENARIO).map! } : {}),
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
  const { rival } = options;
  const game = startCardGameDef(def, options, rival === undefined ? "owner" : "rival");
  const { ruleset, owner } = game;
  const player: Side = rival === undefined ? owner : rivalOf(owner);
  const first = earlier(options);
  const lastTurn = first.length + 1;
  let state = game.state;
  const events: GameEvent[] = [];
  const step = (answer: Answer) => {
    const r = apply(ruleset, state, answer);
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    state = r.value.state;
    events.push(...r.value.events);
  };
  /** This turn's event card and the side that uses it: an earlier card in the earlier turns, `def` in the last. */
  const last: EarlierCard = options.yes === undefined ? { card: id } : { card: id, yes: options.yes };
  const turnCard = (): EarlierCard & { by: Side } => {
    const e = first[state.public.turn - 1];
    return e === undefined ? { ...last, by: player } : { ...e, by: ownerOf(e.card) };
  };
  // A side's next filler is the first one still in its hand (a discard may have taken some away).
  const takeFiller = (side: Side): CardId => {
    const fill = state.private[side].hand.find((card) => card.startsWith("fill-"));
    if (fill === undefined) throw new Error(`${side} has no filler card left`);
    return fill;
  };
  let playedIn = 0; // The latest turn whose event card has been played (or picked as an opening card).
  for (let guard = 0; guard < 40 * lastTurn && state.public.status.kind !== "over"; guard++) {
    const d = state.public.pending[0];
    if (!d) throw new Error("the game is waiting for nobody");
    const now = turnCard();
    const turn = state.public.turn;
    if (d.kind === "chooseCard") {
      const opening = rival === "opening" && turn === lastTurn;
      const pickIt = opening && d.side === now.by;
      // A rival's opening card runs its event once both picks are in, so the story starts with the last pick.
      if (opening && state.public.pending.length === 1) events.length = 0;
      if (pickIt) playedIn = turn;
      step({ decisionId: d.id, side: d.side, value: { kind: "chooseCard", card: pickIt ? id : takeFiller(d.side) } });
      if (!opening && d.side === "sae") events.length = 0; // Both opening picks are in; this turn's story starts here.
    } else if (d.kind === "playCardAs") {
      if (d.side === now.by && playedIn !== turn) {
        playedIn = turn;
        const forPoints = rival === "points" && turn === lastTurn;
        if (forPoints) events.length = 0; // The story starts with the rival's play of the card.
        const as = forPoints ? "points" : "event";
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: now.card, as } });
      } else {
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: takeFiller(d.side), as: "points" } });
      }
    } else if (d.kind === "yesNo") {
      const yes = now.yes?.[d.side];
      if (yes === undefined) throw new Error(`${d.side} was asked a yes/no question the test did not answer`);
      step({ decisionId: d.id, side: d.side, value: { kind: "yesNo", yes } });
    } else if (d.kind === "rivalEventOrder") {
      step({ decisionId: d.id, side: d.side, value: { kind: "rivalEventOrder", event: "before" } });
    } else if (d.kind === "chooseAction") {
      // Points go to placing when it is possible (R16b), otherwise to the first intervention, or are left unspent;
      // never to realigning (R16c). The story leaves the choice out.
      const answers = legalAnswers(ruleset, state, d.side);
      step({ decisionId: d.id, side: d.side, value: answers.find((a) => !isRealign(a))! });
    } else if (d.kind === "placeInfluence") {
      // Points are placed in the first country the side may place in (R16a); the story leaves the placings out.
      step({ decisionId: d.id, side: d.side, value: legalAnswers(ruleset, state, d.side)[0]! });
    } else {
      throw new Error(`unexpected decision ${d.kind}`);
    }
  }
  if (playedIn !== lastTurn) throw new Error(`${id} was never played`);
  return story(events);
}
