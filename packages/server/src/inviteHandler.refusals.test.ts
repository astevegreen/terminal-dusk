import { describe, expect, it } from "vitest";
import { handleInvite } from "./inviteHandler.ts";
import type { InviteHandlerDeps } from "./inviteHandler.ts";
import type { InviteStore } from "./inviteStore.ts";
import { CORS_HEADERS } from "./submitHandler.ts";
import type { HttpReply } from "./submitHandler.ts";
import { json, post } from "./test/handler.ts";
import { inviteHandlerWorld } from "./test/inviteHandler.ts";
import type { InviteHandlerWorld } from "./test/inviteHandler.ts";

function expectRefused(reply: HttpReply, status: number, code: string): void {
  expect({ status: reply.status, body: json(reply) }).toEqual({
    status,
    body: { ok: false, error: { code, message: expect.any(String) } },
  });
  expect(reply.headers).toEqual({ ...CORS_HEADERS, "Content-Type": "application/json" });
}

/** An open invite made through the handler by the host. */
async function hostInvite(world: InviteHandlerWorld, sides: unknown): Promise<string> {
  const reply = await handleInvite(world.handlerDeps, post("token-host", { action: "create", sides }));
  if (reply.status !== 200) throw new Error(reply.body);
  return (json(reply) as { code: string }).code;
}

const failing: InviteStore = {
  save: () => Promise.reject(new Error("save failed")),
  find: () => Promise.reject(new Error("find failed")),
  accept: () => Promise.reject(new Error("accept failed")),
};

describe("invite handler: methods, CORS and sign-in, as O4b's", () => {
  it("OPTIONS gets 204 with the CORS headers and an empty body", async () => {
    const world = inviteHandlerWorld();
    const reply = await handleInvite(world.handlerDeps, { method: "OPTIONS", authorization: null, body: "" });
    expect(reply).toEqual({ status: 204, headers: { ...CORS_HEADERS }, body: "" });
    expect(world.storeCalls()).toBe(0);
  });

  it("every method but POST and OPTIONS gets 405 methodNotAllowed, and no store is touched", async () => {
    const world = inviteHandlerWorld();
    for (const method of ["GET", "PUT", "DELETE", "PATCH", "post"]) {
      const reply = await handleInvite(world.handlerDeps, {
        ...post("token-host", { action: "preview", code: "X" }),
        method,
      });
      expectRefused(reply, 405, "methodNotAllowed");
    }
    expect(world.storeCalls()).toBe(0);
  });

  it("every action needs a signed-in caller: 401 notSignedIn, and no store is touched", async () => {
    const world = inviteHandlerWorld();
    const bodies = [
      { action: "create", sides: { mode: "random" } },
      { action: "preview", code: "CODE0001" },
      { action: "join", code: "CODE0001" },
    ];
    for (const body of bodies) {
      for (const token of [null, "token-unknown"]) {
        expectRefused(await handleInvite(world.handlerDeps, post(token, body)), 401, "notSignedIn");
      }
    }
    expect(world.storeCalls()).toBe(0);
  });
});

describe("invite handler: a malformed body gives 400 illegalAnswer, with no store touched", () => {
  const bodies: [string, unknown][] = [
    ["text that is not JSON", "{not json"],
    ["an empty body", ""],
    ["null", "null"],
    ["an array", [{ action: "create", sides: { mode: "random" } }]],
    ["a string", JSON.stringify("create")],
    ["a number", "7"],
    ["no action", { sides: { mode: "random" } }],
    ["an unknown action", { action: "cancel", code: "CODE0001" }],
    ["an action that is not text", { action: 1 }],
    ["preview without a code", { action: "preview" }],
    ["preview with an empty code", { action: "preview", code: "" }],
    ["preview with a code that is not text", { action: "preview", code: 1 }],
    ["join without a code", { action: "join" }],
    ["join with an empty code", { action: "join", code: "" }],
    ["join with a code that is not text", { action: "join", code: ["CODE0001"] }],
    ["join with a side that is not lio or sae", { action: "join", code: "CODE0001", side: "bad" }],
    ["join with a side in capitals", { action: "join", code: "CODE0001", side: "LIO" }],
    ["join with a null side", { action: "join", code: "CODE0001", side: null }],
    ["join with a side that is not text", { action: "join", code: "CODE0001", side: 0 }],
  ];
  for (const [name, body] of bodies) {
    it(name, async () => {
      const world = inviteHandlerWorld();
      const reply = await handleInvite(world.handlerDeps, post("token-joiner", body));
      expectRefused(reply, 400, "illegalAnswer");
      expect(world.storeCalls()).toBe(0);
    });
  }
});

