// The stand-in of the "defaultAnswer" deadline rule (#605; Decision (architect) Q8 there): the host answers a
// covered side's decisions with the default answer, one after another, and saves them as one step.
import { apply, pendingFor } from "@terminal-dusk/engine";
import type { Answer, GameEvent, Ruleset, Side } from "@terminal-dusk/engine";
import { defaultAnswer } from "./defaultAnswer.ts";
import { copyJson } from "./frames.ts";
import { commitSteps } from "./hostAccept.ts";
import type { Frame, HostOutcome, MatchClock, MatchRecord, MatchSecret } from "./types.ts";

/** The most answers one stand-in call makes; reaching it is a host error, never an endless loop. */
export const STAND_IN_LIMIT = 64;

/**
 * Covers `side` for the turn now being played and answers its waiting decisions with the default answer until it
 * has none waiting, the turn number rises or the game ends. Every frame is marked with the covered side.
 * `clock` is the record's valid clock. Never changes its inputs.
 */
export function standIn(
  ruleset: Ruleset,
  record: MatchRecord,
  secret: MatchSecret,
  clock: MatchClock,
  side: Side,
  now: number,
): HostOutcome {
  const turn = secret.state.public.turn;
  const covering = { lio: clock.covering?.lio ?? null, sae: clock.covering?.sae ?? null };
  covering[side] = turn;
  let state = secret.state;
  const events: GameEvent[] = [];
  const log: Answer[] = copyJson(secret.log);
  const going = (): boolean =>
    state.public.status.kind === "active" && state.public.turn === turn && pendingFor(state, side) !== null;
  let made = 0;
  while (going()) {
    made += 1;
    if (made > STAND_IN_LIMIT) return refuse(`The stand-in made ${STAND_IN_LIMIT} answers without finishing.`);
    const decision = pendingFor(state, side);
    const value = defaultAnswer(ruleset, state, side);
    if (decision === null || value === null) return refuse("The stand-in found no legal answer.");
    const answer: Answer = { decisionId: decision.id, side, value };
    const result = apply(ruleset, state, answer);
    if (!result.ok) return { ok: false, error: result.error };
    state = result.value.state;
    events.push(...result.value.events);
    log.push(answer);
  }
  const covered: MatchRecord = { ...record, clock: { ...copyJson(clock), covering } };
  const outcome = commitSteps(ruleset, covered, secret, { state, events, log }, now);
  if (!outcome.ok) return outcome;
  const marked = (frame: Frame): Frame => ({ ...frame, standIn: side });
  const { frames } = outcome.value;
  return {
    ok: true,
    value: {
      ...outcome.value,
      frames: { lio: marked(frames.lio), sae: marked(frames.sae), spectator: marked(frames.spectator) },
    },
  };
}

const refuse = (message: string): HostOutcome => ({ ok: false, error: { code: "standInLimit", message } });
