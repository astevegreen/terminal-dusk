// Guessing the cards a side cannot see, so the AI can rebuild a full state with `reconstruct`.
// Reads only the view and the ruleset; the randomness is passed in.
import { DECKS } from "@terminal-dusk/engine";
import type { CardId, HiddenPart, PlayerView, Ruleset, SecretState, Side } from "@terminal-dusk/engine";

/** Any fixed generator state: the AI never draws from the real one, and a guess only has to be well formed. */
const PLACEHOLDER_RNG: SecretState["rng"] = [1, 2, 3, 4];

/** Fisher-Yates shuffle of a copy of `items`, drawing from `random` (a number from 0 up to, not including, 1). */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** The cards the viewer can see: its hand, the ones in play or discarded, and its own unrevealed picks. */
function seenCards(view: PlayerView): Set<CardId> {
  const seen = new Set<CardId>([...(view.mine?.hand ?? []), ...view.public.inPlay, ...view.public.discard]);
  for (const pick of view.mine?.picks ?? []) {
    if (pick.value.kind === "chooseCard" || pick.value.kind === "playCardAs") seen.add(pick.value.card);
  }
  return seen;
}

/**
 * A hidden part consistent with `view`: the other side's hand and the draw pile are dealt at random from
 * the cards `side` cannot see, in the sizes the view's counts give. The opponent's picks and the future
 * eras are left empty; each Contingency deck's order (the World deck's too) is a random order of the
 * numbers still in it.
 */
export function guessHidden(ruleset: Ruleset, view: PlayerView, side: Side, random: () => number): HiddenPart {
  const seen = seenCards(view);
  const unseen = shuffle(
    ruleset.cards.map((card) => card.id).filter((id) => !seen.has(id)),
    random,
  );
  const handSize = view.counts.hands[side === "lio" ? "sae" : "lio"];
  const deckSize = view.counts.deck;
  if (unseen.length < handSize + deckSize) {
    throw new Error(`guessHidden: ${unseen.length} unseen cards cannot fill ${handSize + deckSize} hidden places`);
  }
  const [lio, sae, world] = DECKS.map((d) => shuffle(view.public.contingency[d].left, random));
  return {
    viewer: side,
    // The AI cannot see what the rival was shown, so its guessed knowledge is empty.
    opponent: { hand: unseen.slice(0, handSize), picks: [], knowledge: [] },
    secret: {
      rng: PLACEHOLDER_RNG,
      deck: unseen.slice(handSize, handSize + deckSize),
      eras: [],
      contingency: { lio: lio!, sae: sae!, world: world! },
    },
  };
}
