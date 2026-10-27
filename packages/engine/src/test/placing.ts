// Test helper: finishing the spending a play for points asks for in a game with a map (R16a placing.ts, R16b
// action choice, R16c realign), never realigning: on the action menu it takes the first legal answer that is not
// "realign" (placing when offered, then an intervention, then passing).
import { legalAnswers } from "../decisions.ts";
import type { AnswerValue, GameEvent, GameState, Ruleset, Side } from "../types.ts";
import { applied, ruleset } from "./game.ts";

type Played = { state: GameState; events: GameEvent[] };

const isRealign = (a: AnswerValue): boolean => a.kind === "chooseAction" && a.action === "realign";

/** The first legal answer for `side` that does not start realigning. */
const notRealigning = (rs: Ruleset, state: GameState, side: Side): AnswerValue =>
  legalAnswers(rs, state, side).find((a) => !isRealign(a))!;

/**
 * Answers every open chooseAction and placeInfluence decision with its first legal answer that does not realign
 * (placing, when a placement is affordable) until none is open, and returns the state then with `played`'s events
 * followed by every event those answers caused.
 */
export function placeAll(played: Played, rs: Ruleset = ruleset): Played {
  let { state } = played;
  const events = [...played.events];
  const spending = (kind: string | undefined) => kind === "placeInfluence" || kind === "chooseAction";
  for (let d = state.public.pending[0]; spending(d?.kind); d = state.public.pending[0]) {
    const next = applied(state, { decisionId: d!.id, side: d!.side, value: notRealigning(rs, state, d!.side) }, rs);
    state = next.state;
    events.push(...next.events);
  }
  return { state, events };
}
