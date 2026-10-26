import { describe, expect, it } from "vitest";
import { CORS_HEADERS } from "./http.ts";
import type { HttpReply } from "./http.ts";
import { handleInvite } from "./inviteHandler.ts";
import type { InviteHandlerDeps } from "./inviteHandler.ts";
import { post } from "./test/handler.ts";
import { body, inviteHandlerWorld } from "./test/inviteHandler.ts";
import { HOST, JOINER } from "./test/invites.ts";

const ALLOWED = ["authorization", "apikey", "content-type", "x-client-info"];

function expectRefused(reply: HttpReply, status: number, code: string): void {
  expect(reply.status).toBe(status);
  expect(body(reply)).toEqual({ ok: false, error: { code, message: expect.any(String) } });
  expect(reply.headers["Content-Type"]).toBe("application/json");
  expect(reply.headers["Access-Control-Allow-Origin"]).toBe("*");
  const allowed = reply.headers["Access-Control-Allow-Headers"]!.split(",").map((h) => h.trim());
  expect(allowed).toEqual(expect.arrayContaining(ALLOWED));
}

const CREATE_RANDOM = { action: "create", sides: { mode: "random" }, platform: "web" };

/** Creates an invite as the host through the handler and returns its code. */
async function created(deps: InviteHandlerDeps, sides: unknown = { mode: "random" }): Promise<string> {
  const reply = await handleInvite(deps, post("token-host", { action: "create", sides, platform: "web" }));
  expect(reply.status).toBe(200);
  return (body(reply) as { code: string }).code;
}

describe("invite handler: methods and CORS (as O4b)", () => {
  it("OPTIONS gets 204 with the CORS headers and an empty body, and no store or sign-in is touched", async () => {
    const w = inviteHandlerWorld();
    const reply = await handleInvite(w.deps, { method: "OPTIONS", authorization: null, body: "" });
    expect(reply).toEqual({ status: 204, headers: { ...CORS_HEADERS }, body: "" });
    expect(w.storeCalls()).toBe(0);
    expect(w.authCalls).toEqual([]);
  });

  it("every method but POST and OPTIONS gets 405 methodNotAllowed, and the store is never touched", async () => {
    const w = inviteHandlerWorld();
    for (const method of ["GET", "PUT", "DELETE", "PATCH", "HEAD", "post"]) {
      const reply = await handleInvite(w.deps, { ...post("token-host", CREATE_RANDOM), method });
      expectRefused(reply, 405, "methodNotAllowed");
    }
    expect(w.storeCalls()).toBe(0);
  });
});

describe("invite handler: 401 notSignedIn for every action without a signed-in caller", () => {
  const actions = [CREATE_RANDOM, { action: "preview", code: "CODE0001" }, { action: "join", code: "CODE0001" }];
  for (const action of actions) {
    it(`${action.action}: no header, a malformed header, or a token sign-in refuses gives 401, store never touched`, async () => {
      const w = inviteHandlerWorld();
      for (const authorization of [null, "", "token-host", "Bearer ", "Bearer token-nobody"]) {
        const reply = await handleInvite(w.deps, { ...post(null, action), authorization });
        expectRefused(reply, 401, "notSignedIn");
      }
      const throwing = { ...w.deps, authenticate: () => Promise.reject(new Error("auth down")) };
      expectRefused(await handleInvite(throwing, post("token-host", action)), 401, "notSignedIn");
      expect(w.storeCalls()).toBe(0);
    });
  }
});

describe("invite handler: 400 illegalAnswer for a malformed body, with no store touched", () => {
  const bodies: [string, unknown][] = [
    ["text that is not JSON", "not json {"],
    ["an empty body", ""],
    ["null", "null"],
    ["an array", [CREATE_RANDOM]],
    ["a string", JSON.stringify("create")],
    ["a number", "42"],
    ["no action", { sides: { mode: "random" } }],
    ["an unknown action", { action: "cancel", code: "CODE0001" }],
    ["an action that is not a string", { action: 1 }],
    ["preview with no code", { action: "preview" }],
    ["preview with an empty code", { action: "preview", code: "" }],
    ["preview with a code that is not a string", { action: "preview", code: 7 }],
    ["join with no code", { action: "join", side: "lio" }],
    ["join with an empty code", { action: "join", code: "" }],
    ["join with a side that is not lio or sae", { action: "join", code: "CODE0001", side: "bad" }],
    ["join with a side that is not a string", { action: "join", code: "CODE0001", side: 1 }],
    ["join with a null side", { action: "join", code: "CODE0001", side: null }],
  ];
  for (const [name, sent] of bodies) {
    it(name, async () => {
      const w = inviteHandlerWorld();
      expectRefused(await handleInvite(w.deps, post("token-joiner", sent)), 400, "illegalAnswer");
      expect(w.storeCalls()).toBe(0);
    });
  }
});

