import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { AnswerValue, CardDef, CardId, Ruleset, Side, Viewer } from "@terminal-dusk/engine";
import { hostCreate, hostSubmit } from "@terminal-dusk/host";
import type { Frame, HostResult, MatchConfig, Submission } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { createLocalMatch } from "./localMatch.ts";
import type { LocalMatch } from "./localMatch.ts";
import type { MatchTransport } from "./matchTransport.ts";

const SEED = "local-seed-1";
const T0 = 1_700_000_000_000;
const VIEWERS: Viewer[] = ["lio", "sae", "spectator"];

const side = (id: CardId): Side | "neutral" => (id.startsWith("l") ? "lio" : id.startsWith("s") ? "sae" : "neutral");
const card = (id: CardId): CardDef => ({
  id,
  era: id.startsWith("e") ? "late" : "test",
  ops: 1,
  affiliation: side(id),
  effect: [],
});
const LIO = ["l1", "l2", "l3", "l4"];
const SAE = ["s1", "s2", "s3", "s4"];
const ruleset: Ruleset = {
  id: "local-test-ruleset",
  cards: [...LIO, ...SAE, "n1", "n2", "z1", "z2", "z3", "e1", "e2"].map(card),
};
const config: MatchConfig = {
  matchId: "match-1",
  players: { lio: "alice", sae: "bob" },
  setup: {
    hands: { lio: [...LIO, "n1"], sae: [...SAE, "n2"] },
    deck: ["z1", "z2", "z3"],
    turns: 2,
    playsPerTurn: 1,
    eras: [{ era: "late", turn: 2, cards: ["e1", "e2"] }],
    contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
  },
};

let tick = 0;
const clock = (): number => T0 + tick++;

/** A local match, plus a mirror of the host called directly with the same inputs. */
function setup() {
  tick = 0;
  const made = createLocalMatch(ruleset, config, SEED, clock);
  if (!made.ok) throw new Error(made.error.code);
  const first = hostCreate(ruleset, config, SEED, T0);
  if (!first.ok) throw new Error(first.error.code);
  return { match: made.value, mirror: { current: first.value as HostResult } };
}

/** Records every frame a viewer's transport delivers. */
function record(match: LocalMatch, viewer: Viewer): { frames: Frame[]; stop: () => void; t: MatchTransport } {
  const t = match.transportFor(viewer);
  const frames: Frame[] = [];
  const stop = t.subscribe((f) => frames.push(f));
  return { frames, stop, t };
}

const waitingSide = (h: HostResult): Side => SIDES.find((s) => pendingFor(h.secret.state, s) !== null)!;
const firstAnswer = (h: HostResult, s: Side): AnswerValue => legalAnswers(ruleset, h.secret.state, s)[0]!;

/** The send arguments, and the equal host submission, for the side now waiting. */
function nextMove(h: HostResult) {
  const s = waitingSide(h);
  const decisionId = pendingFor(h.secret.state, s)!.id;
  const args = { decisionId, expectedSeq: h.record.seq, value: firstAnswer(h, s) };
  const submission: Submission = { player: h.record.players[s], ...args };
  return { s, args, submission };
}

describe("local transport: subscribing", () => {
  it("gives each viewer its own first frame at once, equal to the host's", () => {
    const { match, mirror } = setup();
    for (const viewer of VIEWERS) {
      const r = record(match, viewer);
      expect(r.frames).toEqual([mirror.current.frames[viewer]]);
    }
  });

  it("gives several subscribers to one viewer every frame, and stops after unsubscribing", async () => {
    const { match, mirror } = setup();
    const a = record(match, "lio");
    const b = record(match, "lio");
    const move = nextMove(mirror.current);
    a.stop();
    const result = await match.transportFor(move.s).submit(move.args);
    expect(result).toEqual({ ok: true });
    expect(a.frames).toHaveLength(1);
    expect(b.frames.map((f) => f.seq)).toEqual([0, 1]);
  });
});

