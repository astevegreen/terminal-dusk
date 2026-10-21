import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { fetchHandler, supabaseAuthenticate } from "./submitEdge.ts";
import type { FetchRequest } from "./submitEdge.ts";
import { handlerWorld } from "./test/handler.ts";
import { bodyFor, MATCH } from "./test/match.ts";

type Made = { body: string | null; init: { status: number; headers: Record<string, string> } };
const make = (body: string | null, init: Made["init"]): Made => ({ body, init });

const request = (method: string, headers: Record<string, string>, text: () => Promise<string>): FetchRequest => ({
  method,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text,
});

describe("submit Edge Function glue: fetch requests to the handler and back", () => {
  it("passes the method, the Authorization header and the body text, and returns the reply's status, headers and body", async () => {
    const world = handlerWorld();
    const body = JSON.stringify({ matchId: MATCH, submission: bodyFor(0, world.start.secret, "lio") });
    const made = await fetchHandler(
      world.deps,
      make,
    )(request("POST", { authorization: "Bearer token-alice" }, async () => body));
    expect(made.init.status).toBe(200);
    expect(JSON.parse(made.body!)).toEqual({ ok: true, seq: 1 });
    expect(made.init.headers["Content-Type"]).toBe("application/json");
    expect(world.authCalls).toEqual(["token-alice"]);
  });

  it("OPTIONS makes a response with a null body, as a 204 requires", async () => {
    const world = handlerWorld();
    const made = await fetchHandler(world.deps, make)(request("OPTIONS", {}, async () => ""));
    expect(made).toEqual({ body: null, init: { status: 204, headers: expect.any(Object) } });
  });

  it("a body that cannot be read counts as empty: 400 illegalAnswer, store never touched", async () => {
    const world = handlerWorld();
    const made = await fetchHandler(
      world.deps,
      make,
    )(request("POST", { authorization: "Bearer token-alice" }, () => Promise.reject(new Error("stream broke"))));
    expect(made.init.status).toBe(400);
    expect(world.storeCalls()).toBe(0);
  });
});

describe("supabaseAuthenticate: signs a caller in with auth.getUser(token)", () => {
  const fakeDb = (answer: unknown, seen: string[]) =>
    ({
      auth: {
        getUser: async (token: string) => {
          seen.push(token);
          return answer;
        },
      },
    }) as unknown as SupabaseClient;

  it("gives the user's id for a good token", async () => {
    const seen: string[] = [];
    const id = await supabaseAuthenticate(fakeDb({ data: { user: { id: "user-1" } }, error: null }, seen))("tok");
    expect(id).toBe("user-1");
    expect(seen).toEqual(["tok"]);
  });

  it("gives null when the token is refused or no user comes back", async () => {
    const refused = { data: { user: null }, error: { message: "invalid JWT" } };
    expect(await supabaseAuthenticate(fakeDb(refused, []))("bad")).toBeNull();
    expect(await supabaseAuthenticate(fakeDb({ data: { user: null }, error: null }, []))("bad")).toBeNull();
  });
});