describe("invite handler: the players come from sign-in, never from the body", () => {
  it("create stores the signed-in caller as host, whatever host the body names", async () => {
    const w = inviteHandlerWorld();
    const reply = await handleInvite(w.deps, post("token-host", { ...CREATE_RANDOM, host: "someone-else" }));
    expect(reply.status).toBe(200);
    expect((await w.world.invites.find("CODE0001"))?.host).toBe(HOST);
  });

  it("join seats the signed-in caller, whatever player the body names", async () => {
    const w = inviteHandlerWorld();
    const code = await created(w.deps, { mode: "host", hostSide: "lio" });
    const reply = await handleInvite(w.deps, post("token-joiner", { action: "join", code, player: HOST }));
    expect(body(reply)).toEqual({ ok: true, matchId: "match-1", side: "sae" });
    expect((await w.world.matches.load("match-1"))?.record.players).toEqual({ lio: HOST, sae: JOINER });
  });
});

describe("invite handler: each refusal's status", () => {
  it("404 inviteNotFound: preview or join of an unknown code, or of an invite already joined", async () => {
    const w = inviteHandlerWorld();
    expectRefused(
      await handleInvite(w.deps, post("token-joiner", { action: "preview", code: "NOPE" })),
      404,
      "inviteNotFound",
    );
    expectRefused(
      await handleInvite(w.deps, post("token-joiner", { action: "join", code: "NOPE" })),
      404,
      "inviteNotFound",
    );
    const code = await created(w.deps);
    expect((await handleInvite(w.deps, post("token-joiner", { action: "join", code }))).status).toBe(200);
    expectRefused(await handleInvite(w.deps, post("token-third", { action: "join", code })), 404, "inviteNotFound");
    expectRefused(await handleInvite(w.deps, post("token-third", { action: "preview", code })), 404, "inviteNotFound");
  });

  it("409 ownInvite: the host joining their own invite", async () => {
    const w = inviteHandlerWorld();
    const code = await created(w.deps);
    expectRefused(await handleInvite(w.deps, post("token-host", { action: "join", code })), 409, "ownInvite");
  });

  it("422 invalidInvite: create with a side mode that is missing or not one of the three", async () => {
    const w = inviteHandlerWorld();
    for (const sides of [undefined, null, { mode: "both" }, { mode: "host" }, { mode: "host", hostSide: "x" }]) {
      const reply = await handleInvite(w.deps, post("token-host", { action: "create", sides, platform: "web" }));
      expectRefused(reply, 422, "invalidInvite");
    }
  });

  it("422 invalidTime: a clock that gives an unusable time, for create and join", async () => {
    const w = inviteHandlerWorld();
    const code = await created(w.deps);
    const badClock = { ...w.deps, now: () => -1 };
    expectRefused(await handleInvite(badClock, post("token-host", CREATE_RANDOM)), 422, "invalidTime");
    expectRefused(await handleInvite(badClock, post("token-joiner", { action: "join", code })), 422, "invalidTime");
  });

  it("422 sideRequired and sideNotChoosable: the side given or left out against the invite's mode", async () => {
    const w = inviteHandlerWorld();
    const invitee = await created(w.deps, { mode: "invitee" });
    expectRefused(
      await handleInvite(w.deps, post("token-joiner", { action: "join", code: invitee })),
      422,
      "sideRequired",
    );
    const hostMode = await created(w.deps, { mode: "host", hostSide: "sae" });
    const choosing = { action: "join", code: hostMode, side: "lio" };
    expectRefused(await handleInvite(w.deps, post("token-joiner", choosing)), 422, "sideNotChoosable");
  });

  it("422 with hostCreate's own code: a refusal from hostCreate (here invalidConfig, from an empty match id)", async () => {
    const w = inviteHandlerWorld();
    const code = await created(w.deps);
    const noId = { ...w.deps, matchId: () => "" };
    expectRefused(await handleInvite(noId, post("token-joiner", { action: "join", code })), 422, "invalidConfig");
  });

  it("500 storageFailed: a store that fails", async () => {
    const w = inviteHandlerWorld();
    const failing = () => Promise.reject(new Error("db down"));
    const broken = { ...w.deps, invites: { save: failing, find: failing, accept: failing } };
    expectRefused(await handleInvite(broken, post("token-host", CREATE_RANDOM)), 500, "storageFailed");
    expectRefused(
      await handleInvite(broken, post("token-joiner", { action: "preview", code: "X" })),
      500,
      "storageFailed",
    );
    expectRefused(
      await handleInvite(broken, post("token-joiner", { action: "join", code: "X" })),
      500,
      "storageFailed",
    );
  });

  it("500 internalError: something unexpected (a clock that throws) has a fixed message, and nothing is thrown", async () => {
    const w = inviteHandlerWorld();
    const throwing = {
      ...w.deps,
      now: () => {
        throw new Error("secret detail");
      },
    };
    const reply = await handleInvite(throwing, post("token-host", CREATE_RANDOM));
    expectRefused(reply, 500, "internalError");
    expect(reply.body).not.toContain("secret detail");
  });
});

describe("invite handler: the join reply", () => {
  it("carries only ok, matchId and side: hostCreate's effects are not sent", async () => {
    const w = inviteHandlerWorld();
    const code = await created(w.deps);
    const reply = await handleInvite(w.deps, post("token-joiner", { action: "join", code }));
    expect(reply.status).toBe(200);
    expect(Object.keys(body(reply) as object).sort()).toEqual(["matchId", "ok", "side"]);
    expect(reply.body).not.toContain("effects");
    expect(reply.body).not.toContain("notify");
  });
});
