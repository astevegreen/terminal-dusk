import { describe, expect, it, vi } from "vitest";
import { eraText } from "../displayText.ts";
import { logLine } from "../eventPresentation.ts";
import { cardName } from "../testMode/fixture.ts";
import { nextMove, POLL_MS, settle, watch } from "../transport/test/remoteGame.ts";
import type { Frame } from "@terminal-dusk/host";
import { turnOf } from "./onlineGame.ts";
import { onlineRig, play, poll } from "./test/onlineRig.ts";

describe("createOnlineGame: frames, log and turn", () => {
  it("the first frame: turn is loading before it, then the frame arrives and the listener is called", async () => {
    const r = onlineRig();
    const listener = vi.fn();
    r.game.subscribe(listener);
    expect(r.game.getSnapshot()).toEqual({
      frame: null,
      log: [],
      era: null,
      turn: "loading",
      deadline: null,
      refusal: null,
    });
    await settle();
    const s = r.game.getSnapshot();
    expect(s.frame?.seq).toBe(0);
    expect(s.frame?.viewer).toBe("lio");
    expect(s.turn).toBe("mine");
    expect(listener).toHaveBeenCalled();
    expect(r.timers.waiting()).toEqual([POLL_MS]);
  });

  it("the rival moving: a new frame arrives on the next poll and turn flips to mine", async () => {
    const r = onlineRig();
    await settle();
    await play(r); // alice's card choice, made by her own client
    expect(r.game.getSnapshot().turn).toBe("rival");
    expect(r.game.getSnapshot().frame?.seq).toBe(1);
    await play(r); // bob's
    expect(r.game.getSnapshot().turn).toBe("mine");
    expect(r.game.getSnapshot().frame?.seq).toBe(2);
  });

  it("log lines are kept once each, oldest first, and era follows the latest eraStarted", async () => {
    const r = onlineRig();
    const watched = watch(r.transportAs("alice"));
    await settle();
    expect(r.game.getSnapshot().era).toBeNull();
    for (let i = 0; i < 5; i++) {
      await play(r);
      await poll(r); // a poll with nothing new adds nothing
    }
    const expected = watched.frames.flatMap((f) => f.events).map((e) => logLine(e, { card: cardName, era: eraText }));
    expect(expected.length).toBeGreaterThan(0);
    expect(r.game.getSnapshot().log).toEqual(expected);
    expect(r.game.getSnapshot().era).toBe("late");
  });

  it("turn is over once the game is over", async () => {
    const r = onlineRig();
    await settle();
    r.fake.commit({ player: "bob", resign: true });
    await poll(r);
    expect(r.game.getSnapshot().frame?.view.public.status.kind).toBe("over");
    expect(r.game.getSnapshot().turn).toBe("over");
  });

  it("a spectator (signed in, not seated) looking at a pending decision sees rival, never mine", async () => {
    const r = onlineRig("carol");
    await settle();
    const s = r.game.getSnapshot();
    expect(s.frame?.viewer).toBe("spectator");
    expect(s.frame?.decision).toBeNull();
    expect(s.frame?.view.public.pending.length).toBeGreaterThan(0);
    expect(s.turn).toBe("rival");
  });

  it("turn is rival only when pending holds a decision for the other side; empty pending stays loading", async () => {
    const r = onlineRig();
    await settle();
    await play(r); // alice has answered; bob's card choice is pending
    const frame = r.game.getSnapshot().frame!;
    expect(frame.decision).toBeNull();
    expect(turnOf(frame)).toBe("rival");
    const withPending = (pending: Frame["view"]["public"]["pending"]): Frame => ({
      ...frame,
      view: { ...frame.view, public: { ...frame.view.public, pending } },
    });
    expect(turnOf(withPending([]))).toBe("loading");
    const own = frame.view.public.pending.map((d) => ({ ...d, side: "lio" as const }));
    expect(turnOf(withPending(own))).toBe("loading");
    expect(turnOf(null)).toBe("loading");
  });

  it("no snapshot holds the access token", async () => {
    const r = onlineRig();
    const seen: string[] = [];
    r.game.subscribe(() => seen.push(JSON.stringify(r.game.getSnapshot())));
    await settle();
    await play(r);
    expect(seen.length).toBeGreaterThan(0);
    for (const text of seen) expect(text).not.toContain("token-alice");
  });
});