describe("invite handler: each refusal gets its status", () => {
  it("404 inviteNotFound: an unknown code, or a used invite, to preview or join", async () => {
    const world = inviteHandlerWorld();
    const deps = world.handlerDeps;
    expectRefused(
      await handleInvite(deps, post("token-joiner", { action: "preview", code: "NOPE" })),
      404,
      "inviteNotFound",
    );
    expectRefused(
      await handleInvite(deps, post("token-joiner", { action: "join", code: "NOPE" })),
      404,
      "inviteNotFound",
    );
    const code = await hostInvite(world, { mode: "random" });
    expect((await handleInvite(deps, post("token-joiner", { action: "join", code }))).status).toBe(200);
    expectRefused(await handleInvite(deps, post("token-third", { action: "preview", code })), 404, "inviteNotFound");
    expectRefused(await handleInvite(deps, post("token-third", { action: "join", code })), 404, "inviteNotFound");
  });

  it("409 ownInvite: the host joins their own invite", async () => {
    const world = inviteHandlerWorld();
    const code = await hostInvite(world, { mode: "random" });
    expectRefused(
      await handleInvite(world.handlerDeps, post("token-host", { action: "join", code })),
      409,
      "ownInvite",
    );
  });

  it("422 invalidInvite: create with a missing or unknown side mode", async () => {
    const world = inviteHandlerWorld();
    for (const body of [
      { action: "create" },
      { action: "create", sides: { mode: "host" } },
      { action: "create", sides: "random" },
    ]) {
      expectRefused(await handleInvite(world.handlerDeps, post("token-host", body)), 422, "invalidInvite");
    }
  });

  it("422 sideRequired and sideNotChoosable: the side given does not fit the mode", async () => {
    const world = inviteHandlerWorld();
    const choose = await hostInvite(world, { mode: "invitee" });
    expectRefused(
      await handleInvite(world.handlerDeps, post("token-joiner", { action: "join", code: choose })),
      422,
      "sideRequired",
    );
    const random = await hostInvite(world, { mode: "random" });
    expectRefused(
      await handleInvite(world.handlerDeps, post("token-joiner", { action: "join", code: random, side: "lio" })),
      422,
      "sideNotChoosable",
    );
  });

  it("422 invalidTime: the clock gives a time that is not a whole number", async () => {
    const world = inviteHandlerWorld();
    const deps: InviteHandlerDeps = { ...world.handlerDeps, now: () => 1.5 };
    expectRefused(
      await handleInvite(deps, post("token-host", { action: "create", sides: { mode: "random" } })),
      422,
      "invalidTime",
    );
  });

  it("422 for a refusal from hostCreate (invalidConfig: an empty match id)", async () => {
    const world = inviteHandlerWorld();
    const code = await hostInvite(world, { mode: "random" });
    const deps: InviteHandlerDeps = { ...world.handlerDeps, matchId: () => "" };
    expectRefused(await handleInvite(deps, post("token-joiner", { action: "join", code })), 422, "invalidConfig");
  });

  it("500 storageFailed: the invite store fails, for each action", async () => {
    const world = inviteHandlerWorld();
    const deps: InviteHandlerDeps = { ...world.handlerDeps, invites: failing };
    const bodies = [
      { action: "create", sides: { mode: "random" } },
      { action: "preview", code: "CODE0001" },
      { action: "join", code: "CODE0001" },
    ];
    for (const body of bodies)
      expectRefused(await handleInvite(deps, post("token-joiner", body)), 500, "storageFailed");
  });

  it("500 internalError: anything unexpected, such as the clock throwing, and the thrown text is not sent", async () => {
    const world = inviteHandlerWorld();
    const deps: InviteHandlerDeps = {
      ...world.handlerDeps,
      now: () => {
        throw new Error("secret detail");
      },
    };
    const reply = await handleInvite(deps, post("token-host", { action: "create", sides: { mode: "random" } }));
    expectRefused(reply, 500, "internalError");
    expect(reply.body).not.toContain("secret detail");
  });
});

describe("invite handler: the join reply carries only ok, matchId and side", () => {
  it("O5a's effects are not sent to the client", async () => {
    const world = inviteHandlerWorld();
    const code = await hostInvite(world, { mode: "host", hostSide: "sae" });
    const reply = await handleInvite(world.handlerDeps, post("token-joiner", { action: "join", code }));
    expect(Object.keys(json(reply) as object).sort()).toEqual(["matchId", "ok", "side"]);
    expect(reply.body).not.toContain("effects");
    expect(reply.body).not.toContain("notify");
  });
});
