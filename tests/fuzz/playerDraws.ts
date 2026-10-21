// Whose deck a neutral card's draws come from (docs/design/contingency-deck.md, "Whose deck"): a neutral
// event's "player" draw, and one in a reaction it set, uses the deck of the side that played or picked the
// card. The fuzz cards (play.ts, reactions.ts) announce every such draw with a marker naming the card, so the
// check can tell which card a draw belongs to; the answers so far tell who last picked or played that card.
import type { Answer, CardId, GameEvent, Side, Step } from "@terminal-dusk/engine";

/**
 * The label of the marker that comes straight before every fuzz "player" draw, followed by the card's id,
 * then REACTION_DRAW for a draw in a reaction the card's trigger runs.
 */
export const PLAYER_DRAW = "playerDraw:";
export const REACTION_DRAW = ":reaction";

/**
 * Card `card`'s draw from the player's deck, announced by its marker, binding the number to `bind` if given.
 * `inReaction` marks a draw in the reaction of a trigger the card sets.
 */
export function playerDraw(card: CardId, bind?: string, inReaction = false): Step[] {
  return [
    { op: "marker", label: `${PLAYER_DRAW}${card}${inReaction ? REACTION_DRAW : ""}` },
    bind === undefined ? { op: "drawContingency", side: "player" } : { op: "drawContingency", side: "player", bind },
  ];
}

/** The card an announced "player" draw's marker names, and whether the draw is in a reaction; null for any other event. */
export function announcedDraw(event: GameEvent): { card: CardId; inReaction: boolean } | null {
  if (event.kind !== "marker" || !event.label.startsWith(PLAYER_DRAW)) return null;
  const rest = event.label.slice(PLAYER_DRAW.length);
  const inReaction = rest.endsWith(REACTION_DRAW);
  return { card: inReaction ? rest.slice(0, -REACTION_DRAW.length) : rest, inReaction };
}

/**
 * Notes who picked or played a card in `answer`, in `players`. A card is picked or played at most once a
 * turn, and its triggers end with the turn, so the last side noted is the one its draws belong to.
 */
export function notePlayer(players: Map<CardId, Side>, answer: Answer): void {
  if (!("value" in answer)) return;
  const { value } = answer;
  if (value.kind === "chooseCard" || value.kind === "playCardAs") players.set(value.card, answer.side);
}

/**
 * Every announced "player" draw in `events` (one step's) is a contingencyDrawn, and the reshuffle right after
 * it, if any, naming the side that last picked or played the card the marker names.
 */
export function checkPlayerDraws(events: readonly GameEvent[], players: ReadonlyMap<CardId, Side>): void {
  events.forEach((event, i) => {
    const announced = announcedDraw(event);
    if (announced === null) return;
    const { card } = announced;
    const drawn = events[i + 1];
    if (drawn?.kind !== "contingencyDrawn") throw new Error(`card ${card}'s draw from the player's deck drew nothing`);
    const after = events[i + 2];
    const sides = after?.kind === "contingencyDeckReshuffled" ? [drawn.side, after.side] : [drawn.side];
    const player = players.get(card);
    if (sides.some((side) => side !== player)) {
      throw new Error(
        `card ${card}'s draw from the player's deck used ${[...new Set(sides)].join(" and ")}'s deck, ` +
          `but ${player ?? "no side"} picked or played it`,
      );
    }
  });
}
