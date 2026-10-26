// The accept_invite clock migration (supabase/migrations/20261028000000_accept_invite_clock.sql). The text checks
// always run; the rest run on the local Supabase stack, where `pnpm test:migrations` applies every migration to an
// empty database first. They prove accept_invite now stores the match's clock and next deadline (or null for both)
// and that everything else it does, and who may run it, is unchanged.
// Without a running local stack, one test says so and how to start it.
import { describe, expect, it } from "vitest";
import INVITE_MIGRATION from "../../supabase/migrations/20261022000000_match_invite.sql?raw";
import CLOCK_MIGRATION from "../../supabase/migrations/20261028000000_accept_invite_clock.sql?raw";
import { rowsFor } from "../rows.ts";
import { createdWithClock, DAY } from "../test/deadlines.ts";
import { expectedStart, inviteStack } from "../test/inviteStack.ts";
import { onLocalStack, storedRows, writeOf } from "../test/stack.ts";
import type { HostResult } from "@terminal-dusk/host";

const NOW = 1_700_000_000_000;
const SIGNATURE = "public.accept_invite(text, uuid, jsonb, jsonb, jsonb, jsonb)";

/** The function's body, between `as $$` and `$$;`. */
const bodyOf = (sql: string): string => {
  const start = sql.indexOf("as $$");
  const end = sql.indexOf("$$;", start + 5);
  if (start < 0 || end < 0) throw new Error("no function body found");
  return sql.slice(start, end);
};
/** The body without its `insert into public.match (...) values (...);` statement, spacing made even. */
const withoutMatchInsert = (body: string): string =>
  body
    .replace(/insert into public\.match \([^)]*\)\s*values \([^)]*\);/, "")
    .replace(/\s+/g, " ")
    .trim();

describe("the accept_invite clock migration's text", () => {
  it("replaces public.accept_invite with the same signature", () => {
    expect(CLOCK_MIGRATION).toMatch(
      /create or replace function public\.accept_invite\(\s*p_code text,\s*p_joiner uuid,\s*p_match jsonb,\s*p_secret jsonb,\s*p_views jsonb,\s*p_events jsonb\s*\)\s*returns text/,
    );
  });

  it("the inserted match row also takes clock and next_deadline from p_match", () => {
    const insert = /insert into public\.match \(([^)]*)\)\s*values \(([^)]*)\);/.exec(CLOCK_MIGRATION);
    expect(insert).not.toBeNull();
    const columns = insert![1]!.split(",").map((c) => c.trim());
    const values = insert![2]!.split(",").map((v) => v.trim());
    expect(columns.slice(-2)).toEqual(["clock", "next_deadline"]);
    expect(values).toEqual(columns.map((c) => `m.${c}`));
  });

  it("everything else accept_invite does is unchanged from the match_invite migration", () => {
    expect(withoutMatchInsert(bodyOf(CLOCK_MIGRATION))).toBe(withoutMatchInsert(bodyOf(INVITE_MIGRATION)));
    const header = (sql: string) =>
      /returns text\s+language plpgsql\s+security invoker\s+set search_path = ''/.test(sql);
    expect(header(CLOCK_MIGRATION)).toBe(true);
  });

  it("keeps execute revoked from public, anon and authenticated and granted only to service_role", () => {
    expect(CLOCK_MIGRATION).toContain(`revoke execute on function ${SIGNATURE} from public, anon, authenticated;`);
    expect(CLOCK_MIGRATION).toContain(`grant execute on function ${SIGNATURE} to service_role;`);
    expect(CLOCK_MIGRATION.match(/\bgrant\b/gi)).toHaveLength(1);
    expect(CLOCK_MIGRATION).not.toMatch(/create policy/i);
  });
});

await onLocalStack("accept_invite clock migration on the local Supabase stack", (keys) => {
  const stack = inviteStack(keys);

  /** Saves a fresh unused invite with the service role and runs accept_invite for the joiner with `made`. */
  const accept = async (made: HostResult) => {
    const code = stack.code();
    const invite = { code, host_id: stack.host.id, mode: "random", created_at: NOW };
    expect((await stack.service.from("match_invite").insert(invite)).error).toBeNull();
    const rows = rowsFor(writeOf(made));
    return stack.service.rpc("accept_invite", {
      p_code: code,
      p_joiner: stack.joiner.id,
      p_match: rows.match,
      p_secret: made.secret,
      p_views: rows.views,
      p_events: rows.events,
    });
  };

  it("stores the clock and next deadline p_match carries", async () => {
    const matchId = stack.matchId();
    const made = createdWithClock(matchId, "lossOnTime", NOW, { lio: stack.host.id, sae: stack.joiner.id });
    expect(made.record.clock).toBeDefined();
    const answer = await accept(made);
    expect(answer.error).toBeNull();
    expect(answer.data).toBe("accepted");

    const stored = await storedRows(stack.service, matchId);
    expect(stored.match).toHaveLength(1);
    expect(stored.match[0]!.clock).toEqual(made.record.clock);
    expect(stored.match[0]!.next_deadline).toBe(NOW + DAY);
  }, 60_000);

  it("stores both as null when p_match has clock null and next_deadline null", async () => {
    const matchId = stack.matchId();
    const made = expectedStart(matchId, { lio: stack.host.id, sae: stack.joiner.id }, NOW);
    expect(rowsFor(writeOf(made)).match).toMatchObject({ clock: null, next_deadline: null });
    const answer = await accept(made);
    expect(answer.error).toBeNull();
    expect(answer.data).toBe("accepted");

    const stored = await storedRows(stack.service, matchId);
    expect(stored.match).toHaveLength(1);
    expect(stored.match[0]!.clock).toBeNull();
    expect(stored.match[0]!.next_deadline).toBeNull();
  }, 60_000);
});
