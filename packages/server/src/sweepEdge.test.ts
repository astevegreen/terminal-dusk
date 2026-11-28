import { describe, expect, it } from "vitest";
import type { HttpReply, HttpRequest } from "./http.ts";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { createSeek } from "./matchmake.ts";
import { MemoryNotifyStore } from "./notifyStore.ts";
import { MemorySeekStore } from "./seekStore.ts";
import { MemoryStore } from "./store.ts";
import { handleMatchmake, handleSweepDeadlines, handleSweepTurnAlerts, matchmakeFetchHandler } from "./sweepEdge.ts";
import { alertSweepWorld, deadlineWorld, SERVICE_KEY, sweepRequest } from "./test/sweeps.ts";

/** One sweep handler with a fresh world: how to call it and what it ran. */
type Subject = {
  name: string;
  world: (now?: () => number) => Promise<{
    call: (request: HttpRequest) => Promise<HttpReply>;
    ran: () => { dueCalls: number[]; changed: () => Promise<boolean> };
    setKey: (key: string) => void;
  }>;
};

/** The matchmake sweep with two compatible tickets waiting; "ran" means the sweep looked at the open tickets. */
async function matchmakeWorld(now: () => number = () => 1_700_000_000_000) {
  const matches = new MemoryStore();
  const seeks = new MemorySeekStore(matches);
  const entitlements = new MemoryEntitlementStore(
    ["p1", "p2"].map((player) => ({ player, platform: "web", source: "test" })),
  );
  let ticket = 0;
  for (const player of ["p1", "p2"]) {
    await createSeek(
      { seeks, entitlements, matches, ticketId: () => `t-${++ticket}` },
      { player, platform: "web", preset: "normal", now: 1_700_000_000_000 },
    );
  }
  const dueCalls: number[] = [];
  let lastClock = Number.NaN;
  const deps = {
    serviceKey: SERVICE_KEY,
    now: () => (lastClock = now()),
    matchmake: {
      seeks: {
        create: seeks.create.bind(seeks),
        pair: seeks.pair.bind(seeks),
        open: () => {
          dueCalls.push(lastClock);
          return seeks.open();
        },
      },
      notify: new MemoryNotifyStore(),
      matchId: () => "m-1",
      seed: () => "seed-1",
    },
  };
  return { deps, seeks, dueCalls };
}

const subjects: Subject[] = [
  {
    name: "matchmake",
    world: async (now) => {
      const w = await matchmakeWorld(now);
      return {
        call: (request) => handleMatchmake(w.deps, request),
        ran: () => ({ dueCalls: w.dueCalls, changed: async () => (await w.seeks.open()).length === 0 }),
        setKey: (key) => (w.deps.serviceKey = key),
      };
    },
  },
  {
    name: "sweep-deadlines",
    world: async (now) => {
      const w = deadlineWorld(now);
      const before = JSON.stringify(w.store.stored("match-K7QZ-deadline"));
      return {
        call: (request) => handleSweepDeadlines(w.deps, request),
        ran: () => ({
          dueCalls: w.dueCalls,
          changed: async () => JSON.stringify(w.store.stored("match-K7QZ-deadline")) !== before,
        }),
        setKey: (key) => (w.deps.serviceKey = key),
      };
    },
  },
  {
    name: "sweep-turn-alerts",
    world: async (now) => {
      const w = await alertSweepWorld(now);
      return {
        call: (request) => handleSweepTurnAlerts(w.deps, request),
        ran: () => ({ dueCalls: w.dueCalls, changed: async () => w.mailer.sent.length > 0 }),
        setKey: (key) => (w.deps.serviceKey = key),
      };
    },
  },
];

const errorOf = (reply: HttpReply): unknown => (JSON.parse(reply.body) as { error: unknown }).error;

