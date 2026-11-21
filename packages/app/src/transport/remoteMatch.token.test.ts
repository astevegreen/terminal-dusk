// #534 follow-up: an access token that can't be had for now (the refresh failed for a moment after expiry) makes a
// poll fail quietly. It delivers nothing, is tried again at the same interval, and is never read as signed out
// (#536): only the server refusing a read says that.
import { describe, expect, it } from "vitest";
import type { TransportStatus } from "./matchTransport.ts";
import { nextMove, POLL_MS, rig, settle } from "./test/remoteGame.ts";
import type { Rig } from "./test/remoteGame.ts";

const TOKEN_OF_ALICE = "token-alice";

/** Alice's transport, whose token rejects while `fails` is true (from the start when `failing`); records each frame seq and status. */
function watchWithToken(r: Rig, failing = false) {
  const token = { fails: failing, calls: 0 };
  const seqs: number[] = [];
  const statuses: TransportStatus[] = [];
  const t = r.transportAs("alice", r.fake.fetch, () => {
    token.calls++;
    return token.fails ? Promise.reject(new Error("the refresh failed for a moment")) : Promise.resolve(TOKEN_OF_ALICE);
  });
  t.subscribe(
    (f) => seqs.push(f.seq),
    (s) => statuses.push(s),
  );
  return { token, seqs, statuses };
}

async function nextPoll(r: Rig): Promise<void> {
  expect(r.timers.fire()).toBe(1);
  await settle();
}

describe("remote transport: a poll whose token rejects (#534)", () => {
  it("delivers nothing and sends no request, the next poll runs at the same interval, and frames flow once the token is back", async () => {
    const r = rig();
    const w = watchWithToken(r);
    await settle();
    expect(w.seqs).toEqual([0]);
    r.fake.commit(nextMove(r.fake.current()).submission);
    w.token.fails = true;
    const before = r.fake.requests.length;
    await nextPoll(r);
    expect(w.seqs).toEqual([0]);
    expect(r.fake.requests.length).toBe(before);
    expect(r.timers.waiting()).toEqual([POLL_MS]);
    w.token.fails = false;
    await nextPoll(r);
    expect(w.seqs).toEqual([0, 1]);
  });

  it("a first subscribe whose token rejects gets its first frame on the next poll", async () => {
    const r = rig();
    const w = watchWithToken(r, true);
    await settle();
    expect(w.seqs).toEqual([]);
    expect(w.token.calls).toBe(1);
    w.token.fails = false;
    await nextPoll(r);
    expect(w.seqs).toEqual([0]);
  });

  it("repeated rejections never report notSignedIn", async () => {
    const r = rig();
    const w = watchWithToken(r);
    await settle();
    w.token.fails = true;
    for (let i = 0; i < 4; i++) await nextPoll(r);
    expect(w.statuses).toEqual([]);
    expect(r.timers.waiting()).toEqual([POLL_MS]);
  });

  it("a rejection between two 401s breaks the run, so nothing is reported", async () => {
    const r = rig();
    const w = watchWithToken(r);
    await settle();
    r.fake.failNext(401);
    await nextPoll(r);
    w.token.fails = true;
    await nextPoll(r);
    w.token.fails = false;
    r.fake.failNext(401);
    await nextPoll(r);
    expect(w.statuses).toEqual([]);
  });
});
