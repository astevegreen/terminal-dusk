// Hard's guess of the rival's secret opening pick (issue #694). The arena, like any host that takes LIO's answer
// first, has LIO pick before SAE, so Hard as SAE always searches with LIO's pick already made and hidden. withRivalPick
// fills it with a card at random from LIO's guessed hand, while Hard as LIO meets SAE's pick in its rollouts made by
// a noise-free Medium. This guesses the hidden pick the same way: as Medium, from the rival's view, would make it.
import { reconstruct, viewFor } from "@terminal-dusk/engine";
import type { HiddenPart, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";
import { otherSide } from "./evaluate.ts";
import { withRivalPick } from "./guess.ts";
import { mediumAnswer } from "./medium.ts";
import type { MediumWeights } from "./types.ts";

const SIDE_ORDER: readonly Side[] = ["lio", "sae"];

/**
 * `hidden` with the rival's secret opening pick guessed as a noise-free Medium would make it: the guessed state with
 * the rival's decision still waiting (rebuilt as the engine makes a group: the same kind and options, `d<seq>-<side>`,
 * in side order), answered by Medium from the rival's view. When the rival has not picked, or Medium gives no card,
 * it is withRivalPick's guess (`hidden` unchanged while the rival still has to pick).
 */
export function withMediumRivalPick(
  ruleset: Ruleset,
  hidden: HiddenPart,
  view: PlayerView,
  side: Side,
  weights: MediumWeights,
  random: () => number,
): HiddenPart {
  const guessed = withRivalPick(hidden, view, side, random);
  const pick = guessed.opponent.picks[0];
  const mine = view.public.pending.find((d) => d.side === side);
  if (guessed === hidden || pick === undefined || mine === undefined) return guessed;
  const rival = otherSide(side);
  const before = reconstruct(view, { ...hidden, opponent: { ...hidden.opponent, picks: [] } });
  const waiting = [mine, { ...mine, id: pick.decisionId, side: rival }].sort(
    (a, b) => SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side),
  );
  const unpicked = { ...before, public: { ...before.public, pending: waiting } };
  const answer = mediumAnswer(ruleset, viewFor(unpicked, rival), rival, { ...weights, noise: 0 }, random);
  if (answer?.kind !== "chooseCard") return guessed;
  return { ...guessed, opponent: { ...guessed.opponent, picks: [{ ...pick, value: answer }] } };
}
