// What the tutorial runner compares against a frame: a step's trigger, and the answers a step allows (#639).
// It reads the learner's frame only, never GameState (hard rule 2).
import type { Lesson } from "@terminal-dusk/content";
import type { AnswerValue, Decision } from "@terminal-dusk/engine";
import type { Frame } from "../types.ts";

export type Step = Lesson["chapters"][number]["steps"][number];
export type Trigger = Step["when"];
export type Matcher = NonNullable<Step["allow"]>[number];

/** Whether `trigger` is in `frame`: the start, the frame's pending decision, or one of its new events. */
export function triggerMatches(trigger: Trigger, frame: Frame): boolean {
  if ("start" in trigger) return true;
  if (trigger.turn !== undefined && trigger.turn !== frame.view.public.turn) return false;
  if ("decision" in trigger) {
    const d = frame.decision;
    return d !== null && d.kind === trigger.decision && (trigger.side === undefined || d.side === trigger.side);
  }
  return frame.events.some(
    (e) => e.kind === trigger.event && (trigger.side === undefined || ("side" in e && e.side === trigger.side)),
  );
}

/** Whether `answer` has every field `m` names, with the same value. */
function answerFits(m: Matcher, answer: AnswerValue): boolean {
  const a = answer as Record<string, unknown>;
  return (["card", "as", "action", "country"] as const).every((key) => m[key] === undefined || a[key] === m[key]);
}

/** The countries a decision offers, for a matcher that names one. */
function offeredCountries(m: Matcher, decision: Decision): readonly string[] {
  const o = decision.options as { countries?: string[]; targets?: string[] };
  if (m.kind === "placeInfluence") return o.countries ?? [];
  return o.targets ?? [];
}

/** Whether `decision`, with the learner's `hand`, offers an answer `m` would accept. */
function offered(m: Matcher, decision: Decision, hand: readonly string[]): boolean {
  if (m.card !== undefined && !hand.includes(m.card)) return false;
  const o = decision.options as { uses?: Record<string, string[]>; actions?: string[] };
  if (m.as !== undefined && !Object.values(o.uses ?? {}).some((uses) => uses.includes(m.as!))) return false;
  if (m.action !== undefined && !(o.actions ?? []).includes(m.action)) return false;
  return m.country === undefined || offeredCountries(m, decision).includes(m.country);
}

/**
 * Whether a coach step's `allow` lets the learner send `answer` to `decision`. A matcher limits only answers of its
 * own kind. A discardCards decision is never limited, and when the decision offers nothing the matchers of that
 * kind accept, any answer is allowed, so the learner is never stuck (Decision (architect), #639).
 */
export function allowed(
  allow: readonly Matcher[],
  answer: AnswerValue,
  decision: Decision | null,
  frame: Frame,
): boolean {
  if (decision === null || decision.kind === "discardCards") return true;
  const ofKind = allow.filter((m) => m.kind === answer.kind);
  if (ofKind.length === 0) return true;
  const hand = frame.view.mine?.hand ?? [];
  if (!ofKind.some((m) => offered(m, decision, hand))) return true;
  return ofKind.some((m) => answerFits(m, answer));
}
