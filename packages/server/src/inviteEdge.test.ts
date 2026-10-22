import { describe, expect, it } from "vitest";
import type { FetchRequest } from "./edge.ts";
import { inviteFetchHandler, secureInviteRandom } from "./inviteEdge.ts";
import { inviteHandlerWorld } from "./test/inviteHandler.ts";

type Made = { body: string | null; init: { status: number; headers: Record<string, string> } };
const make = (body: string | null, init: Made["init"]): Made => ({ body, init });

const request = (method: string, headers: Record<string, string>, text: () => Promise<string>): FetchRequest => ({
  method,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text,
});

describe("invite Edge Function glue: fetch requests to the handler and back", () => {
  it("passes the method, the Authorization header and the body text, and returns the reply's status, headers and body", async () => {
    const w = inviteHandlerWorld();
    const body = JSON.stringify({ action: "create", sides: { mode: "invitee" } });
    const made = await inviteFetchHandler(
      w.deps,
      make,
    )(request("POST", { authorization: "Bearer token-host" }, async () => body));
    expect(made.init.status).toBe(200);
    expect(JSON.parse(made.body!)).toEqual({ ok: true, code: "CODE0001" });
    expect(made.init.headers["Content-Type"]).toBe("application/json");
    expect(w.authCalls).toEqual(["token-host"]);
  });

  it("OPTIONS makes a response with a null body, as a 204 requires", async () => {
    const w = inviteHandlerWorld();
    const made = await inviteFetchHandler(w.deps, make)(request("OPTIONS", {}, async () => ""));
    expect(made).toEqual({ body: null, init: { status: 204, headers: expect.any(Object) } });
  });

  it("a body that cannot be read counts as empty: 400 illegalAnswer, store never touched", async () => {
    const w = inviteHandlerWorld();
    const made = await inviteFetchHandler(
      w.deps,
      make,
    )(request("POST", { authorization: "Bearer token-host" }, () => Promise.reject(new Error("stream broke"))));
    expect(made.init.status).toBe(400);
    expect(w.storeCalls()).toBe(0);
  });
});

describe("secureInviteRandom: the live match id, seed and random host side", () => {
  /** A stand-in source that fills each array with `fill`, and counts calls. */
  const source = (fill: number) => {
    const calls: number[] = [];
    return {
      calls,
      getRandomValues(array: Uint8Array) {
        calls.push(array.length);
        array.fill(fill);
        return array;
      },
    };
  };

  it("draws a 32-character hex match id and a 64-character hex seed from the source", () => {
    const fake = source(0xab);
    const random = secureInviteRandom(fake);
    expect(random.matchId()).toBe("ab".repeat(16));
    expect(random.seed()).toBe("ab".repeat(32));
    expect(fake.calls).toEqual([16, 32]);
  });

  it("gives the host LIO for an even byte and SAE for an odd one", () => {
    expect(secureInviteRandom(source(2)).randomHostSide()).toBe("lio");
    expect(secureInviteRandom(source(3)).randomHostSide()).toBe("sae");
  });

  it("by default uses the platform's crypto: fresh, different values each time", () => {
    const random = secureInviteRandom();
    expect(random.matchId()).toMatch(/^[0-9a-f]{32}$/);
    expect(random.seed()).toMatch(/^[0-9a-f]{64}$/);
    expect(random.matchId()).not.toBe(random.matchId());
    expect(["lio", "sae"]).toContain(random.randomHostSide());
  });
});
