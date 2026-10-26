import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { RemoteMatchOptions } from "../transport/remoteMatch.ts";
import { settle } from "../transport/test/remoteGame.ts";
import { DEFAULT_POLL_MS } from "./onlineGame.ts";
import { onlineRig, play } from "./test/onlineRig.ts";

// createRemoteMatch, wrapped so each test can count the transports made and the subscriptions to each.
const made = vi.hoisted(() => ({ options: [] as unknown[], subscribes: [] as Mock[] }));
vi.mock("../transport/remoteMatch.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../transport/remoteMatch.ts")>();
  return {
    ...actual,
    createRemoteMatch: (options: RemoteMatchOptions) => {
      const transport = actual.createRemoteMatch(options);
      const subscribe = vi.fn(transport.subscribe);
      made.options.push(options);
      made.subscribes.push(subscribe);
      return { ...transport, subscribe };
    },
  };
});

describe("createOnlineGame: wiring", () => {
  it("builds one createRemoteMatch and subscribes to it once, however many frames arrive", async () => {
    made.options.length = 0;
    made.subscribes.length = 0;
    const r = onlineRig();
    await settle();
    await play(r);
    await play(r);
    expect(made.options).toHaveLength(1);
    expect(made.subscribes).toHaveLength(1);
    expect(made.subscribes[0]).toHaveBeenCalledTimes(1);
    expect(r.game.getSnapshot().frame?.seq).toBe(2);
  });

  it("pollMs defaults to 5000: the next poll is set for 5000 ms when pollMs is left out", async () => {
    made.options.length = 0;
    const r = onlineRig("alice", { clock: null }, true);
    await settle();
    expect(DEFAULT_POLL_MS).toBe(5_000);
    expect((made.options[0] as RemoteMatchOptions).pollMs).toBe(5_000);
    expect(r.timers.waiting()).toEqual([5_000]);
  });
});
