// Whole games played through `submit` with a SupabaseStore on the local Supabase stack. After every step,
// `load` gives back what was committed and the readable rows are exactly O2's rows for that step.
// Without a running local stack, one test says so and how to start it.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchRecord } from "@terminal-dusk/host";
import { afterAll, beforeAll, expect, it } from "vitest";
import { client } from "./migrations/localStack.ts";
import { rowsFor } from "./rows.ts";
import type { MatchEventRow } from "./rows.ts";
import type { MatchWrite } from "./store.ts";
import { submit } from "./submit.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { bodyFor, nextSide, NOW, ruleset, SEED } from "./test/match.ts";
import { cleanUp, makeUser, newGame, onLocalStack, putIn, storedRows, writeOf } from "./test/stack.ts";
import type { TestUser } from "./test/stack.ts";
import { recording } from "./test/stores.ts";

const STEP_TIMEOUT = 120_000;

await onLocalStack("SupabaseStore on the local Supabase stack: whole games", (keys) => {
  let service: SupabaseClient;
  const users: TestUser[] = [];
  const matchIds: string[] = [];

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    users.push(await makeUser(keys, service, "lio"), await makeUser(keys, service, "sae"));
  }, 60_000);

  afterAll(async () => {
    await cleanUp(service, matchIds, users);
  }, 60_000);

  /** Checks one step: `load` gives back the committed record and secret, and the rows are O2's rows. */
  async function expectStored(write: MatchWrite, events: MatchEventRow[]): Promise<void> {
    const matchId = write.record.matchId;
    expect(await new SupabaseStore(service).load(matchId)).toEqual({ record: write.record, secret: write.secret });
    const rows = rowsFor(write);
    events.push(...rows.events);
    const stored = await storedRows(service, matchId);
    expect(stored.match).toEqual([rows.match]);
    expect(stored.views).toEqual(rows.views);
    expect(stored.events).toEqual(events);
    expect(stored.secret).toHaveLength(1);
  }

  /** Puts in a new game, then plays it through `submit`; LIO resigns once `resignAfter` answers are made. */
  async function play(resignAfter?: number): Promise<{ record: MatchRecord; steps: number }> {
    const start = newGame({ lio: users[0]!.id, sae: users[1]!.id });
    const matchId = start.record.matchId;
    matchIds.push(matchId);
    await putIn(service, writeOf(start));
    const events: MatchEventRow[] = [];
    await expectStored(writeOf(start), events);

    const { store, saved } = recording(new SupabaseStore(service));
    const deps = { store, ruleset: (id: string) => (id === ruleset.id ? ruleset : undefined) };
    let now = NOW;
    for (let answers = 0; ; answers++) {
      const loaded = (await store.load(matchId))!;
      if (loaded.record.status.kind !== "active") return { record: loaded.record, steps: saved.length };
      const resign = resignAfter !== undefined && answers >= resignAfter;
      const side = nextSide(loaded.secret);
      const body = resign ? { resign: true } : bodyFor(loaded.record.seq, loaded.secret, side);
      const player = resign ? loaded.record.players.lio : loaded.record.players[side];
      const result = await submit(deps, { matchId, player, body, now: ++now });
      if (!result.ok) throw new Error(`submit refused: ${result.error.code}`);
      expect(saved).toHaveLength(answers + 1);
      expect(result.value.seq).toBe(saved.at(-1)!.record.seq);
      await expectStored(saved.at(-1)!, events);
    }
  }

  it(
    "a game put in at seq 0 and played to the end through submit is stored exactly after every step",
    async () => {
      const { record, steps } = await play();
      expect(steps).toBeGreaterThan(2);
      expect(record.status.kind).not.toBe("active");
      expect(record.seed).toBe(SEED);
    },
    STEP_TIMEOUT,
  );

  it(
    "a second game that ends by resignation is stored exactly after every step",
    async () => {
      const { record, steps } = await play(1);
      expect(steps).toBe(2);
      expect(record.status.kind).not.toBe("active");
      expect(record.seed).toBe(SEED);
    },
    STEP_TIMEOUT,
  );
});
