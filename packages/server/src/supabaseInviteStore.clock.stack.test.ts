// SupabaseInviteStore.accept and the deadline clock on the local Supabase stack: a match made from an invite keeps
// the clock it was given, so SupabaseStore.load gives it back and `due` finds it once its deadline has passed. A
// match joined through joinInvite today (no deadline in its config) still has no clock and no next deadline.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { createInvite, joinInvite } from "./invite.ts";
import { SupabaseInviteStore } from "./supabaseInviteStore.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { createdWithClock, DAY } from "./test/deadlines.ts";
import { inviteStack } from "./test/inviteStack.ts";
import { onLocalStack, storedRows, writeOf } from "./test/stack.ts";

// Far from the other stack tests' times, so their matches are never due in these checks.
const AT = 5_000_000_000_000;

await onLocalStack("SupabaseInviteStore on the local Supabase stack: the deadline clock", (keys) => {
  const stack = inviteStack(keys);

  it("accept then load gives back the clock given to accept, and due finds the match once its deadline has passed", async () => {
    const invites = new SupabaseInviteStore(stack.service);
    const store = new SupabaseStore(stack.service);
    const code = stack.code();
    expect(await invites.save({ code, host: stack.host.id, sides: { mode: "random" }, createdAt: AT })).toBe("saved");
    const matchId = stack.matchId();
    const made = createdWithClock(matchId, "lossOnTime", AT, { lio: stack.host.id, sae: stack.joiner.id });
    expect(made.record.clock).toBeDefined();

    expect(await invites.accept(code, stack.joiner.id, writeOf(made))).toBe("accepted");

    const loaded = await store.load(matchId);
    expect(loaded!.record.clock).toEqual(made.record.clock);
    expect(loaded!.record).toEqual(made.record);
    expect(await store.due(AT + DAY - 1)).not.toContain(matchId);
    expect(await store.due(AT + DAY)).toContain(matchId);
  }, 60_000);

  it("a match joined through joinInvite (no deadline in its config) still has clock and next_deadline null", async () => {
    const deps = stack.deps();
    const made = await createInvite(deps, { host: stack.host.id, sides: { mode: "random" }, platform: "web", now: AT });
    if (!made.ok) throw new Error(`createInvite was refused: ${made.error.code}`);
    const joined = await joinInvite(deps, { code: made.value.code, player: stack.joiner.id, now: AT + 1 });
    if (!joined.ok) throw new Error(`joinInvite was refused: ${joined.error.code}`);

    const stored = await storedRows(stack.service, joined.value.matchId);
    expect(stored.match).toHaveLength(1);
    expect(stored.match[0]!.clock).toBeNull();
    expect(stored.match[0]!.next_deadline).toBeNull();
    const loaded = await new SupabaseStore(stack.service).load(joined.value.matchId);
    expect("clock" in loaded!.record).toBe(false);
  }, 60_000);
});
