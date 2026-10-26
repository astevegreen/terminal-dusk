import { describe, expect, it } from "vitest";
import { settle } from "../transport/test/remoteGame.ts";
import { clockWith, NOW, onlineRig, play, poll } from "./test/onlineRig.ts";

const BOTH = clockWith({ lio: 111_000, sae: 222_000 });

describe("createOnlineGame: the deadline", () => {
  it("reads only the match row's clock column, after the first frame and on each new seq", async () => {
    const r = onlineRig("alice", { clock: BOTH });
    await settle();
    expect(r.clockUrls).toHaveLength(1);
    await poll(r); // nothing new: no read
    expect(r.clockUrls).toHaveLength(1);
    await play(r);
    expect(r.clockUrls).toHaveLength(2);
    for (const url of r.clockUrls) {
      const q = new URL(url).searchParams;
      expect(q.getAll("select")).toEqual(["clock"]);
      expect(q.get("match_id")).toBe("eq.match-1");
      expect(url).not.toContain("seed");
    }
  });

  it("on my decision it is my side's deadline, with the rule, days, grace and the time of the read", async () => {
    const r = onlineRig("alice", { clock: BOTH });
    await settle();
    expect(r.game.getSnapshot().deadline).toEqual({
      side: "lio",
      at: 111_000,
      rule: "graceThenLoss",
      days: 3,
      graceLeft: true,
      now: NOW,
    });
  });

  it("with both sides waited on, it is the viewer's own side, not the first side waiting", async () => {
    const r = onlineRig("bob", { clock: BOTH });
    await settle();
    const s = r.game.getSnapshot();
    expect(s.frame?.view.public.pending.map((d) => d.side)).toEqual(["lio", "sae"]);
    expect(s.deadline?.side).toBe("sae");
    expect(s.deadline?.at).toBe(222_000);
  });

  it("on the rival's decision it is the rival's deadline; graceLeft is false once its extension is used", async () => {
    const r = onlineRig("alice", { clock: BOTH });
    await settle();
    r.setClock({ clock: clockWith({ lio: null, sae: 333_000 }, "graceThenLoss", { lio: false, sae: true }) });
    r.time.now = NOW + 7;
    await play(r);
    expect(r.game.getSnapshot().turn).toBe("rival");
    expect(r.game.getSnapshot().deadline).toEqual({
      side: "sae",
      at: 333_000,
      rule: "graceThenLoss",
      days: 3,
      graceLeft: false,
      now: NOW + 7,
    });
  });

  it("graceLeft is false under lossOnTime", async () => {
    const r = onlineRig("alice", { clock: clockWith({ lio: 111_000, sae: 222_000 }, "lossOnTime") });
    await settle();
    expect(r.game.getSnapshot().deadline?.graceLeft).toBe(false);
    expect(r.game.getSnapshot().deadline?.rule).toBe("lossOnTime");
  });

  it("is null when the row has no clock", async () => {
    const r = onlineRig("alice", { clock: null });
    await settle();
    expect(r.game.getSnapshot().frame).not.toBeNull();
    expect(r.game.getSnapshot().deadline).toBeNull();
  });

  it("is null when the chosen side's deadline is null", async () => {
    const r = onlineRig("alice", { clock: clockWith({ lio: null, sae: 222_000 }) });
    await settle();
    expect(r.game.getSnapshot().deadline).toBeNull();
  });

  it("is null once the game is over, even though the row keeps its clock", async () => {
    const r = onlineRig("alice", { clock: BOTH });
    await settle();
    expect(r.game.getSnapshot().deadline).not.toBeNull();
    r.fake.commit({ player: "bob", resign: true });
    await poll(r);
    expect(r.game.getSnapshot().turn).toBe("over");
    expect(r.game.getSnapshot().deadline).toBeNull();
  });

  it("a failed or malformed read keeps the previous deadline and never throws", async () => {
    const r = onlineRig("alice", { clock: BOTH });
    await settle();
    const before = r.game.getSnapshot().deadline;
    expect(before).not.toBeNull();
    const modes = [
      { fail: "throw" as const },
      { fail: 500 },
      { malformed: { not: "a list" } },
      { malformed: [{ clock: { rule: "sometimes", days: 3 } }] },
    ];
    for (const mode of modes) {
      r.setClock(mode);
      await play(r);
      expect(r.game.getSnapshot().deadline).toEqual(before);
    }
    expect(r.game.getSnapshot().frame?.seq).toBe(modes.length);
  });

  it("a clock read still in flight at close changes nothing and calls no listener", async () => {
    const r = onlineRig("alice", { clock: BOTH });
    const release = r.holdClock();
    let calls = 0;
    r.game.subscribe(() => calls++);
    await settle();
    expect(r.clockUrls).toHaveLength(1);
    const seen = calls;
    r.game.close();
    release();
    await settle();
    expect(r.game.getSnapshot().deadline).toBeNull();
    expect(calls).toBe(seen);
  });
});
