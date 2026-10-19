import type { Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { fixtureConfig, fixtureRuleset } from "../testMode/fixture.ts";
import { createLocalMatch } from "../transport/localMatch.ts";
import type { LocalMatch } from "../transport/localMatch.ts";
import { createVsAiSession } from "./session.ts";
import type { VsAiSession } from "./session.ts";
import { flush, playOut, pressFirst } from "./test/scriptedHuman.ts";
import { standInAi } from "./test/standInAi.ts";
import type { StandIn, StandInOptions } from "./test/standInAi.ts";

const GAME_SEED = "game-seed-never-shown-7f3a";
let tick = 0;
const clock = (): number => 1_700_000_000_000 + tick++;

function start(human: Side, options: StandInOptions = {}, aiSeed = 11): { session: VsAiSession; standIn: StandIn } {
  const standIn = standInAi(options);
  const session = createVsAiSession({ human, gameSeed: GAME_SEED, aiSeed, clock, makeAi: standIn.makeAi });
  return { session, standIn };
}

describe("a whole game against the AI", () => {
  for (const human of ["lio", "sae"] as const) {
    it(`playing as ${human.toUpperCase()}, the human and the AI finish the fixture game`, async () => {
      const { session, standIn } = start(human);
      await playOut(session, standIn);
      const snapshot = session.getSnapshot();
      expect(snapshot.aiRefusal).toBeNull();
      expect(snapshot.frame?.view.public.status.kind).toBe("over");
      expect(snapshot.frame?.viewer).toBe(human);
      expect(standIn.answers.length).toBeGreaterThan(0);
    });
  }
});

describe("the AI's answers depend only on the seeds and the human's answers", () => {
  it("two games with the same seeds give the same log, even when the human picks first", async () => {
    const quick = start("lio");
    await playOut(quick.session, quick.standIn);

    const slow = start("lio", { hold: true });
    // The human answers the opening pick while the AI's reply is still held.
    await playOut(slow.session, slow.standIn, async () => {
      expect(slow.standIn.asked).toHaveLength(1);
      await pressFirst(slow.session);
    });

    expect(slow.session.getSnapshot().frame?.view.public.status.kind).toBe("over");
    expect(slow.session.getSnapshot().log).toEqual(quick.session.getSnapshot().log);
    expect(slow.standIn.answers).toEqual(quick.standIn.answers);
  });

  it("asks the AI exactly once per decision", async () => {
    const { session, standIn } = start("sae", { hold: true });
    await playOut(session, standIn, () => pressFirst(session));
    expect(standIn.asked.length).toBeGreaterThan(1);
    expect(standIn.asked).not.toContain("none");
    expect(new Set(standIn.asked).size).toBe(standIn.asked.length);
  });
});

describe("the opening picks", () => {
  it("the AI picks without waiting, and the human's frame never holds the AI's pick before the reveal", async () => {
    const { session, standIn } = start("lio");
    await flush();
    const pick = standIn.answers[0];
    expect(pick?.kind).toBe("chooseCard");
    const card = pick?.kind === "chooseCard" ? pick.card : "";
    // The AI has answered; the human has not, so nothing is revealed yet.
    const frame = session.getSnapshot().frame;
    expect(frame?.decision?.kind).toBe("chooseCard");
    expect(JSON.stringify(frame)).not.toMatch(new RegExp(`"${card}"`));
  });
});

describe("an AI answer that comes too late", () => {
  it("is dropped and not submitted when its decision is no longer waiting", async () => {
    const standIn = standInAi({ hold: true });
    let match: LocalMatch | null = null;
    const aiSubmits: string[] = [];
    const session = createVsAiSession({
      human: "lio",
      gameSeed: GAME_SEED,
      aiSeed: 11,
      clock,
      makeAi: standIn.makeAi,
      makeMatch: (seed, matchClock) => {
        const made = createLocalMatch(fixtureRuleset, fixtureConfig, seed, matchClock);
        if (!made.ok) return made;
        const real = made.value;
        match = real;
        const transportFor: LocalMatch["transportFor"] = (viewer) => {
          const transport = real.transportFor(viewer);
          if (viewer !== "sae") return transport;
          return {
            ...transport,
            submit: (s) => {
              aiSubmits.push(s.decisionId);
              return transport.submit(s);
            },
          };
        };
        return { ok: true, value: { transportFor } };
      },
    });
    expect(standIn.asked).toHaveLength(1);
    // While the AI thinks, the human resigns, so the AI's decision is no longer waiting.
    await (match as LocalMatch | null)?.transportFor("lio").resign();
    expect(session.getSnapshot().frame?.view.public.status.kind).toBe("over");
    standIn.release();
    await flush();
    expect(aiSubmits).toEqual([]);
    expect(session.getSnapshot().aiRefusal).toBeNull();
  });
});

describe("a refused AI answer", () => {
  it("sets aiRefusal, stops the AI, is not asked again, and leaves the human's refusal alone", async () => {
    const { session, standIn } = start("lio", { override: () => ({ kind: "yesNo", yes: true }) });
    await flush();
    const snapshot = session.getSnapshot();
    expect(snapshot.aiRefusal).not.toBeNull();
    expect(snapshot.refusal).toBeNull();
    expect(standIn.stops).toBe(1);
    await pressFirst(session);
    await flush();
    expect(standIn.asked).toHaveLength(1);
    expect(session.getSnapshot().refusal).toBeNull();
  });
});

describe("the game seed", () => {
  it("is in no snapshot field or log line", async () => {
    const { session, standIn } = start("sae");
    const seen: string[] = [];
    session.subscribe(() => seen.push(JSON.stringify(session.getSnapshot())));
    await playOut(session, standIn);
    expect(seen.length).toBeGreaterThan(0);
    for (const text of seen) expect(text).not.toContain(GAME_SEED);
  });
});

describe("stopping the session", () => {
  it("stops the AI and asks it nothing more", async () => {
    const { session, standIn } = start("lio", { hold: true });
    session.stop();
    expect(standIn.stops).toBe(1);
    standIn.release();
    await flush();
    await pressFirst(session).catch(() => undefined);
    expect(standIn.asked).toHaveLength(1);
  });
});
