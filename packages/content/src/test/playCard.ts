// Test helper: plays one real card through the real engine and tells what happened, in a short story.
// The game has one turn with two plays each. The card's owner (LIO for a neutral card) plays it for its event as
// the first of its plays (or, with `rival`, the rival plays it for points or picks it as its opening card); every other play is a plain filler card of ops 2 played for points, so the story also
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
  /**
   * How the rival of the card's side (SAE for a neutral card) uses the card, instead of its own side playing it
   * for its event: "points" plays it for its points (the rival answers that the event goes first), "opening"
   * picks it as the rival's opening card. Either way the card's event happens, and the story starts with it.
   * Default: none, the card's own side plays it for its event.
   */
  rival?: "points" | "opening";
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
      case "handRevealed":
        return [`reveal:${e.side}`]; // The side whose hand was shown, never the cards in it.
      case "cardsDiscarded":
        return [`discard:${e.side}:${e.cards.length}`];
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
  return startGameWith(firstDeckCard(id), options, holder);
}

function firstDeckCard(id: CardId): CardDef {
  const card = FIRST_DECK_CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`no first-deck card ${id}`);
  return cardDef(card);
}

const rivalOf = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/** startCardGame for the card `def`, which need not be a real card. */
function startGameWith(def: CardDef, options: PlayOptions, holder: "owner" | "rival") {
  const id = def.id;
  const owner: Side = def.affiliation === "sae" ? "sae" : "lio";
  const holds: Side = holder === "owner" ? owner : rivalOf(owner);
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
  return playTestCard(firstDeckCard(id), options);
}

/** playCard for the card `def`, which need not be a real card: the helper's own tests use small made-up cards. */
export function playTestCard(def: CardDef, options: PlayOptions = {}): string[] {
  const id = def.id;
  const { rival } = options;
  const game = startGameWith(def, options, rival === undefined ? "owner" : "rival");
  const { ruleset, owner } = game;
  const player: Side = rival === undefined ? owner : rivalOf(owner);
  let state = game.state;
  const events: GameEvent[] = [];
  const step = (answer: Answer) => {
    const r = apply(ruleset, state, answer);
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    state = r.value.state;
    events.push(...r.value.events);
  };
  // A side's next filler is the first one still in its hand (a discard may have taken some away).
  const filler = (side: Side): CardId => {
    const fill = state.private[side].hand.find((card) => card.startsWith("fill-"));
    if (fill === undefined) throw new Error(`${side} has no filler card left`);
    return fill;
  };
  let played = false;
  for (let guard = 0; guard < 40 && state.public.status.kind !== "over"; guard++) {
    const d = state.public.pending[0];
    if (!d) throw new Error("the game is waiting for nobody");
    if (d.kind === "chooseCard") {
      const pickIt = rival === "opening" && d.side === player;
      // A rival's opening card runs its event once both picks are in, so the story starts with the last pick.
      if (rival === "opening" && state.public.pending.length === 1) events.length = 0;
      if (pickIt) played = true;
      step({ decisionId: d.id, side: d.side, value: { kind: "chooseCard", card: pickIt ? id : filler(d.side) } });
      if (rival !== "opening" && d.side === "sae") events.length = 0; // Both opening picks are in; the story starts here.
    } else if (d.kind === "playCardAs") {
      if (d.side === player && !played) {
        played = true;
        if (rival === "points") events.length = 0; // The story starts with the rival's play of the card.
        const as = rival === "points" ? "points" : "event";
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: id, as } });
      } else {
        step({ decisionId: d.id, side: d.side, value: { kind: "playCardAs", card: filler(d.side), as: "points" } });
      }
    } else if (d.kind === "yesNo") {
      const yes = options.yes?.[d.side];
      if (yes === undefined) throw new Error(`${d.side} was asked a yes/no question the test did not answer`);
      step({ decisionId: d.id, side: d.side, value: { kind: "yesNo", yes } });
    } else if (d.kind === "rivalEventOrder") {
      step({ decisionId: d.id, side: d.side, value: { kind: "rivalEventOrder", event: "before" } });
    } else {
      throw new Error(`unexpected decision ${d.kind}`);
    }
  }
  if (!played) throw new Error(`${id} was never played`);
  return story(events);
}
