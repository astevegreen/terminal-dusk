// A ranked session wired to the fake lobby server, for the tests. Every request is answered by what the test queued
// with `fake.answerNext`; nothing queued answers 500 (so `network`).
import { createRankedSession } from "../rankedSession.ts";
import type { RankedSession, RankedSnapshot } from "../rankedSession.ts";
import { PLAYER, TOKEN, createFakeLobby } from "./fakeLobby.ts";
import type { FakeLobby } from "./fakeLobby.ts";

export type RankedRig = { fake: FakeLobby; ranked: RankedSession; seen: RankedSnapshot[] };

export function rankedRig(): RankedRig {
  const fake = createFakeLobby();
  const ranked = createRankedSession({
    endpoint: fake.endpoint,
    playerId: PLAYER,
    accessToken: () => Promise.resolve(TOKEN),
    platform: "web",
  });
  const seen = [ranked.getSnapshot()];
  ranked.subscribe(() => seen.push(ranked.getSnapshot()));
  return { fake, ranked, seen };
}

export const TICKET = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

/** A rig that has searched: My games read empty, the ticket stored. */
export async function searchingRig(): Promise<RankedRig> {
  const r = rankedRig();
  r.fake.answerNext({ status: 200, body: [] });
  r.fake.answerNext({ status: 200, body: { ok: true, ticketId: TICKET } });
  await r.ranked.search();
  return r;
}
