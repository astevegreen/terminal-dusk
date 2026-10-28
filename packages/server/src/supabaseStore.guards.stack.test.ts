// SupabaseStore's guards on the local Supabase stack: the seq check in the commit_match SQL function,
// unknown matches, a missing secret row and database errors, which reject without giving anything away.
// Without a running local stack, one test says so and how to start it.
import type { HostResult } from "@terminal-dusk/host";
import { expect, it } from "vitest";
import { client, freshId } from "./migrations/localStack.ts";
import { rowsFor } from "./rows.ts";
import type { MatchWrite } from "./store.ts";
import { submit } from "./submit.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { shown, thrown } from "./test/errors.ts";
import { leaksIn } from "@terminal-dusk/host/test/secret-leaks";
import { bodyFor, NOW, ruleset } from "./test/match.ts";
import { freshMatchId, onLocalStack, storedRows, writeOf } from "./test/stack.ts";
import { answered, expectStoredAs, stackGame } from "./test/stackGame.ts";
import { loadTogether } from "./test/stores.ts";

await onLocalStack("SupabaseStore on the local Supabase stack: guards and errors", (keys) => {
  const game = stackGame(keys);
  const deps = (store: SupabaseStore | ReturnType<typeof loadTogether>) => ({
    store,
    ruleset: (id: string) => (id === ruleset.id ? ruleset : undefined),
  });

  /** The write the host makes for LIO's legal answer number `pick` at seq 0. */
  const nextWrite = (start: HostResult, pick = 0): MatchWrite =>
    writeOf(answered(start, game.users[0]!.id, bodyFor(0, start.secret, "lio", pick)));

  /** The thrown error shows the match id but no secret, seed or service key. */
  function expectNothingShown(error: unknown, start: HostResult): void {
    expect(error).toBeInstanceOf(Error);
    const text = shown(error);
    expect(text).toContain(start.record.matchId);
    expect(leaksIn(text, start.secret)).toEqual([]);
    expect(text).not.toContain(keys.serviceKey);
  }

  it("two answers for the same seq sent at once give one success and one staleSeq from the SQL seq check, and the winner's rows are stored", async () => {
    const start = await game.stored();
    const matchId = start.record.matchId;
    const lio = game.users[0]!.id;
    const racing = deps(loadTogether(new SupabaseStore(game.service), 2));
    const bodies = [bodyFor(0, start.secret, "lio", 0), bodyFor(0, start.secret, "lio", 1)];
    expect(bodies[0]).not.toEqual(bodies[1]);

    const results = await Promise.all(
      bodies.map((body, i) => submit(racing, { matchId, player: lio, body, now: NOW + 1 + i })),
    );

    const winners = results.flatMap((r, i) => (r.ok ? [i] : []));
    expect(winners).toHaveLength(1);
    const winner = winners[0]!;
    expect(results[1 - winner]).toMatchObject({ ok: false, error: { code: "staleSeq" } });
    const write = writeOf(answered(start, lio, bodies[winner]!, NOW + 1 + winner));
    await expectStoredAs(game.service, write, rowsFor(writeOf(start)).events);
  }, 60_000);

  it("a commit with the wrong expected seq gives conflict and changes no row in any of the four tables", async () => {
    const start = await game.stored();
    const before = await storedRows(game.service, start.record.matchId);
    const store = new SupabaseStore(game.service);
    for (const wrong of [1, 5, -1])
      expect(await store.commit(start.record.matchId, wrong, nextWrite(start))).toBe("conflict");
    expect(await storedRows(game.service, start.record.matchId)).toEqual(before);
  }, 60_000);

  it("load of an unknown match gives null, and commit for it gives conflict and writes nothing", async () => {
    const unknown = freshMatchId();
    game.matchIds.push(unknown);
    const store = new SupabaseStore(game.service);
    expect(await store.load(unknown)).toBeNull();
    const write = writeOf(game.fresh());
    expect(await store.commit(unknown, 0, write)).toBe("conflict");
    expect(await storedRows(game.service, unknown)).toEqual({ match: [], secret: [], views: [], events: [] });
  }, 60_000);

  it("a match row whose secret row is missing makes load throw, showing nothing secret", async () => {
    const start = game.fresh();
    const { error } = await game.service.from("match").insert(rowsFor(writeOf(start)).match);
    expect(error).toBeNull();
    const failed = await thrown(() => new SupabaseStore(game.service).load(start.record.matchId));
    expectNothingShown(failed, start);
  }, 60_000);

  it("a client made with a wrong key makes load and commit reject, showing no secret, seed or key", async () => {
    const start = await game.stored();
    const before = await storedRows(game.service, start.record.matchId);
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
    expect(await storedRows(game.service, start.record.matchId)).toEqual(before);
  }, 60_000);

  it("a malformed row makes commit reject, writes nothing, and shows no secret, seed or key", async () => {
    const start = await game.stored();
    const before = await storedRows(game.service, start.record.matchId);
    const good = nextWrite(start);
    const malformed: MatchWrite = {
      ...good,
      record: { ...good.record, players: { ...good.record.players, lio: "not-a-user-id" } },
    };
    const failed = await thrown(() => new SupabaseStore(game.service).commit(start.record.matchId, 0, malformed));
    expectNothingShown(failed, start);
    expect(await storedRows(game.service, start.record.matchId)).toEqual(before);
  }, 60_000);
});
