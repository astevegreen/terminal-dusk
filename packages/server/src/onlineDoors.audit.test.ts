// #687, "audit first": every server path that creates an online match, or joins a ranked one, must ask the host
// whether the player owns the Full Game. DOORS lists those paths. The audit reads the server's source and
// migrations and fails when it finds a place that makes a match and no door covers it; each door is then tried as
// a free player. A new path (#681's ranked join) is added as one more door, kind "ranked".
import { createOnlineRefusal, joinRankedRefusal } from "@terminal-dusk/host";
import type { Entitlement, Platform } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { createInvite } from "./invite.ts";
import { handleInvite } from "./inviteHandler.ts";
import { post } from "./test/handler.ts";
import { body, inviteHandlerWorld } from "./test/inviteHandler.ts";
import { INVITE_NOW, inviteWorld, JOINER } from "./test/invites.ts";
import { findMatchMakers, isRankedMarker, type Sources } from "./test/matchMakers.ts";

/** What trying a door gave: the refusal (null when let through) and whether a game was opened or made. */
type Tried = { refusal: { code: string; message?: string | undefined } | null; stored: boolean };

type Door = {
  name: string;
  kind: "create" | "ranked";
  /** The finder's markers that sit behind this door's check. */
  covers: string[];
  /** Tries the door as a signed-in player who holds `entitlements` and says the app is on `platform`. */
  tryAs(entitlements: Entitlement[], platform: Platform): Promise<Tried>;
};

/** The host rule each kind of door must answer with. */
const RULES = { create: createOnlineRefusal, ranked: joinRankedRefusal };

const DOORS: Door[] = [
  {
    // The one way to an online match today: the invite is the checked step, and joining it makes the match.
    name: "createInvite (a private game)",
    kind: "create",
    covers: [
      "sql: function accept_invite writes new match rows",
      "src/invite.ts: calls invites.accept",
      "src/invite.ts: calls invites.save",
      "src/invite.ts: imports hostCreate",
      "src/supabaseInviteStore.ts: calls accept_invite",
      "src/supabaseInviteStore.ts: writes new match_invite rows",
    ],
    async tryAs(entitlements, platform) {
      const world = inviteWorld();
      for (const owned of entitlements) await world.entitlements.grant(JOINER, owned);
      const request = { host: JOINER, sides: { mode: "random" as const }, platform, now: INVITE_NOW };
      const made = await createInvite(world.deps, request);
      return { refusal: made.ok ? null : made.error, stored: (await world.invites.find("CODE0001")) !== null };
    },
  },
  {
    name: 'the invite Edge Function\'s "create"',
    kind: "create",
    covers: [],
    async tryAs(entitlements, platform) {
      const { deps, world } = inviteHandlerWorld();
      for (const owned of entitlements) await world.entitlements.grant(JOINER, owned);
      const request = post("token-joiner", { action: "create", sides: { mode: "random" }, platform });
      const reply = body(await handleInvite(deps, request)) as { error?: Tried["refusal"] };
      return { refusal: reply.error ?? null, stored: (await world.invites.find("CODE0001")) !== null };
    },
  },
];

