// The phase 4 gate, rehearsed (O13; docs/architecture.md, "Revised build order", phase 4): 50 games on the local
// Supabase stack, each made through the invite function and played by Easy AI on both seats through the real
// remote transport and the submit function, as a browser would. After every step both clients' frames must
// match the server's, and no response a client is sent may carry a secret or the rival's private data. The run
// prints a short report. Without a running stack and its functions, one test says so and how to start them.
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRemoteMatch } from "./remoteMatch.ts";
import {
  cleanUp,
  HOW_TO_START,
  makeUser,
  openMatch,
  serverSnapshot,
  stackKeys,
  whyUnavailable,
} from "./test/localStack.ts";
import type { StackKeys, StackUser } from "./test/localStack.ts";
import { playRehearsalGame } from "./test/rehearsal.ts";
import type { GameResult, GameRig } from "./test/rehearsal.ts";
import { rehearsalReport } from "./test/rehearsalReport.ts";

const GAMES = 50;
const GAME_TIMEOUT = 180_000;
const TITLE = "Phase 4 rehearsal (O13): Easy-vs-Easy games through submit on the local Supabase stack";

const keys = stackKeys();
const unavailable = await whyUnavailable(keys);

if (unavailable !== null || keys === null) {
  describe(TITLE, () => {
    it(`did not run, because ${unavailable} (the warning below says how to start it)`, () => {
      console.warn(`${TITLE}: did not run: ${unavailable}. ${HOW_TO_START}`);
      expect(unavailable).not.toBeNull();
    });
  });
} else {
  defineRun(keys);
}

function defineRun(stack: StackKeys): void {
  describe(TITLE, () => {
    const users: StackUser[] = [];
    const matchIds: string[] = [];
    const results: GameResult[] = [];

    beforeAll(async () => {
      users.push(await makeUser(stack, "lio"), await makeUser(stack, "sae"));
    }, 60_000);

    afterAll(async () => {
      await cleanUp(stack, matchIds, users);
    }, 120_000);

    /** A fresh match between the two test users, played through two real remote transports. */
    async function rig(): Promise<GameRig> {
      const [lio, sae] = users as [StackUser, StackUser];
      const { matchId } = await openMatch(stack, lio, sae);
      matchIds.push(matchId);
      const seat = { lio, sae };
      return {
        matchId,
        fetch: (url, init) => fetch(url, init),
        transport: (side, fetchFn) =>
          createRemoteMatch({
            url: stack.url,
            anonKey: stack.anonKey,
            matchId,
            playerId: seat[side].id,
            accessToken: () => Promise.resolve(seat[side].token),
            pollMs: 25,
            fetch: fetchFn,
            setTimer: (run, ms) => setTimeout(run, ms),
            clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
          }),
        server: () => serverSnapshot(stack, matchId),
      };
    }

    for (let game = 1; game <= GAMES; game++) {
      it(
        `game ${game} of ${GAMES} plays to the end with every step's frames matching the server's and no hidden data in any response`,
        async () => {
          const aiSeeds = { lio: 2 * game - 1, sae: 2 * game };
          const result = await playRehearsalGame(await rig(), {
            ruleset: firstDeckRuleset,
            aiSeeds,
            waitMs: 20_000,
            maxSteps: 2_000,
          });
          results.push(result);
          expect(result.desyncs).toEqual([]);
          expect(result.leaks).toEqual([]);
          expect(result.refusals).toEqual([]);
          expect(result.finished).toBe(true);
        },
        GAME_TIMEOUT,
      );
    }

    it(`the run's report shows ${GAMES} finished games with no desync and no leak`, () => {
      const report = rehearsalReport(TITLE, results);
      console.log(report);
      expect(report.endsWith("Result: PASS")).toBe(true);
      expect(results).toHaveLength(GAMES);
    });
  });
}
