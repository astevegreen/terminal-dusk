import type { GameEvent, Viewer } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { nextMove, POLL_MS, rig, settle, watch } from "./test/remoteGame.ts";
import type { Rig } from "./test/remoteGame.ts";

/** Makes `count` moves straight on the server; returns each new step's events for the viewer, oldest first. */
function moveOnServer(r: Rig, count: number, viewer: Viewer): GameEvent[][] {
  const steps: GameEvent[][] = [];
  for (let i = 0; i < count; i++) {
    r.fake.commit(nextMove(r.fake.current()).submission);
    steps.push(r.fake.current().frames[viewer].events);
  }
  return steps;
}

/** Fires the waiting poll timer and lets the poll finish. */
async function nextPoll(r: Rig): Promise<void> {
  expect(r.timers.fire()).toBe(1);
  await settle();
}

describe("remote transport: whose frames", () => {
  it("a LIO player, a SAE player and a spectator each see only their own frames", async () => {
    const r = rig();
    const cases: [string | null, Viewer][] = [
      ["alice", "lio"],
      ["bob", "sae"],
      ["carol", "spectator"],
      [null, "spectator"],
    ];
    for (const [player, viewer] of cases) {
      const seen = watch(r.transportAs(player));
      await settle();
      expect(seen.frames).toEqual([r.fake.current().frames[viewer]]);
    }
  });
});

describe("remote transport: polling", () => {
  it("gives the latest frame once read, then one frame per new seq, never the same or an older one", async () => {
    const r = rig();
    const seen = watch(r.transportAs("alice"));
    await settle();
    expect(seen.frames.map((f) => f.seq)).toEqual([0]);
    expect(r.timers.waiting()).toEqual([POLL_MS]);
    await nextPoll(r);
    expect(seen.frames.map((f) => f.seq)).toEqual([0]);
    const [step1] = moveOnServer(r, 1, "lio");
    await nextPoll(r);
    await nextPoll(r);
    expect(seen.frames.map((f) => f.seq)).toEqual([0, 1]);
    expect(seen.frames[1]).toEqual({ ...r.fake.current().frames.lio, events: step1 });
  });

  it("skipped steps' events all arrive with the next frame, oldest first, none twice", async () => {
    const r = rig();
    const seen = watch(r.transportAs("bob"));
    await settle();
    const steps = moveOnServer(r, 3, "sae");
    await nextPoll(r);
    expect(seen.frames.map((f) => f.seq)).toEqual([0, 3]);
    expect(seen.frames[1]!.events).toEqual(steps.flat());
  });

  it("a step committed between the frame read and the event read is delivered once, with the next frame", async () => {
    const r = rig();
    const seq0 = r.fake.current().frames.spectator.events;
    let later: GameEvent[][] = [];
    r.fake.onRequest = (request) => {
      if (request.path !== "/rest/v1/match_event") return;
      r.fake.onRequest = null;
      later = moveOnServer(r, 1, "spectator");
    };
    const seen = watch(r.transportAs("carol"));
    await settle();
    expect(seen.frames.map((f) => f.seq)).toEqual([0]);
    expect(seen.frames[0]!.events).toEqual(seq0);
    await nextPoll(r);
    expect(seen.frames.map((f) => f.seq)).toEqual([0, 1]);
    expect(seen.frames[1]!.events).toEqual(later.flat());
    expect(seen.frames.flatMap((f) => f.events)).toEqual([...seq0, ...later.flat()]);
  });

  it("a first subscribe mid-game gets every step's events from seq 0", async () => {
    const r = rig();
    const all = [...r.fake.current().frames.lio.events];
    // Play on the server until the second era has started, so the earlier log holds an eraStarted line.
    while (!all.some((e) => e.kind === "eraStarted")) all.push(...moveOnServer(r, 1, "lio").flat());
    moveOnServer(r, 1, "lio").forEach((step) => all.push(...step));
    expect(r.fake.current().record.seq).toBeGreaterThan(1);
    const seen = watch(r.transportAs("alice"));
    await settle();
    expect(seen.frames).toEqual([{ ...r.fake.current().frames.lio, events: all }]);
    expect(seen.frames[0]!.events.filter((e) => e.kind === "eraStarted")).toHaveLength(1);
  });

  it.each([
    ["a thrown network error", "throw" as const],
    ["an error status", 500],
  ])("a failed poll (%s) delivers nothing, and the next poll still runs at the same interval", async (_name, mode) => {
    const r = rig();
    r.fake.failNext(mode);
    const seen = watch(r.transportAs("alice"));
    await settle();
    expect(seen.frames).toEqual([]);
    expect(r.timers.waiting()).toEqual([POLL_MS]);
    await nextPoll(r);
    expect(seen.frames.map((f) => f.seq)).toEqual([0]);
    moveOnServer(r, 1, "lio");
    r.fake.failNext(mode);
    await nextPoll(r);
    expect(seen.frames.map((f) => f.seq)).toEqual([0]);
    expect(r.timers.waiting()).toEqual([POLL_MS]);
    await nextPoll(r);
    expect(seen.frames.map((f) => f.seq)).toEqual([0, 1]);
  });

  it("a slow poll never overlaps the next: the next is scheduled only after it finishes", async () => {
    const r = rig();
    const t = r.transportAs("alice");
    const seen = watch(t);
    await settle();
    const release = r.fake.hold();
    const before = r.fake.requests.length;
    expect(r.timers.fire()).toBe(1);
    await settle();
    // The poll is stuck on its first read; no timer waits, and a new subscriber does not start a second poll.
    expect(r.timers.waiting()).toEqual([]);
    const late = watch(t);
    await settle();
    expect(r.fake.requests.length).toBe(before + 1);
    moveOnServer(r, 1, "lio");
    release();
    await settle();
    expect(seen.frames.map((f) => f.seq)).toEqual([0, 1]);
    expect(late.frames.map((f) => f.seq)).toEqual([1]);
    expect(r.timers.waiting()).toEqual([POLL_MS]);
  });
});

describe("remote transport: subscribers", () => {
  it("two subscribers each get every frame, and one leaving leaves the other running", async () => {
    const r = rig();
    const t = r.transportAs("bob");
    const a = watch(t);
    const b = watch(t);
    await settle();
    moveOnServer(r, 1, "sae");
    await nextPoll(r);
    expect(a.frames.map((f) => f.seq)).toEqual([0, 1]);
    expect(b.frames).toEqual(a.frames);
    a.stop();
    moveOnServer(r, 1, "sae");
    await nextPoll(r);
    expect(a.frames.map((f) => f.seq)).toEqual([0, 1]);
    expect(b.frames.map((f) => f.seq)).toEqual([0, 1, 2]);
  });

  it("a subscriber that leaves during an in-flight poll is not called", async () => {
    const r = rig();
    const release = r.fake.hold();
    const seen = watch(r.transportAs("alice"));
    await settle();
    seen.stop();
    release();
    await settle();
    expect(seen.frames).toEqual([]);
    expect(r.timers.waiting()).toEqual([]);
  });

  it("stopping a subscription stops its polling", async () => {
    const r = rig();
    const seen = watch(r.transportAs("alice"));
    await settle();
    expect(r.timers.waiting()).toEqual([POLL_MS]);
    seen.stop();
    expect(r.timers.waiting()).toEqual([]);
    const before = r.fake.requests.length;
    expect(r.timers.fire()).toBe(0);
    await settle();
    expect(r.fake.requests.length).toBe(before);
  });
});