describe("createOnlineGame: answer", () => {
  it("answer submits for the current decision with its decisionId and the frame's seq", async () => {
    const r = onlineRig();
    await settle();
    const { args } = nextMove(r.fake.current());
    await r.game.answer(args.value);
    const post = r.fake.requests.find((q) => q.path === "/functions/v1/submit");
    expect(post?.body).toEqual({ matchId: "match-1", submission: args });
    expect(r.game.getSnapshot().refusal).toBeNull();
    await poll(r);
    expect(r.game.getSnapshot().turn).toBe("rival");
  });

  it("with no current decision, answer sends nothing", async () => {
    const r = onlineRig();
    await settle();
    await play(r);
    expect(r.game.getSnapshot().turn).toBe("rival");
    const before = r.fake.requests.length;
    await r.game.answer(nextMove(r.fake.current()).args.value);
    expect(r.fake.requests.length).toBe(before);
  });

  it("a refusal is put in refusal and the frame is kept; the next new frame clears it", async () => {
    const r = onlineRig();
    await settle();
    const { args, submission } = nextMove(r.fake.current());
    r.fake.commit(submission); // the same answer from another tab: this one is now stale
    const frame = r.game.getSnapshot().frame;
    await r.game.answer(args.value);
    expect(r.game.getSnapshot().refusal?.code).toBe("staleSeq");
    expect(r.game.getSnapshot().frame).toBe(frame);
    await poll(r);
    expect(r.game.getSnapshot().frame?.seq).toBe(1);
    expect(r.game.getSnapshot().refusal).toBeNull();
  });

  it("a network failure is a refusal too, and answering again clears it when called", async () => {
    const r = onlineRig();
    await settle();
    const { args } = nextMove(r.fake.current());
    r.fake.failNext("throw");
    await r.game.answer(args.value);
    expect(r.game.getSnapshot().refusal?.code).toBe("networkError");
    const refusals: unknown[] = [];
    r.game.subscribe(() => refusals.push(r.game.getSnapshot().refusal));
    const pending = r.game.answer(args.value);
    expect(r.game.getSnapshot().refusal).toBeNull();
    await pending;
    expect(refusals).toEqual([null]);
    expect(r.game.getSnapshot().refusal).toBeNull();
  });
});

describe("createOnlineGame: close", () => {
  it("close leaves no timer pending, sends no request and calls no listener", async () => {
    const r = onlineRig();
    const listener = vi.fn();
    r.game.subscribe(listener);
    await settle();
    r.game.close();
    expect(r.timers.waiting()).toEqual([]);
    const sent = r.sent.length;
    const calls = listener.mock.calls.length;
    r.fake.commit(nextMove(r.fake.current()).submission);
    r.timers.fire();
    await r.game.answer(nextMove(r.fake.current()).args.value);
    await settle();
    expect(r.sent.length).toBe(sent);
    expect(listener.mock.calls.length).toBe(calls);
  });

  it("an answer still in flight at close changes nothing and calls no listener", async () => {
    const r = onlineRig();
    await settle();
    const { args, submission } = nextMove(r.fake.current());
    r.fake.commit(submission); // so the answer will be refused
    const listener = vi.fn();
    r.game.subscribe(listener);
    const release = r.fake.hold();
    const pending = r.game.answer(args.value);
    await settle();
    r.game.close();
    release();
    await pending;
    await settle();
    expect(r.game.getSnapshot().refusal).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });
});
