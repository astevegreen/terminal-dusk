import { createGame, eventsFor, seedHash, SIDES } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { hostArchive } from "./hostArchive.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { NOW, ruleset, SEED } from "./test/match.ts";
import { accept, nextSide, started, submissionFor } from "./test/play.ts";
import type { HostResult } from "./types.ts";

/** A game played to the end with first-choice answers. */
function playedOut(): HostResult {
  let host = started();
  for (let i = 1; host.record.status.kind === "active"; i++) {
    host = accept(host, submissionFor(host, nextSide(host)), NOW + i);
  }
  return host;
}
const resigned = (): HostResult => accept(started(), { player: "alice", resign: true }, NOW + 1);

function expectRefused(host: HostResult, code: string, message?: string, rs = ruleset): void {
  const r = hostArchive(rs, host.record, host.secret);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.error.code).toBe(code);
  if (message !== undefined) expect(r.error.message).toContain(message);
  expect(r.error.message ?? "").not.toContain(SEED);
}

describe("hostArchive", () => {
  it.each([
    ["play", playedOut],
    ["resignation", resigned],
  ])(
    "a game that ends by %s gives log.length + 1 frames, the first from createGame and the last the game over",
    (_n, make) => {
      const host = make();
      const r = hostArchive(ruleset, host.record, host.secret);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const a = r.value;
      expect(a.frames).toHaveLength(a.log.length + 1);
      expect(a.log).toEqual(host.secret.log);
      expect(a.frames[0]!.seq).toBe(0);
      const created = createGame(ruleset, host.secret.setup, host.secret.seed);
      if (!created.ok) throw new Error("createGame failed");
      expect(a.frames[0]!.events).toEqual(eventsFor(created.value.events, "omniscient"));
      expect(a.frames.map((f) => f.seq)).toEqual(a.frames.map((_f, i) => i));
      expect(a.frames.at(-1)!.view.public.status.kind).toBe("over");
      expect(a.status).toEqual(host.record.status);
      expect(a.matchId).toBe("match-1");
      expect(a.players).toEqual({ lio: "alice", sae: "bob" });
    },
  );

  it("each step's frame shows both sides' hands as the live game had them (the engine has no card-draw step yet)", () => {
    const steps = [started()];
    while (steps.at(-1)!.record.status.kind === "active") {
      const h = steps.at(-1)!;
      steps.push(accept(h, submissionFor(h, nextSide(h)), NOW + steps.length));
    }
    const last = steps.at(-1)!;
    const r = hostArchive(ruleset, last.record, last.secret);
    if (!r.ok) throw new Error("archive failed");
    expect(r.value.frames).toHaveLength(steps.length);
    steps.forEach((step, i) => {
      for (const side of SIDES) expect(r.value.frames[i]!.view.sides[side]).toEqual(step.secret.state.private[side]);
    });
    // The opponent's hand is visible too: the first frame shows both full opening hands.
    expect(r.value.frames[0]!.view.sides.lio.hand).toEqual(last.secret.setup.hands.lio);
    expect(r.value.frames[0]!.view.sides.sae.hand).toEqual(last.secret.setup.hands.sae);
  });

  it("seedHash(archive.seed) equals archive.seedHash", () => {
    const host = resigned();
    const r = hostArchive(ruleset, host.record, host.secret);
    if (!r.ok) throw new Error("archive failed");
    expect(seedHash(r.value.seed)).toBe(r.value.seedHash);
  });

  it("an active match gives gameNotOver", () => {
    expectRefused(started(), "gameNotOver");
  });

  it("a wrong ruleset gives verifyFailed", () => {
    expectRefused(resigned(), "verifyFailed", "ruleset", { ...ruleset, id: "other" });
  });

  it("a tampered seed gives verifyFailed without the seed in the message", () => {
    const host = resigned();
    expectRefused({ ...host, secret: { ...host.secret, seed: "tampered-seed" } }, "verifyFailed", "did not check out");
  });

  it("a log with one answer changed to an illegal value gives verifyFailed", () => {
    const host = playedOut();
    const value = { kind: "chooseCard", card: "no-such-card" } as const;
    const log = host.secret.log.map((a, i) => (i === 2 && "decisionId" in a ? { ...a, value } : a));
    expect(log).not.toEqual(host.secret.log);
    expectRefused({ ...host, secret: { ...host.secret, log } }, "verifyFailed", "was refused");
  });

  it("a log with one answer pointing at the wrong decision gives verifyFailed", () => {
    const host = playedOut();
    const log = host.secret.log.map((a, i) => (i === 2 && "decisionId" in a ? { ...a, decisionId: "nope" } : a));
    expect(log).not.toEqual(host.secret.log);
    expectRefused({ ...host, secret: { ...host.secret, log } }, "verifyFailed", "was refused");
  });

  it("a log with its last answer removed gives verifyFailed", () => {
    const host = playedOut();
    const log = host.secret.log.slice(0, -1);
    expectRefused({ ...host, secret: { ...host.secret, log } }, "verifyFailed", "before the game does");
  });

  it("a resigned game whose secret state has two draw-pile cards swapped gives verifyFailed", () => {
    const host = resigned();
    const [a, b, ...rest] = host.secret.state.secret.deck;
    const state = { ...host.secret.state, secret: { ...host.secret.state.secret, deck: [b!, a!, ...rest] } };
    expectRefused({ ...host, secret: { ...host.secret, state } }, "verifyFailed", "does not match");
  });

  it("the archive is plain JSON", () => {
    const host = playedOut();
    const r = hostArchive(ruleset, host.record, host.secret);
    if (!r.ok) throw new Error("archive failed");
    expect(JSON.parse(JSON.stringify(r.value))).toEqual(r.value);
  });

  it("deep-frozen inputs are accepted and not changed", () => {
    const host = deepFreeze(playedOut());
    const frozenRuleset = deepFreeze({ ...ruleset, cards: [...ruleset.cards] });
    const r = hostArchive(frozenRuleset, host.record, host.secret);
    expect(r.ok).toBe(true);
  });
});
