// What a watcher is sent (O14): only the public spectator frame, never a hand, the deck, the seed or the move log.
import { describe, expect, it } from "vitest";
import { leaksFor } from "@terminal-dusk/host/test/secret-leaks";
import type { FetchLike } from "../../transport/remoteHttp.ts";
import { ANON_KEY, URL_BASE } from "../../transport/test/fakeSupabase.ts";
import { config, nextMove, POLL_MS, rig, settle } from "../../transport/test/remoteGame.ts";
import { cardName } from "../../testMode/fixture.ts";
import { createWatchGame } from "./watchGame.ts";

function watcher() {
  const base = rig();
  const bodies: { path: string; text: string }[] = [];
  const paths: string[] = [];
  const fetch: FetchLike = async (url, init) => {
    paths.push(new URL(url).pathname);
    const reply = await base.fake.fetch(url, init);
    const body: unknown = await reply.json().catch(() => null);
    bodies.push({ path: new URL(url).pathname, text: JSON.stringify(body) });
    return { ok: reply.ok, status: reply.status, json: () => Promise.resolve(body) };
  };
  const game = createWatchGame({
    url: URL_BASE,
    anonKey: ANON_KEY,
    matchId: config.matchId,
    fetch,
    now: () => 1,
    label: cardName,
    pollMs: POLL_MS,
    timers: base.timers,
  });
  return { ...base, game, bodies, paths };
}

describe("watching a game", () => {
  it("shows the public spectator frame, with no decision to answer", async () => {
    const w = watcher();
    await settle();
    const s = w.game.getSnapshot();
    expect(s.frame?.viewer).toBe("spectator");
    expect(s.frame?.decision).toBeNull();
    expect(s.turn).toBe("rival");
  });

  it("follows the game by polling, and sees it end", async () => {
    const w = watcher();
    await settle();
    w.fake.commit(nextMove(w.fake.current()).submission);
    w.timers.fire();
    await settle();
    expect(w.game.getSnapshot().frame?.seq).toBe(w.fake.current().record.seq);
    w.fake.commit({ player: "bob", resign: true });
    w.timers.fire();
    await settle();
    expect(w.game.getSnapshot().turn).toBe("over");
    w.game.close();
  });

  it("every response over a whole game holds no hand, deck, seed or generator state, and never touches the secret", async () => {
    const w = watcher();
    await settle();
    for (let i = 0; i < 4; i++) {
      w.fake.commit(nextMove(w.fake.current()).submission);
      w.timers.fire();
      await settle();
      const secret = w.fake.current().secret;
      for (const body of w.bodies) expect(leaksFor(body.text, secret, "spectator")).toEqual([]);
    }
    expect(w.bodies.length).toBeGreaterThan(4);
    expect(
      w.paths.every((p) => p === "/rest/v1/match" || p === "/rest/v1/match_view" || p === "/rest/v1/match_event"),
    ).toBe(true);
    expect(w.paths).not.toContain("/rest/v1/match_secret");
    expect(w.paths.some((p) => p.startsWith("/functions/"))).toBe(false);
    w.game.close();
  });

  it("asks only for the spectator rows and sends no player token", async () => {
    const w = watcher();
    await settle();
    expect(w.fake.requests.length).toBeGreaterThan(0);
    for (const r of w.fake.requests) {
      expect(r.headers.Authorization ?? "").not.toMatch(/token-/);
      const viewer = r.params.find(([k]) => k === "viewer")?.[1];
      if (viewer !== undefined) expect(viewer).toBe("eq.spectator");
    }
    w.game.close();
  });

  it("answering does nothing", async () => {
    const w = watcher();
    await settle();
    const before = w.fake.requests.length;
    await w.game.answer({ kind: "pass" } as never);
    expect(w.fake.requests.length).toBe(before);
    w.game.close();
  });
});
