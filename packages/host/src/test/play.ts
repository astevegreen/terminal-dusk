// Test helpers for playing a match through the host.
import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import { hostCreate } from "../hostCreate.ts";
import { hostSubmit } from "../hostSubmit.ts";
import type { HostResult, Submission } from "../types.ts";
import { makeConfig, NOW, ruleset, SEED } from "./match.ts";

/** A match just started with the test inputs. */
export function started(): HostResult {
  const r = hostCreate(ruleset, makeConfig(), SEED, NOW);
  if (!r.ok) throw new Error(`hostCreate failed: ${r.error.code}`);
  return r.value;
}

/** The submission for `side`'s waiting decision, using the first legal answer. */
export function submissionFor(host: HostResult, side: Side, pick = 0): Submission {
  const decision = pendingFor(host.secret.state, side);
  const value = legalAnswers(ruleset, host.secret.state, side)[pick];
  if (!decision || !value) throw new Error(`${side} has nothing to answer`);
  return { player: host.record.players[side], expectedSeq: host.record.seq, decisionId: decision.id, value };
}

/** The first side with a waiting decision. */
export const nextSide = (host: HostResult): Side => {
  const side = SIDES.find((s) => pendingFor(host.secret.state, s) !== null);
  if (!side) throw new Error("nobody is waiting");
  return side;
};

/** hostSubmit with the test ruleset, expected to succeed. */
export function accept(host: HostResult, submission: Submission, now = NOW): HostResult {
  const r = hostSubmit(ruleset, host.record, host.secret, submission, now);
  if (!r.ok) throw new Error(`hostSubmit failed: ${r.error.code}`);
  return r.value;
}
