// The host and Quantum Computing's one-sided opening pick (A18, issue #510; docs/design/tech-race.md, "The
// opening-card power"): the holder's rival picks first and alone, so only it is due; its card is then face up in the
// holder's frame, and only the holder is due. A missed deadline on either pick loses on time as usual.
import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { AnswerValue, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { firstDeckRuleset, sixRegionMapConfig } from "./firstDeck.ts";
import { hostCreate } from "./hostCreate.ts";
import { hostDeadline } from "./hostDeadline.ts";
import { hostSubmit } from "./hostSubmit.ts";
import { DAY } from "./test/clock.ts";
import { NOW, SEED } from "./test/match.ts";
import type { HostResult } from "./types.ts";

const rules = firstDeckRuleset;

/**
 * `side`'s answer: SAE races, making a tech race attempt whenever it can and playing its highest-points card for its
 * points; otherwise the first legal answer.
 */
function choice(host: HostResult, side: Side): AnswerValue {
  const answers = legalAnswers(rules, host.secret.state, side);
  if (side === "sae") {
    const race = answers.find((a) => a.kind === "chooseAction" && a.action === "techRace");
    if (race) return race;
    const ops = (a: AnswerValue) =>
      a.kind === "playCardAs" && a.as === "points" ? (rules.cards.find((c) => c.id === a.card)?.ops ?? 0) : -1;
    const best = answers.reduce((x, y) => (ops(y) > ops(x) ? y : x), answers[0]!);
    if (ops(best) >= 0) return best;
  }
  return answers[0]!;
}

/** `side`'s answer (choice), submitted at `now`. */
function answer(host: HostResult, side: Side, now: number): HostResult {
  const decision = pendingFor(host.secret.state, side)!;
  const value = choice(host, side);
  const submission = {
    player: host.record.players[side],
    expectedSeq: host.record.seq,
    decisionId: decision.id,
    value,
  };
  const r = hostSubmit(rules, host.record, host.secret, submission, now);
  if (!r.ok) throw new Error(`hostSubmit failed: ${r.error.code}`);
  return r.value;
}

/**
 * A six-region match of 8 turns on a one-day lossOnTime clock, with every tech race step costing 1 and SAE's
 * Contingency deck all 6s so its attempts always succeed (test data, not the map's), played through the host (choice) until SAE holds Quantum
 * Computing and a turn's one-sided opening pick waits. `now` is the time of the last answer.
 */
function atQuantumOpening(): { host: HostResult; now: number } {
  const config = sixRegionMapConfig();
  const map = config.setup.map!;
  const steps = map.techRace!.steps.map((step) => ({ ...step, cost: 1 }));
  const contingency = { ...config.setup.contingency!, sae: Array.from({ length: 20 }, () => 6) };
  const setup = { ...config.setup, turns: 8, map: { ...map, techRace: { ...map.techRace!, steps } }, contingency };
  const made = hostCreate(rules, { ...config, setup, deadline: { rule: "lossOnTime", days: 1 } }, SEED, NOW);
  if (!made.ok) throw new Error(`hostCreate failed: ${made.error.code}`);
  let host = made.value;
  let now = NOW;
  while (host.record.status.kind === "active") {
    const pending = host.secret.state.public.pending;
    const quantum = host.secret.state.public.techRace!.marker === 4;
    if (quantum && pending.length === 1 && pending[0]!.kind === "chooseCard") return { host, now };
    const side = SIDES.find((s) => pendingFor(host.secret.state, s) !== null)!;
    host = answer(host, side, ++now);
  }
  throw new Error("the game ended before SAE held Quantum Computing");
}

describe("the host and Quantum Computing's one-sided opening pick", () => {
  it("waits on the rival alone first: only LIO's decision, only LIO's deadline", () => {
    const { host, now } = atQuantumOpening();
    expect(host.secret.state.public.techRace!.marker).toBe(4);
    expect(host.frames.lio.decision?.kind).toBe("chooseCard");
    expect(host.frames.sae.decision).toBeNull();
    expect(host.record.clock?.deadlines).toEqual({ lio: now + DAY, sae: null });
  });

  it("then shows the rival's card face up in the holder's frame and waits on the holder alone", () => {
    const { host, now } = atQuantumOpening();
    const picked = choice(host, "lio");
    const next = answer(host, "lio", now + 1);
    expect(picked.kind === "chooseCard" && next.frames.sae.view.public.inPlay).toEqual(
      picked.kind === "chooseCard" ? [picked.card] : false,
    );
    expect(next.frames.sae.decision?.kind).toBe("chooseCard");
    expect(next.frames.lio.decision).toBeNull();
    expect(next.record.clock?.deadlines).toEqual({ lio: null, sae: now + 1 + DAY });
  });

  it("a missed deadline on either pick loses on time for that side", () => {
    const { host, now } = atQuantumOpening();
    const lioLate = hostDeadline(rules, host.record, host.secret, now + DAY);
    expect(lioLate.ok && lioLate.value.record.status).toMatchObject({ kind: "over", winner: "sae" });
    const next = answer(host, "lio", now + 1);
    const saeLate = hostDeadline(rules, next.record, next.secret, now + 1 + DAY);
    expect(saeLate.ok && saeLate.value.record.status).toMatchObject({ kind: "over", winner: "lio" });
  });
});
