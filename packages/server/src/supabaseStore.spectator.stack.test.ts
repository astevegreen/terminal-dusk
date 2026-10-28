// What a signed-out watcher (O14, #454) can read from the local Supabase stack under real row-level security:
// after every step of a whole game, only the spectator frame and events, never a hand, the deck, the seed or the
// move log, and nothing at all from match_secret.
import { createClient } from "@supabase/supabase-js";
import { leaksFor } from "@terminal-dusk/host/test/secret-leaks";
import { expect, it } from "vitest";
import { rowsFor } from "./rows.ts";
import type { MatchWrite } from "./store.ts";
import { submit } from "./submit.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { bodyFor, nextSide, NOW, ruleset } from "./test/match.ts";
import { onLocalStack, writeOf } from "./test/stack.ts";
import { stackGame } from "./test/stackGame.ts";
import { recording } from "./test/stores.ts";

const GAME_TIMEOUT = 120_000;

await onLocalStack("a signed-out watcher on the local Supabase stack", (keys) => {
  const game = stackGame(keys);
  // The anon key and no session: what a watch link's page sends.
  const watcher = createClient(keys.url, keys.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  /** Reads every table as the watcher and checks it got the spectator rows of `write` and nothing else. */
  async function expectOnlyPublic(write: MatchWrite): Promise<void> {
    const matchId = write.record.matchId;
    const expected = rowsFor(write);
    const read = async (table: string) => {
      const { data, error } = await watcher.from(table).select("*").eq("match_id", matchId);
      if (error) throw new Error(`the watcher could not read ${table}: ${error.code}`);
      return data;
    };
    const match = await read("match");
    const views = (await read("match_view")) as { viewer: string; frame: unknown; seq: number }[];
    const events = (await read("match_event")) as { viewer: string; seq: number; events: unknown }[];
    const secret = await read("match_secret").catch(() => []);

    expect(match).toHaveLength(1);
    expect(views.map((v) => v.viewer)).toEqual(["spectator"]);
    expect(views[0]!.frame).toEqual(expected.views.find((v) => v.viewer === "spectator")!.frame);
    expect(events.every((e) => e.viewer === "spectator")).toBe(true);
    expect(secret).toEqual([]);

    // Nothing the watcher was given holds a hand, the deck, the seed, the generator state or the move log.
    const text = JSON.stringify({ match, views, events });
    expect(leaksFor(text, write.secret, "spectator")).toEqual([]);
    if (write.secret.log.length > 0) expect(text).not.toContain(JSON.stringify(write.secret.log));
  }

  it(
    "after every step of a whole game, reads only the spectator frame and events and nothing from match_secret",
    async () => {
      const start = await game.stored();
      const matchId = start.record.matchId;
      await expectOnlyPublic(writeOf(start));

      const { store, saved } = recording(new SupabaseStore(game.service));
      const deps = { store, ruleset: (id: string) => (id === ruleset.id ? ruleset : undefined) };
      let now = NOW;
      let steps = 0;
      for (;;) {
        const loaded = (await store.load(matchId))!;
        if (loaded.record.status.kind !== "active") break;
        const side = nextSide(loaded.secret);
        const result = await submit(deps, {
          matchId,
          player: loaded.record.players[side],
          body: bodyFor(loaded.record.seq, loaded.secret, side),
          now: ++now,
        });
        if (!result.ok) throw new Error(`submit refused: ${result.error.code}`);
        await expectOnlyPublic(saved.at(-1)!);
        steps++;
      }
      expect(steps).toBeGreaterThan(2);
    },
    GAME_TIMEOUT,
  );

  it("cannot write: an insert, update or delete as the watcher is refused", async () => {
    const start = await game.stored();
    const matchId = start.record.matchId;
    const inserted = await watcher.from("match_view").insert({ match_id: matchId, viewer: "lio", seq: 9, frame: {} });
    expect(inserted.error).not.toBeNull();
    await watcher.from("match_view").update({ seq: 9 }).eq("match_id", matchId);
    await watcher.from("match").delete().eq("match_id", matchId);
    const after = await game.service.from("match_view").select("seq").eq("match_id", matchId);
    expect(after.data!.every((row) => row.seq === 0)).toBe(true);
    expect((await game.service.from("match").select("match_id").eq("match_id", matchId)).data).toHaveLength(1);
  });
});
