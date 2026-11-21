// Issue #536: polls the server refuses as signed out (401 or 403) are reported through `onStatus`, so the online
// game screen can say so instead of silently stopping. A 5xx or no reply keeps today's silent retry.
import { describe, expect, it } from "vitest";
import type { TransportStatus } from "./matchTransport.ts";
import { nextMove, POLL_MS, rig, settle } from "./test/remoteGame.ts";
import type { Rig } from "./test/remoteGame.ts";

/** Subscribes as alice and records every frame seq and every status delivered. */
function watchStatus(r: Rig) {
  const seqs: number[] = [];
  const statuses: TransportStatus[] = [];
  const stop = r.transportAs("alice").subscribe(
    (f) => seqs.push(f.seq),
    (s) => statuses.push(s),
  );
  return { seqs, statuses, stop };
}

async function nextPoll(r: Rig): Promise<void> {
  expect(r.timers.fire()).toBe(1);
  await settle();
}

describe("remote transport: signed-out polls (#536)", () => {
  it.each([401, 403])("two consecutive polls refused with %i report notSignedIn once", async (status) => {
    const r = rig();
    const w = watchStatus(r);
    await settle();
    expect(w.seqs).toEqual([0]);
    r.fake.failNext(status);
    await nextPoll(r);
    expect(w.statuses).toEqual([]);
    r.fake.failNext(status);
    await nextPoll(r);
    expect(w.statuses).toEqual(["notSignedIn"]);
    r.fake.failNext(status);
    await nextPoll(r);
    expect(w.statuses).toEqual(["notSignedIn"]);
    // Polling carries on at the same interval, so signing in again can clear it.
    expect(r.timers.waiting()).toEqual([POLL_MS]);
  });

  it("a successful poll after notSignedIn reports live, and frames flow again", async () => {
    const r = rig();
    const w = watchStatus(r);
    await settle();
    r.fake.failNext(401);
    await nextPoll(r);
    r.fake.failNext(401);
    await nextPoll(r);
    r.fake.commit(nextMove(r.fake.current()).submission);
    await nextPoll(r);
    expect(w.statuses).toEqual(["notSignedIn", "live"]);
    expect(w.seqs).toEqual([0, 1]);
  });

  it("a first subscribe refused twice reports notSignedIn", async () => {
    const r = rig();
    r.fake.failNext(401);
    const w = watchStatus(r);
    await settle();
    r.fake.failNext(401);
    await nextPoll(r);
    expect(w.statuses).toEqual(["notSignedIn"]);
    expect(w.seqs).toEqual([]);
  });

  it.each([
    ["a 5xx", 500],
    ["no reply", "throw" as const],
  ])("%s between two 401s is not consecutive, and never reports anything", async (_name, other) => {
    const r = rig();
    const w = watchStatus(r);
    await settle();
    for (const mode of [401, other, 401] as const) {
      r.fake.failNext(mode);
      await nextPoll(r);
    }
    expect(w.statuses).toEqual([]);
  });

  it.each([
    ["5xx", 503],
    ["no reply", "throw" as const],
  ])("repeated %s polls keep the silent retry: no status at all", async (_name, mode) => {
    const r = rig();
    const w = watchStatus(r);
    await settle();
    for (let i = 0; i < 4; i++) {
      r.fake.failNext(mode);
      await nextPoll(r);
    }
    expect(w.statuses).toEqual([]);
    expect(r.timers.waiting()).toEqual([POLL_MS]);
  });

  it("a 5xx after notSignedIn leaves the status as it was", async () => {
    const r = rig();
    const w = watchStatus(r);
    await settle();
    for (const mode of [401, 401, 500] as const) {
      r.fake.failNext(mode);
      await nextPoll(r);
    }
    expect(w.statuses).toEqual(["notSignedIn"]);
  });

  it("a subscriber joining while signed out is told notSignedIn at once", async () => {
    const r = rig();
    const t = r.transportAs("alice");
    t.subscribe(() => undefined);
    await settle();
    r.fake.failNext(401);
    await nextPoll(r);
    r.fake.failNext(401);
    await nextPoll(r);
    const late: TransportStatus[] = [];
    r.fake.failNext(401);
    t.subscribe(
      () => undefined,
      (s) => late.push(s),
    );
    expect(late).toEqual(["notSignedIn"]);
    await settle();
    expect(late).toEqual(["notSignedIn"]);
  });

  it("a subscriber given no onStatus still gets frames, and one that has left is not told", async () => {
    const r = rig();
    const t = r.transportAs("alice");
    const seqs: number[] = [];
    t.subscribe((f) => seqs.push(f.seq));
    const left: TransportStatus[] = [];
    const stop = t.subscribe(
      () => undefined,
      (s) => left.push(s),
    );
    await settle();
    stop();
    r.fake.failNext(401);
    await nextPoll(r);
    r.fake.failNext(401);
    await nextPoll(r);
    expect(left).toEqual([]);
    expect(seqs).toEqual([0]);
  });
});