describe("local transport: playing", () => {
  it("plays a short game; every new frame reaches that viewer's subscribers, equal to the host's frame", async () => {
    const { match, mirror } = setup();
    const seen = Object.fromEntries(VIEWERS.map((v) => [v, record(match, v)])) as Record<
      Viewer,
      ReturnType<typeof record>
    >;
    let steps = 0;
    while (mirror.current.record.status.kind === "active") {
      const move = nextMove(mirror.current);
      const hosted = hostSubmit(ruleset, mirror.current.record, mirror.current.secret, move.submission, T0 + steps + 1);
      if (!hosted.ok) throw new Error(hosted.error.code);
      mirror.current = hosted.value;
      steps++;
      expect(await seen[move.s].t.submit(move.args)).toEqual({ ok: true });
      for (const v of VIEWERS) expect(seen[v].frames.at(-1)).toEqual(mirror.current.frames[v]);
    }
    expect(steps).toBe(8);
    for (const v of VIEWERS) expect(seen[v].frames.map((f) => f.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("refuses a stale answer, changing nothing and delivering nothing", async () => {
    const { match, mirror } = setup();
    const lio = record(match, "lio");
    const move = nextMove(mirror.current);
    const result = await match.transportFor(move.s).submit({ ...move.args, expectedSeq: 5 });
    expect(result).toMatchObject({ ok: false, error: { code: "staleSeq" } });
    expect(lio.frames).toHaveLength(1);
    expect(await match.transportFor(move.s).submit(move.args)).toEqual({ ok: true });
  });

  it("gives one acceptance and one staleSeq refusal for a double submit", async () => {
    const { match, mirror } = setup();
    const move = nextMove(mirror.current);
    const t = match.transportFor(move.s);
    const [first, second] = await Promise.all([t.submit(move.args), t.submit(move.args)]);
    expect(first).toEqual({ ok: true });
    expect(second).toMatchObject({ ok: false, error: { code: "staleSeq" } });
  });

  it("ends the game on a resignation and tells every viewer", async () => {
    const { match } = setup();
    const seen = VIEWERS.map((v) => record(match, v));
    expect(await match.transportFor("lio").resign()).toEqual({ ok: true });
    for (const r of seen) {
      expect(r.frames).toHaveLength(2);
      expect(r.frames[1]!.view.public.status.kind).not.toBe("active");
    }
    expect(await match.transportFor("sae").resign()).toMatchObject({ ok: false });
  });
});

describe("local transport: the spectator and refusals", () => {
  it("refuses the spectator's submit and resign with notPlayer, delivering nothing", async () => {
    const { match, mirror } = setup();
    const lio = record(match, "lio");
    const move = nextMove(mirror.current);
    const t = match.transportFor("spectator");
    expect(await t.submit(move.args)).toEqual({ ok: false, error: { code: "notPlayer" } });
    expect(await t.resign()).toEqual({ ok: false, error: { code: "notPlayer" } });
    expect(lio.frames).toHaveLength(1);
  });

  it("returns a refusal from hostCreate as it is", () => {
    const bad = createLocalMatch(ruleset, { ...config, matchId: "" }, SEED, clock);
    expect(bad).toMatchObject({ ok: false, error: { code: "invalidConfig" } });
  });
});

describe("local transport: answering from inside onFrame", () => {
  it("still gives every viewer's subscribers every frame, in seq order", async () => {
    const { match, mirror } = setup();
    const lio = match.transportFor("lio");
    const sae = match.transportFor("sae");
    const spectator = record(match, "spectator");
    const lioSeen: number[] = [];
    const saeSeen: number[] = [];
    const pending: Promise<unknown>[] = [];
    // The LIO subscriber answers for whichever side waits, as soon as it sees a new frame.
    let h = mirror.current;
    const answerFrom = (own: MatchTransport, ownSide: Side, log: number[]) => (frame: Frame) => {
      log.push(frame.seq);
      if (frame.decision && frame.decision.side === ownSide && frame.seq === h.record.seq) {
        const value = firstAnswer(h, ownSide);
        const next = hostSubmit(
          ruleset,
          h.record,
          h.secret,
          {
            player: h.record.players[ownSide],
            expectedSeq: h.record.seq,
            decisionId: frame.decision.id,
            value,
          },
          T0 + 1000 + frame.seq,
        );
        if (next.ok) h = next.value;
        pending.push(own.submit({ decisionId: frame.decision.id, expectedSeq: frame.seq, value }));
      }
    };
    lio.subscribe(answerFrom(lio, "lio", lioSeen));
    sae.subscribe(answerFrom(sae, "sae", saeSeen));
    for (let i = 0; i < 20 && pending.length <= i; i++) await Promise.resolve();
    while (pending.length > 0) await pending.shift();
    await new Promise((r) => setTimeout(r, 0));
    const finalSeq = spectator.frames.at(-1)!.seq;
    expect(finalSeq).toBeGreaterThan(1);
    const upTo = Array.from({ length: finalSeq + 1 }, (_, i) => i);
    expect(spectator.frames.map((f) => f.seq)).toEqual(upTo);
    expect(lioSeen).toEqual(upTo);
    expect(saeSeen).toEqual(upTo);
  });
});
