// SupabaseStore's guards on the local Supabase stack: the seq check in the commit_match SQL function,
// unknown matches, a missing secret row and database errors, which reject without giving anything away.
// Without a running local stack, one test says so and how to start it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hostSubmit } from "@terminal-dusk/host";
import type { HostResult } from "@terminal-dusk/host";
import { afterAll, beforeAll, expect, it } from "vitest";
import { client, freshId } from "./migrations/localStack.ts";
import { rowsFor } from "./rows.ts";
import type { MatchWrite } from "./store.ts";
import { submit } from "./submit.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { shown, thrown } from "./test/errors.ts";
import { leaksIn } from "./test/leaks.ts";
import { bodyFor, NOW, ruleset } from "./test/match.ts";
import { cleanUp, freshMatchId, makeUser, newGame, onLocalStack, putIn, storedRows, writeOf } from "./test/stack.ts";
import type { TestUser } from "./test/stack.ts";
import { loadTogether } from "./test/stores.ts";

await onLocalStack("SupabaseStore on the local Supabase stack: guards and errors", (keys) => {
  let service: SupabaseClient;
  const users: TestUser[] = [];
  const matchIds: string[] = [];
  const deps = (store: SupabaseStore | ReturnType<typeof loadTogether>) => ({
    store,
    ruleset: (id: string) => (id === ruleset.id ? ruleset : undefined),
  });

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    users.push(await makeUser(keys, service, "lio"), await makeUser(keys, service, "sae"));
  }, 60_000);

  afterAll(async () => {
    await cleanUp(service, matchIds, users);
  }, 60_000);

  /** A new game put in at seq 0 with the service role. */
  async function stored(): Promise<HostResult> {
    const start = newGame({ lio: users[0]!.id, sae: users[1]!.id });
    matchIds.push(start.record.matchId);
    await putIn(service, writeOf(start));
    return start;
  }

  /** The write the host makes for LIO's legal answer number `pick` at seq 0. */
  function nextWrite(start: HostResult, pick = 0): MatchWrite {
    const body = bodyFor(0, start.secret, "lio", pick);
    const next = hostSubmit(ruleset, start.record, start.secret, { player: users[0]!.id, ...body } as never, NOW + 1);
    if (!next.ok) throw new Error(`the host refused the answer: ${next.error.code}`);
    return writeOf(next.value);
  }

  /** The thrown error shows the match id but no secret, seed or service key. */
  function expectNothingShown(error: unknown, start: HostResult): void {
    expect(error).toBeInstanceOf(Error);
    const text = shown(error);
    expect(text).toContain(start.record.matchId);
    expect(leaksIn(text, start.secret)).toEqual([]);
    expect(text).not.toContain(keys.serviceKey);
  }

  it("two answers for the same seq sent at once give one success and one staleSeq from the SQL seq check, and the winner's rows are stored", async () => {
    const start = await stored();
    const matchId = start.record.matchId;
    const racing = deps(loadTogether(new SupabaseStore(service), 2));
    const bodies = [bodyFor(0, start.secret, "lio", 0), bodyFor(0, start.secret, "lio", 1)];
    expect(bodies[0]).not.toEqual(bodies[1]);

    const results = await Promise.all(
      bodies.map((body, i) => submit(racing, { matchId, player: users[0]!.id, body, now: NOW + 1 + i })),
    );

    const winners = results.flatMap((r, i) => (r.ok ? [i] : []));
    expect(winners).toHaveLength(1);
    const winner = winners[0]!;
    expect(results[1 - winner]).toMatchObject({ ok: false, error: { code: "staleSeq" } });
    const won = hostSubmit(
      ruleset,
      start.record,
      start.secret,
      { player: users[0]!.id, ...bodies[winner] } as never,
      NOW + 1 + winner,
    );
    if (!won.ok) throw new Error("the host refused the winner's answer");
    const write = writeOf(won.value);
    expect(await new SupabaseStore(service).load(matchId)).toEqual({ record: write.record, secret: write.secret });
    const rows = rowsFor(write);
    const after = await storedRows(service, matchId);
    expect(after.match).toEqual([rows.match]);
    expect(after.views).toEqual(rows.views);
    expect(after.events).toEqual([...rowsFor(writeOf(start)).events, ...rows.events]);
  }, 60_000);

  it("a commit with the wrong expected seq gives conflict and changes no row in any of the four tables", async () => {
    const start = await stored();
    const before = await storedRows(service, start.record.matchId);
    const store = new SupabaseStore(service);
    for (const wrong of [1, 5, -1])
      expect(await store.commit(start.record.matchId, wrong, nextWrite(start))).toBe("conflict");
    expect(await storedRows(service, start.record.matchId)).toEqual(before);
  }, 60_000);

  it("load of an unknown match gives null, and commit for it gives conflict and writes nothing", async () => {
    const unknown = freshMatchId();
    matchIds.push(unknown);
    const store = new SupabaseStore(service);
    expect(await store.load(unknown)).toBeNull();
    const write = writeOf(newGame({ lio: users[0]!.id, sae: users[1]!.id }));
    expect(await store.commit(unknown, 0, write)).toBe("conflict");
    expect(await storedRows(service, unknown)).toEqual({ match: [], secret: [], views: [], events: [] });
  }, 60_000);

  it("a match row whose secret row is missing makes load throw, showing nothing secret", async () => {
    const start = newGame({ lio: users[0]!.id, sae: users[1]!.id });
    matchIds.push(start.record.matchId);
    const { error } = await service.from("match").insert(rowsFor(writeOf(start)).match);
    expect(error).toBeNull();
    const failed = await thrown(() => new SupabaseStore(service).load(start.record.matchId));
    expectNothingShown(failed, start);
  }, 60_000);

  it("a client made with a wrong key makes load and commit reject, showing no secret, seed or key", async () => {
    const start = await stored();
    const before = await storedRows(service, start.record.matchId);
    const wrongKey = `wrong-${freshId()}`;
    const store = new SupabaseStore(client(keys.url, wrongKey));
    for (const call of [
      () => store.load(start.record.matchId),
      () => store.commit(start.record.matchId, 0, nextWrite(start)),
    ]) {
      const failed = await thrown(call);
      expectNothingShown(failed, start);
      expect(shown(failed)).not.toContain(wrongKey);
    }
    expect(await storedRows(service, start.record.matchId)).toEqual(before);
  }, 60_000);

  it("a malformed row makes commit reject, writes nothing, and shows no secret, seed or key", async () => {
    const start = await stored();
    const before = await storedRows(service, start.record.matchId);
    const good = nextWrite(start);
    const malformed: MatchWrite = {
      ...good,
      record: { ...good.record, players: { ...good.record.players, lio: "not-a-user-id" } },
    };
    const failed = await thrown(() => new SupabaseStore(service).commit(start.record.matchId, 0, malformed));
    expectNothingShown(failed, start);
    expect(await storedRows(service, start.record.matchId)).toEqual(before);
  }, 60_000);
});
