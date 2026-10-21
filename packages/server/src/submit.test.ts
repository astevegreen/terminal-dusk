import { hostSubmit } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { submit } from "./submit.ts";
import { bodyFor, MATCH, NOW, ruleset, setup } from "./test/match.ts";

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
};

describe("submit: a legal answer", () => {
  it("saves the new record, secret and frames, and returns the host's seq and effects", async () => {
    const { store, deps, start } = setup();
    const body = bodyFor(0, start.secret, "lio");
    const expected = hostSubmit(ruleset, start.record, start.secret, { player: "alice", ...body } as never, NOW + 5);
    if (!expected.ok) throw new Error("the host refused the test answer");

    const result = await submit(deps, { matchId: MATCH, player: "alice", body, now: NOW + 5 });

    expect(result).toEqual({ ok: true, value: { seq: expected.value.record.seq, effects: expected.value.effects } });
    expect(await store.load(MATCH)).toEqual({ record: expected.value.record, secret: expected.value.secret });
    expect(store.stored(MATCH)?.frames).toEqual(expected.value.frames);
  });

  it("uses the caller's id and ignores any player inside the body", async () => {
    const { store, deps, start } = setup();
    const body = { ...bodyFor(0, start.secret, "lio"), player: "bob" };
    const result = await submit(deps, { matchId: MATCH, player: "alice", body, now: NOW });
    expect(result.ok).toBe(true);
    expect(store.stored(MATCH)?.secret.log).toEqual([expect.objectContaining({ side: "lio" })]);

    const { deps: other, start: fresh } = setup();
    const posing = { ...bodyFor(0, fresh.secret, "lio"), player: "alice" };
    const refused = await submit(other, { matchId: MATCH, player: "mallory", body: posing, now: NOW });
    expect(refused).toMatchObject({ ok: false, error: { code: "notPlayer" } });
  });

  it("never changes its inputs (the request and body are frozen)", async () => {
    const { deps, start } = setup();
    const request = deepFreeze({ matchId: MATCH, player: "alice", body: bodyFor(0, start.secret, "lio"), now: NOW });
    const result = await submit(Object.freeze(deps), request);
    expect(result.ok).toBe(true);
  });
});

describe("submit: a resignation", () => {
  it("is handled the same way and ends the game", async () => {
    const { store, deps } = setup();
    const result = await submit(deps, { matchId: MATCH, player: "bob", body: { resign: true }, now: NOW + 1 });
    expect(result).toMatchObject({ ok: true, value: { seq: 1 } });
    expect(result.ok && result.value.effects).toContainEqual({ finalize: true });
    const saved = await store.load(MATCH);
    expect(saved?.record.status.kind).toBe("over");
    expect(saved?.record.seq).toBe(1);
    expect(saved?.secret.log).toEqual([{ system: "resign", side: "sae" }]);
  });
});

describe("submit: refusals save nothing", () => {
  it("an unknown match gives matchNotFound", async () => {
    const { deps, start } = setup();
    const body = bodyFor(0, start.secret, "lio");
    const result = await submit(deps, { matchId: "no-such-match", player: "alice", body, now: NOW });
    expect(result).toMatchObject({ ok: false, error: { code: "matchNotFound" } });
  });

  it("a match whose ruleset the server does not have gives unknownRuleset", async () => {
    const { store, deps, start } = setup();
    const body = bodyFor(0, start.secret, "lio");
    const result = await submit(
      { ...deps, ruleset: () => undefined },
      { matchId: MATCH, player: "alice", body, now: NOW },
    );
    expect(result).toMatchObject({ ok: false, error: { code: "unknownRuleset" } });
    expect(store.stored(MATCH)).toEqual({ record: start.record, secret: start.secret, frames: start.frames });
  });

  for (const [what, body] of [
    ["null", null],
    ["a string", "resign"],
    ["an array", [{ resign: true }]],
    ["a number", 7],
  ] as const) {
    it(`a body that is ${what}, not a plain object, gives illegalAnswer`, async () => {
      const { store, deps, start } = setup();
      const result = await submit(deps, { matchId: MATCH, player: "alice", body, now: NOW });
      expect(result).toMatchObject({ ok: false, error: { code: "illegalAnswer" } });
      expect(store.stored(MATCH)).toEqual({ record: start.record, secret: start.secret, frames: start.frames });
    });
  }

  it("every host refusal comes back with the host's own code, and nothing is saved", async () => {
    const { store, deps, start } = setup();
    const good = bodyFor(0, start.secret, "lio");
    const cases = [
      ["notPlayer", "mallory", good, NOW],
      ["staleSeq", "alice", { ...good, expectedSeq: 5 }, NOW],
      ["staleSeq", "alice", { ...good, expectedSeq: undefined }, NOW],
      ["illegalAnswer", "alice", { ...good, decisionId: 3 }, NOW],
      ["illegalAnswer", "alice", { ...good, value: "l1" }, NOW],
      ["invalidTime", "alice", good, NOW - 1],
      ["invalidTime", "alice", good, NOW + 0.5],
    ] as const;
    for (const [code, player, body, now] of cases) {
      const result = await submit(deps, { matchId: MATCH, player, body, now });
      expect(result, `${code} for ${JSON.stringify(body)}`).toMatchObject({ ok: false, error: { code } });
    }
    const wrong = { ...good, decisionId: "not-a-decision" };
    const engine = await submit(deps, { matchId: MATCH, player: "alice", body: wrong, now: NOW });
    const host = hostSubmit(ruleset, start.record, start.secret, { player: "alice", ...wrong } as never, NOW);
    expect(engine.ok).toBe(false);
    expect(!engine.ok && !host.ok && engine.error).toEqual(!host.ok && host.error);
    expect(store.stored(MATCH)).toEqual({ record: start.record, secret: start.secret, frames: start.frames });
  });
});
