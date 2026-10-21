// SupabaseInviteStore's guards on the local Supabase stack: two joins of one code at once, a clash on save, an
// unknown code, and database errors, which throw without giving anything away and become storageFailed in O5a.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import type { Invite, InviteStore } from "./inviteStore.ts";
import { client, freshId } from "./migrations/localStack.ts";
import { SupabaseInviteStore } from "./supabaseInviteStore.ts";
import { shown, thrown } from "./test/errors.ts";
import { expectedStart, inviteStack, STACK_SEED } from "./test/inviteStack.ts";
import { leaksIn } from "./test/leaks.ts";
import { onLocalStack, storedRows, writeOf } from "./test/stack.ts";

const NOW = 1_700_000_000_000;
const NOTHING = { match: [], secret: [], views: [], events: [] };

/** Wraps an invite store so that no find returns until `count` finds have finished: every joiner sees it unused. */
function findTogether(inner: InviteStore, count: number): InviteStore {
  const waiting: (() => void)[] = [];
  return {
    save: (invite) => inner.save(invite),
    async find(code) {
      const found = await inner.find(code);
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
        if (waiting.length === count) for (const go of waiting.splice(0)) go();
      });
      return found;
    },
    accept: (code, joiner, write) => inner.accept(code, joiner, write),
  };
}

await onLocalStack("SupabaseInviteStore on the local Supabase stack: guards and errors", (keys) => {
  const stack = inviteStack(keys);
  const invite = (code = stack.code()): Invite => ({
    code,
    host: stack.host.id,
    sides: { mode: "random" },
    createdAt: NOW,
  });

  it("two joins of the same code, both finds done before either accept: one match is made and the other join gets inviteNotFound", async () => {
    const store = new SupabaseInviteStore(stack.service);
    const code = stack.code();
    expect(await store.save(invite(code))).toBe("saved");
    const deps = stack.deps("lio", findTogether(store, 2));
    const before = stack.matchIds.length;

    const results = await Promise.all(
      [stack.joiner, stack.third].map((user) => joinInvite(deps, { code, player: user.id, now: NOW + 1 })),
    );

    const winners = results.flatMap((r, i) => (r.ok ? [i] : []));
    expect(winners).toHaveLength(1);
    const winner = winners[0]!;
    expect(results[1 - winner]).toMatchObject({ ok: false, error: { code: "inviteNotFound" } });
    const ids = stack.matchIds.slice(before);
    expect(ids).toHaveLength(2);
    const won = results[winner]!;
    if (!won.ok) throw new Error("the winner was refused");
    const lost = ids.find((id) => id !== won.value.matchId)!;
    expect(await storedRows(stack.service, lost)).toEqual(NOTHING);
    expect((await storedRows(stack.service, won.value.matchId)).match).toHaveLength(1);
    const joiner = [stack.joiner, stack.third][winner]!.id;
    expect((await store.find(code))!.accepted).toEqual({ joiner, matchId: won.value.matchId });
  }, 60_000);

  it("saving an existing code, unused or used, reports a clash and changes nothing", async () => {
    const store = new SupabaseInviteStore(stack.service);
    const code = stack.code();
    expect(await store.save(invite(code))).toBe("saved");
    const other = { ...invite(code), host: stack.third.id, sides: { mode: "invitee" } } as const;
    expect(await store.save(other)).toBe("clash");
    expect(await store.find(code)).toEqual({ ...invite(code), accepted: null });

    const matchId = stack.matchId();
    const start = expectedStart(matchId, { lio: stack.host.id, sae: stack.joiner.id }, NOW);
    expect(await store.accept(code, stack.joiner.id, writeOf(start))).toBe("accepted");
    expect(await store.save(other)).toBe("clash");
    expect((await store.find(code))!.host).toBe(stack.host.id);
  }, 60_000);

  it("accept of an unknown code reports unavailable and writes no match row", async () => {
    const store = new SupabaseInviteStore(stack.service);
    const matchId = stack.matchId();
    const start = expectedStart(matchId, { lio: stack.host.id, sae: stack.joiner.id }, NOW);
    expect(await store.find(stack.code())).toBeNull();
    expect(await store.accept(stack.code(), stack.joiner.id, writeOf(start))).toBe("unavailable");
    expect(await storedRows(stack.service, matchId)).toEqual(NOTHING);
  }, 60_000);

  it("a client made with a wrong key makes save, find and accept throw showing no secret, seed, code or key, and O5a answers storageFailed", async () => {
    const good = new SupabaseInviteStore(stack.service);
    const code = stack.code();
    expect(await good.save(invite(code))).toBe("saved");
    const wrongKey = `wrong-${freshId()}`;
    const failing = new SupabaseInviteStore(client(keys.url, wrongKey));
    const matchId = stack.matchId();
    const start = expectedStart(matchId, { lio: stack.host.id, sae: stack.joiner.id }, NOW);

    for (const call of [
      () => failing.save(invite()),
      () => failing.find(code),
      () => failing.accept(code, stack.joiner.id, writeOf(start)),
    ]) {
      const failed = await thrown(call);
      expect(failed).toBeInstanceOf(Error);
      const text = shown(failed);
      expect(leaksIn(text, start.secret)).toEqual([]);
      for (const hidden of [STACK_SEED, code, wrongKey, keys.serviceKey, keys.anonKey])
        expect(text).not.toContain(hidden);
    }

    const storageFailed = { ok: false, error: { code: "storageFailed" } };
    const broken = stack.deps("lio", failing);
    expect(await createInvite(broken, { host: stack.host.id, sides: { mode: "random" }, now: NOW })).toMatchObject(
      storageFailed,
    );
    expect(await previewInvite(broken, code)).toMatchObject(storageFailed);
    expect(await joinInvite(broken, { code, player: stack.joiner.id, now: NOW })).toMatchObject(storageFailed);
    const acceptFails: InviteStore = {
      save: (i) => good.save(i),
      find: (c) => good.find(c),
      accept: (c, j, w) => failing.accept(c, j, w),
    };
    const before = stack.matchIds.length;
    const joined = await joinInvite(stack.deps("lio", acceptFails), { code, player: stack.joiner.id, now: NOW });
    expect(joined).toMatchObject(storageFailed);
    expect(await storedRows(stack.service, stack.matchIds[before]!)).toEqual(NOTHING);
    expect(await good.find(code)).toEqual({ ...invite(code), accepted: null });
  }, 60_000);
});
