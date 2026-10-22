// The app's half of "unseen" for turn alerts (docs/architecture.md, Decision 5, Notifications): the remote
// transport tells the seen function once for each turn that waits for its signed-in player, so that player
// gets no email for a turn already on screen.
import type { Decision } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { postSeen, postSubmission } from "./remoteHttp.ts";
import type { Endpoint, FetchLike, FetchReply } from "./remoteHttp.ts";
import type { FakeSupabase } from "./test/fakeSupabase.ts";
import { nextMove, POLL_MS, rig, settle, watch } from "./test/remoteGame.ts";
import type { Rig } from "./test/remoteGame.ts";

const SEEN = "/functions/v1/seen";

/** The bodies of the seen calls made with this player's token, oldest first. */
const seenBy = (fake: FakeSupabase, player: string): unknown[] =>
  fake.requests
    .filter((q) => q.path === SEEN && q.headers.Authorization === `Bearer token-${player}`)
    .map((q) => q.body);
const seenCalls = (fake: FakeSupabase): number => fake.requests.filter((q) => q.path === SEEN).length;

/** Fires every waiting poll timer (one per transport) and lets the polls finish. */
async function pollAll(r: Rig, transports: number): Promise<void> {
  expect(r.timers.fire()).toBe(transports);
  await settle();
}

/** The player whose turn opens the match, and the other seat's player. */
function seatsAtStart(r: Rig): { waiting: string; other: string } {
  const waiting = nextMove(r.fake.current()).player;
  return { waiting, other: waiting === "alice" ? "bob" : "alice" };
}

describe("postSeen", () => {
  const recording = (answer: () => Promise<FetchReply>) => {
    const calls: { url: string; init: Parameters<FetchLike>[1] }[] = [];
    let reads = 0;
    const fetch: FetchLike = (url, init) => {
      calls.push({ url, init });
      return answer().then((reply) => ({
        ...reply,
        json: () => {
          reads++;
          return reply.json();
        },
      }));
    };
    const e: Endpoint = { url: "https://x.test", anonKey: "anon", matchId: "match-9", fetch };
    return { e, calls, reads: () => reads };
  };
  const status = (n: number) => () =>
    Promise.resolve<FetchReply>({ ok: n < 300, status: n, json: () => Promise.reject(new SyntaxError("empty")) });

  it("posts { matchId, seq } to the seen function with the same headers as a submission", async () => {
    const seen = recording(status(204));
    await postSeen(seen.e, "token-1", 7);
    const submit = recording(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }),
    );
    await postSubmission(submit.e, "token-1", { resign: true });
    expect(seen.calls).toEqual([
      {
        url: "https://x.test/functions/v1/seen",
        init: {
          method: "POST",
          headers: submit.calls[0]!.init.headers,
          body: JSON.stringify({ matchId: "match-9", seq: 7 }),
        },
      },
    ]);
  });

  it.each([204, 400, 401, 404, 500])("never reads the reply and resolves for status %i", async (n) => {
    const seen = recording(status(n));
    await expect(postSeen(seen.e, "token-1", 0)).resolves.toBeUndefined();
    expect(seen.reads()).toBe(0);
  });

  it("resolves when the fetch rejects or throws", async () => {
    const rejecting = recording(() => Promise.reject(new TypeError("offline")));
    await expect(postSeen(rejecting.e, "token-1", 0)).resolves.toBeUndefined();
    const throwing: Endpoint = {
      ...rejecting.e,
      fetch: () => {
        throw new TypeError("offline");
      },
    };
    await expect(postSeen(throwing, "token-1", 0)).resolves.toBeUndefined();
  });
});