describe.each(subjects)("$name handler: who may run the sweep", (subject) => {
  it("any method other than POST is 405 and runs nothing", async () => {
    for (const method of ["GET", "PUT", "DELETE", "OPTIONS", "post"]) {
      const w = await subject.world();
      const reply = await w.call(sweepRequest(method));
      expect(reply.status).toBe(405);
      expect(w.ran().dueCalls).toEqual([]);
      expect(await w.ran().changed()).toBe(false);
    }
  });

  it("a missing or wrong Authorization header is 401 and runs nothing", async () => {
    const wrong = [
      null,
      "",
      SERVICE_KEY,
      `bearer ${SERVICE_KEY}`,
      `Bearer  ${SERVICE_KEY}`,
      `Bearer ${SERVICE_KEY} `,
      `Bearer ${SERVICE_KEY}x`,
      `Bearer ${SERVICE_KEY.slice(0, -1)}`,
      `Bearer ${SERVICE_KEY.slice(0, -1)}X`,
      "Bearer anon-key",
    ];
    for (const authorization of wrong) {
      const w = await subject.world();
      const reply = await w.call(sweepRequest("POST", authorization));
      expect(reply.status).toBe(401);
      expect(errorOf(reply)).toMatchObject({ code: "notAuthorized" });
      expect(w.ran().dueCalls).toEqual([]);
      expect(await w.ran().changed()).toBe(false);
    }
  });

  it("an empty configured key refuses every call with 401, even a header of `Bearer ` with nothing after it", async () => {
    for (const authorization of ["Bearer ", "Bearer", "", null, `Bearer ${SERVICE_KEY}`]) {
      const w = await subject.world();
      w.setKey("");
      const reply = await w.call(sweepRequest("POST", authorization));
      expect(reply.status).toBe(401);
      expect(w.ran().dueCalls).toEqual([]);
    }
  });

  it("a clock giving a time that is not a whole number 0 or more is 500 with a fixed message, and nothing is run", async () => {
    const bad = [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, "12" as unknown as number];
    const messages = new Set<string>();
    for (const time of bad) {
      const w = await subject.world(() => time);
      const reply = await w.call(sweepRequest("POST"));
      expect(reply.status).toBe(500);
      const error = errorOf(reply) as { code: string; message: string };
      expect(error.code).toBe("badClock");
      messages.add(error.message);
      expect(w.ran().dueCalls).toEqual([]);
    }
    expect(messages.size).toBe(1);
  });

  it("a clock that throws is 500 with a fixed message, and nothing is thrown out of the handler", async () => {
    const w = await subject.world(() => {
      throw new Error("clock broke at match-K7QZ-deadline");
    });
    const reply = await w.call(sweepRequest("POST"));
    expect(reply.status).toBe(500);
    expect(errorOf(reply)).toEqual({ code: "sweepFailed", message: "The sweep could not run." });
    expect(reply.body).not.toContain("K7QZ");
    expect(w.ran().dueCalls).toEqual([]);
  });

  it("the time 0 is a usable time: 200", async () => {
    const w = await subject.world(() => 0);
    expect((await w.call(sweepRequest("POST"))).status).toBe(200);
    expect(w.ran().dueCalls).toEqual([0]);
  });
});

describe("matchmake: what the sweep does when allowed", () => {
  it("the right key pairs the two tickets and the reply counts one paired", async () => {
    const w = await matchmakeWorld();
    const reply = await handleMatchmake(w.deps, sweepRequest("POST"));
    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.body)).toEqual({ results: { paired: 1, unavailable: 0, failed: 0 } });
    expect(await w.seeks.open()).toEqual([]);
  });

  it("the fetch handler refuses a call without the key and runs nothing", async () => {
    const w = await matchmakeWorld();
    const handler = matchmakeFetchHandler(w.deps, (body: string | null, init: { status: number }) => ({
      body,
      status: init.status,
    }));
    const refused = await handler({ method: "POST", headers: { get: () => null }, text: async () => "" });
    expect(refused.status).toBe(401);
    expect(await w.seeks.open()).toHaveLength(2);
  });
});
