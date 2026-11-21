// Issue #536: an online game whose polls the server refuses as signed out says so in its snapshot, and the
// next read that succeeds (after signing in again) clears it. A 5xx keeps the silent retry.
import { describe, expect, it, vi } from "vitest";
import { settle } from "../transport/test/remoteGame.ts";
import { onlineRig, play, poll } from "./test/onlineRig.ts";

describe("createOnlineGame: signed out (#536)", () => {
  it("two polls refused with 401 set signedOut and call the listener; the frame is kept", async () => {
    const r = onlineRig();
    await settle();
    const listener = vi.fn();
    r.game.subscribe(listener);
    r.fake.failNext(401);
    await poll(r);
    expect(r.game.getSnapshot().signedOut).toBe(false);
    r.fake.failNext(401);
    await poll(r);
    expect(r.game.getSnapshot().signedOut).toBe(true);
    expect(r.game.getSnapshot().frame?.seq).toBe(0);
    expect(listener).toHaveBeenCalled();
  });

  it("a read that succeeds afterwards clears signedOut, and new frames show again", async () => {
    const r = onlineRig();
    await settle();
    r.fake.failNext(403);
    await poll(r);
    r.fake.failNext(403);
    await poll(r);
    expect(r.game.getSnapshot().signedOut).toBe(true);
    await play(r);
    expect(r.game.getSnapshot().signedOut).toBe(false);
    expect(r.game.getSnapshot().frame?.seq).toBe(1);
  });

  it("5xx polls keep the silent retry: signedOut stays false", async () => {
    const r = onlineRig();
    await settle();
    for (let i = 0; i < 3; i++) {
      r.fake.failNext(500);
      await poll(r);
    }
    expect(r.game.getSnapshot().signedOut).toBe(false);
  });

  it("a second refusal still in flight at close changes nothing and calls no listener", async () => {
    const r = onlineRig();
    await settle();
    r.fake.failNext(401);
    await poll(r);
    // The second refused poll reaches the server, and is held there until after close.
    const release = r.fake.hold();
    const requests = r.fake.requests.length;
    r.fake.failNext(401);
    await poll(r);
    expect(r.fake.requests.length).toBe(requests + 1);
    const before = r.game.getSnapshot();
    const listener = vi.fn();
    r.game.subscribe(listener);
    r.game.close();
    release();
    await settle();
    expect(r.game.getSnapshot()).toBe(before);
    expect(r.game.getSnapshot().signedOut).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(r.timers.waiting()).toEqual([]);
  });
});