/** The server's own code and SQL, as text. Tests and test helpers are not server paths. */
function serverSources(): Sources {
  const files = import.meta.glob(["./**/*.ts", "../supabase/functions/**/*.ts", "../supabase/**/*.sql"], {
    query: "?raw",
    import: "default",
    eager: true,
  });
  const entries = Object.entries(files)
    .map(([path, text]) => [path.replace(/^\.\//, "src/").replace(/^\.\.\//, ""), text] as const)
    .filter(([path]) => !path.endsWith(".test.ts") && !path.endsWith(".d.ts") && !path.startsWith("src/test/"));
  return Object.fromEntries(entries);
}

const covered = (kind: Door["kind"]): string[] =>
  DOORS.filter((door) => door.kind === kind)
    .flatMap((door) => door.covers)
    .sort();

describe("audit: every server path to an online match has an entitlement check", () => {
  const sources = serverSources();
  const found = findMatchMakers(sources);

  it("reads the migrations, the Edge Functions and the server source", () => {
    const read = Object.keys(sources);
    expect(read).toContain("src/invite.ts");
    expect(read).toContain("supabase/functions/invite/index.ts");
    expect(read).toContain("supabase/migrations/20261028000000_accept_invite_clock.sql");
  });

  it("every place that makes an online match is behind a create door", () => {
    expect(found.filter((marker) => !isRankedMarker(marker))).toEqual(covered("create"));
  });

  it("every ranked-join path is behind a ranked door (there is none until #681)", () => {
    expect(found.filter(isRankedMarker)).toEqual(covered("ranked"));
  });

  for (const door of DOORS) {
    describe(door.name, () => {
      const rule = RULES[door.kind];

      it("refuses a free player with the host's refusal, and nothing is stored", async () => {
        const tried = await door.tryAs([], "web");
        expect(tried).toEqual({ refusal: rule([], "web"), stored: false });
        expect(tried.refusal?.code).toBe("notEntitled");
      });

      it("refuses a player who owns the Full Game only on another platform", async () => {
        const tried = await door.tryAs([{ platform: "steam", source: "test" }], "web");
        expect(tried.refusal?.code).toBe("notEntitled");
        expect(tried.stored).toBe(false);
      });

      it("lets through a player who owns it on the platform played on", async () => {
        const tried = await door.tryAs([{ platform: "web", source: "test" }], "web");
        expect(tried).toEqual({ refusal: null, stored: true });
      });
    });
  }
});

describe("audit: the finder reports a new path that nothing covers", () => {
  const insert = (table: string) => `insert into public.${table} (match_id) values ('m');`;
  const sqlFunction = (name: string, text: string) =>
    `create or replace function public.${name}() returns void language plpgsql as $$ begin ${text} end; $$;`;

  it("a new SQL function that writes a match, and the code that calls it", () => {
    const sources = {
      "supabase/migrations/new.sql": sqlFunction("pair_players", insert("match")),
      "src/pair.ts": 'await db.rpc("pair_players", {});',
    };
    expect(findMatchMakers(sources)).toEqual([
      "sql: function pair_players writes new match rows",
      "src/pair.ts: calls pair_players",
    ]);
  });

  it("a direct write, a new hostCreate caller, and an invite saved from somewhere else", () => {
    const sources = {
      "src/quick.ts": [
        'import { hostCreate } from "@terminal-dusk/host";',
        'await db\n  .from("match")\n  .upsert(row);',
        "await deps.invites.save(invite);",
      ].join("\n"),
      "supabase/seed.sql": insert("match_invite"),
    };
    expect(findMatchMakers(sources)).toEqual([
      "src/quick.ts: calls invites.save",
      "src/quick.ts: imports hostCreate",
      "src/quick.ts: writes new match rows",
      "supabase/seed.sql: writes new match_invite rows outside a function",
    ]);
  });

  it("ranked or matchmaking code, in TypeScript or SQL", () => {
    const sources = {
      "src/seek.ts": "export const seek = () => 1;",
      "supabase/migrations/queue.sql": "create table public.ranked_queue (player uuid);",
    };
    expect(findMatchMakers(sources)).toEqual([
      "src/seek.ts: ranked or matchmaking code",
      "supabase/migrations/queue.sql: ranked or matchmaking code",
    ]);
  });

  it("not comments, reads, updates or other tables", () => {
    const sources = {
      "src/notes.ts": [
        '// hostCreate makes it; db.from("match").insert(row) would too, for a ranked game.',
        '/* await deps.invites.save(invite); import { hostCreate } from "x"; */',
        'await db.from("match").update(row); await db.from("match_view").insert(row);',
      ].join("\n"),
      "supabase/migrations/old.sql": `-- insert into public.match, one day ranked\n${insert("match_view")}`,
    };
    expect(findMatchMakers(sources)).toEqual([]);
  });
});

describe("the check never reaches a free player who is invited (#687)", () => {
  it("a free player joins a private game by its invite code, and the match is made", async () => {
    const { deps, world } = inviteHandlerWorld();
    expect(await world.entitlements.forPlayer(JOINER)).toEqual([]);
    const create = { action: "create", sides: { mode: "host", hostSide: "lio" }, platform: "web" };
    const { code } = body(await handleInvite(deps, post("token-host", create))) as { code: string };
    const joined = await handleInvite(deps, post("token-joiner", { action: "join", code }));
    expect(joined.status).toBe(200);
    expect(body(joined)).toEqual({ ok: true, matchId: "match-1", side: "sae" });
    expect(world.matches.stored("match-1")?.record.players.sae).toBe(JOINER);
  });
});
