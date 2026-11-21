// #534 follow-up: an access token that rejects (the refresh failed for a moment after expiry) while the deadline is
// read keeps the deadline as it was, never throws and is not read as signed out. The next new frame reads it again.
import { describe, expect, it } from "vitest";
import { settle } from "../transport/test/remoteGame.ts";
import { clockWith, onlineRig, play } from "./test/onlineRig.ts";

const FIRST = clockWith({ lio: 111_000, sae: 222_000 });
const LATER = clockWith({ lio: 444_000, sae: 555_000 });

describe("createOnlineGame: a deadline read whose token rejects (#534)", () => {
  it("keeps the previous deadline and sends no clock read; the next new frame reads it again", async () => {
    const r = onlineRig("alice", { clock: FIRST });
    await settle();
    const first = r.game.getSnapshot().deadline;
    expect(first?.at).toBe(111_000);
    r.setClock({ clock: LATER });
    // The poll's own reads still get a token; the rejection starts once the frame's last read is sent, so only
    // the deadline read that follows the new frame meets it.
    r.fake.onRequest = (request) => {
      if (request.path !== "/rest/v1/match_event") return;
      r.fake.onRequest = null;
      r.failToken(true);
    };
    await play(r);
    const s = r.game.getSnapshot();
    expect(s.frame?.seq).toBe(1);
    expect(s.deadline).toBe(first);
    expect(s.signedOut).toBe(false);
    expect(r.clockUrls).toHaveLength(1);
    r.failToken(false);
    await play(r);
    expect(r.clockUrls).toHaveLength(2);
    expect([444_000, 555_000]).toContain(r.game.getSnapshot().deadline?.at);
  });
});