describe("remote transport: telling the server a waiting turn was seen", () => {
  it("posts once for the opening turn at seq 0, after the frame is given, and not again at the same seq", async () => {
    const r = rig();
    const { waiting } = seatsAtStart(r);
    let framesWhenSeen = -1;
    const seen = watch(r.transportAs(waiting));
    r.fake.onRequest = (q) => {
      if (q.path === SEEN) framesWhenSeen = seen.frames.length;
    };
    await settle();
    expect(seen.frames.map((f) => [f.seq, f.decision !== null])).toEqual([[0, true]]);
    expect(seenBy(r.fake, waiting)).toEqual([{ matchId: "match-1", seq: 0 }]);
    expect(framesWhenSeen).toBe(1);
    await pollAll(r, 1);
    await pollAll(r, 1);
    expect(seenCalls(r.fake)).toBe(1);
  });

  it("posts once per waiting turn with two subscribers, including one that joins after the first poll", async () => {
    const r = rig();
    const { waiting } = seatsAtStart(r);
    const t = r.transportAs(waiting);
    const a = watch(t);
    const b = watch(t);
    await settle();
    const late = watch(t);
    await settle();
    expect([a, b, late].map((w) => w.frames.map((f) => f.seq))).toEqual([[0], [0], [0]]);
    await pollAll(r, 1);
    expect(seenBy(r.fake, waiting)).toEqual([{ matchId: "match-1", seq: 0 }]);
  });

  it("each seat posts once for each turn that waits for it, and never for the other side's turn", async () => {
    const r = rig();
    const lio = watch(r.transportAs("alice"));
    const sae = watch(r.transportAs("bob"));
    await settle();
    const waits = () => r.fake.current().frames.lio.decision !== null || r.fake.current().frames.sae.decision !== null;
    for (let i = 0; i < 8 && waits(); i++) {
      r.fake.commit(nextMove(r.fake.current()).submission);
      await pollAll(r, 2);
      await pollAll(r, 2);
    }
    for (const [player, watcher] of [
      ["alice", lio],
      ["bob", sae],
    ] as const) {
      const waitingSeqs = watcher.frames.filter((f) => f.decision !== null).map((f) => f.seq);
      // The game gives each seat at least two turns of its own and at least one of the other side's.
      expect(waitingSeqs.length).toBeGreaterThanOrEqual(2);
      expect(watcher.frames.some((f) => f.decision === null)).toBe(true);
      expect(seenBy(r.fake, player)).toEqual(waitingSeqs.map((seq) => ({ matchId: "match-1", seq })));
    }
  });

  it.each([
    ["a signed-in spectator", "carol"],
    ["a signed-out viewer", null],
  ])("%s never posts, even for a frame that carries a decision", async (_name, player) => {
    const r = rig();
    const decision = r.fake.current().frames[nextMove(r.fake.current()).s].decision!;
    // Every frame read comes back carrying a waiting decision, as a broken server could send.
    const withDecision: FetchLike = async (url, init) => {
      const answer = await r.fake.fetch(url, init);
      if (!url.includes("/rest/v1/match_view")) return answer;
      const rows = (await answer.json()) as { frame: Frame }[];
      return {
        ...answer,
        json: () => Promise.resolve(rows.map((row) => ({ ...row, frame: { ...row.frame, decision } }))),
      };
    };
    const seen = watch(r.transportAs(player, withDecision));
    await settle();
    await pollAll(r, 1);
    expect(seen.frames.map((f) => [f.viewer, f.decision as Decision | null])).toEqual([["spectator", decision]]);
    expect(seenCalls(r.fake)).toBe(0);
  });

  it.each([
    ["a thrown network error", "throw" as const],
    ["an error status", 500],
  ])("with seen failing (%s), frames and submit still work and the same seq is not posted again", async (_n, mode) => {
    const r = rig();
    r.fake.failSeen(mode);
    const { waiting } = seatsAtStart(r);
    const t = r.transportAs(waiting);
    const seen = watch(t);
    await settle();
    await pollAll(r, 1);
    await pollAll(r, 1);
    expect(seen.frames.map((f) => f.seq)).toEqual([0]);
    expect(seenCalls(r.fake)).toBe(1);
    expect(await t.submit(nextMove(r.fake.current()).args)).toEqual({ ok: true });
    await pollAll(r, 1);
    expect(seen.frames.map((f) => f.seq)).toEqual([0, 1]);
    expect(r.timers.waiting()).toEqual([POLL_MS]);
  });

  it("a seen call that never settles does not delay the next poll, the next frame or a submission", async () => {
    const r = rig();
    r.fake.failSeen("never");
    const { waiting } = seatsAtStart(r);
    const t = r.transportAs(waiting);
    const seen = watch(t);
    await settle();
    expect(seenCalls(r.fake)).toBe(1);
    expect(r.timers.waiting()).toEqual([POLL_MS]);
    expect(await t.submit(nextMove(r.fake.current()).args)).toEqual({ ok: true });
    await pollAll(r, 1);
    expect(seen.frames.map((f) => f.seq)).toEqual([0, 1]);
  });
});
