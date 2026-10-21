// TEST-ONLY FIXTURES: the fuzz cards flagged removeAfterEvent (R8a; #205), how a random setup keeps enough cards
// that stay in the game, and how the tests sort each flagged card that left play by the way it was used.
import type { Answer, CardId, GameState, Ruleset, Side } from "@terminal-dusk/engine";
import { FUZZ_CARDS, ruleset } from "./cards.ts";

/** The cards of `rules` flagged removeAfterEvent. */
export const flaggedIn = (rules: Ruleset): Set<CardId> =>
  new Set(rules.cards.filter((card) => card.flags?.removeAfterEvent === true).map((card) => card.id));
/** The fuzz cards flagged removeAfterEvent, which leave the game once their event happens. */
export const LEAVING: ReadonlySet<CardId> = flaggedIn(ruleset);

const staying = (cards: readonly CardId[]): number => cards.filter((card) => !LEAVING.has(card)).length;

/** A random setup's first era, dealt hands and draw pile, with its number of turns and plays per turn. */
export type FirstEra = { lio: CardId[]; sae: CardId[]; deck: CardId[]; turns: number; playsPerTurn: number };

/**
 * Whether both hands always refill to `handSize` (docs/design/core-loop.md, "Refilling hands"). A hand dealt more
 * than the hand size keeps the extra cards: a refill only tops up, and each turn a side uses 1 + playsPerTurn cards
 * of its own hand. So at each turn's start a hand holds at most the larger of the hand size and what it could have
 * left, and both hands, added up, must fit in the cards in the game then: every first-era card on turn 1, and on
 * later turns at least those that stay in the game (removeAfterEvent cards may have left, R8a). Hands dealt no more
 * than the hand size need just createGame's check, twice the hand size in staying cards.
 */
export function refillFits(era: FirstEra, handSize: number): boolean {
  const all = [...era.lio, ...era.sae, ...era.deck];
  if (2 * handSize > staying(all)) return false;
  let [lio, sae] = [era.lio.length, era.sae.length];
  for (let turn = 1; turn <= era.turns; turn++) {
    [lio, sae] = [Math.max(lio, handSize), Math.max(sae, handSize)];
    if (lio + sae > (turn === 1 ? all.length : staying(all))) return false;
    [lio, sae] = [lio - 1 - era.playsPerTurn, sae - 1 - era.playsPerTurn];
  }
  return true;
}

/**
 * The draw pile, topped up with the first unflagged fuzz cards not in `used` (every card of the setup) until the
 * smallest hand size, 1 + playsPerTurn, fits (refillFits). Most setups get their draw pile back unchanged.
 */
export function withStayingCards(era: FirstEra, used: ReadonlySet<CardId>): CardId[] {
  const spare = FUZZ_CARDS.filter((card) => !used.has(card) && !LEAVING.has(card));
  const deck = [...era.deck];
  while (!refillFits({ ...era, deck }, 1 + era.playsPerTurn) && spare.length > 0) deck.push(spare.shift()!);
  return deck;
}

/** The largest hand size up to `wanted`, and at least 1 + playsPerTurn, with which both hands always refill. */
export function handSizeFor(wanted: number, era: FirstEra): number {
  let size = wanted;
  while (size > 1 + era.playsPerTurn && !refillFits(era, size)) size -= 1;
  return size;
}

/** How a card was last used: picked to open a turn, or played for its event or its points, by `side`. */
export type Use = { how: "opening" | "event" | "points"; side: Side };

/** Notes the card `answer` picks or plays, and how, in `uses`. */
export function noteUse(uses: Map<CardId, Use>, answer: Answer): void {
  if (!("value" in answer)) return;
  const { value, side } = answer;
  if (value.kind === "chooseCard") uses.set(value.card, { how: "opening", side });
  if (value.kind === "playCardAs") uses.set(value.card, { how: value.as, side });
}

/** Whether `card` is in a hand, an unrevealed opening pick or `inPlay` in `state`. */
function stillHeld(state: GameState, card: CardId): boolean {
  const sides = [state.private.lio, state.private.sae];
  const picked = sides.some((p) => p.picks.some((pick) => "card" in pick.value && pick.value.card === card));
  return picked || sides.some((p) => p.hand.includes(card)) || state.public.inPlay.includes(card);
}

/** A flagged card that left play in a step: where it went, and how it had been used. */
export type Left = { card: CardId; to: "removed" | "discard"; use: Use };

/**
 * The flagged cards (`flagged`) that left play in the step from `prior` to `state` by `answer`: each card in play,
 * picked or played then that is no longer held, gone to `removed` if it is new there, else to the discard pile.
 */
export function flaggedLeft(
  flagged: ReadonlySet<CardId>,
  uses: ReadonlyMap<CardId, Use>,
  prior: GameState,
  answer: Answer,
  state: GameState,
): Left[] {
  const picks = [prior.private.lio, prior.private.sae].flatMap((p) => p.picks.map((pick) => pick.value));
  const answered = "value" in answer ? [answer.value] : [];
  const played = [...picks, ...answered].flatMap((v) =>
    v.kind === "chooseCard" || v.kind === "playCardAs" ? [v.card] : [],
  );
  const candidates = new Set([...prior.public.inPlay, ...played]);
  const added = state.public.removed.slice(prior.public.removed.length);
  return [...candidates].flatMap((card) => {
    const use = uses.get(card);
    if (!flagged.has(card) || use === undefined || stillHeld(state, card)) return [];
    return [{ card, to: added.includes(card) ? "removed" : "discard", use }];
  });
}
