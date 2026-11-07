// The invite path queues turn alerts on the local Supabase stack. A joined invite makes a match that waits for its
// players, and the invite Edge Function's deps (`inviteFunctionDeps`, what supabase/functions/invite serves with)
// must queue their turn alerts in notify_queue, or no player of an invited game is ever emailed.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { inviteFunctionDeps } from "./functionDeps.ts";
import { createInvite, joinInvite } from "./invite.ts";
import { alertsFrom } from "./notifyStore.ts";
import { inviteStack, STACK_SEED } from "./test/inviteStack.ts";
import { onLocalStack } from "./test/stack.ts";

// Far from the other stack tests' times.
const NOW = 7_000_000_000_000;

await onLocalStack("the invite path queues turn alerts on the local Supabase stack", (keys) => {
  const stack = inviteStack(keys);

  it("joining an invite with the invite function's deps queues the new match's turn alerts", async () => {
    const deps = inviteFunctionDeps(stack.service, {
      now: () => NOW,
      random: { matchId: () => stack.matchId(), seed: () => STACK_SEED, randomHostSide: () => "lio" },
    });
    const created = await createInvite(deps, {
      host: stack.host.id,
      sides: { mode: "random" },
      platform: "web",
      now: NOW,
    });
    if (!created.ok) throw new Error(`createInvite refused: ${created.error.code}`);
    stack.codes.push(created.value.code);

    const joined = await joinInvite(deps, { code: created.value.code, player: stack.joiner.id, now: NOW });
    if (!joined.ok) throw new Error(`joinInvite refused: ${joined.error.code}`);
    const { matchId, effects } = joined.value;

    const expected = alertsFrom(matchId, 0, effects, NOW);
    expect(expected.length).toBeGreaterThan(0);
    const { data, error } = await stack.service
      .from("notify_queue")
      .select("player, seq, queued_at")
      .eq("match_id", matchId);
    expect(error).toBeNull();
    const queued = (data as { player: string; seq: number; queued_at: number }[]).map((row) => ({
      player: row.player,
      seq: Number(row.seq),
      queuedAt: Number(row.queued_at),
    }));
    expect(queued.toSorted((a, b) => a.player.localeCompare(b.player))).toEqual(
      expected
        .map((alert) => ({ player: alert.player, seq: alert.seq, queuedAt: alert.queuedAt }))
        .toSorted((a, b) => a.player.localeCompare(b.player)),
    );
  }, 60_000);
});
