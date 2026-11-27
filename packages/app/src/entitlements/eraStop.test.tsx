// Who stops at the end of Era 1 in a game against the AI (#686): a player without a `web` entitlement, in every one,
// with the Full Game offer; an owner plays on and never sees the offer. The matches are the app's own (appGames.ts),
// answered by a scripted human against the stand-in AI. The same is checked in a browser by e2e/eraStop.e2e.ts.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App, playerGames } from "../App.tsx";
import { appGames } from "../appGames.ts";
import { OFFER_TEXT } from "../tutorial/FullGameOffer.tsx";
import { createVsAiSession } from "../vsAi/session.ts";
import type { VsAiSession } from "../vsAi/session.ts";
import { flush, playOut, pressFirst } from "../vsAi/test/scriptedHuman.ts";
import { standInAi } from "../vsAi/test/standInAi.ts";
import type { StandIn } from "../vsAi/test/standInAi.ts";
import { Game, SidePicker, vsAiOptions } from "../vsAi/VsAiScreen.tsx";
import type { VsAiGame } from "../vsAi/VsAiScreen.tsx";

const clock = (): number => 1_700_000_000_000;
/** A whole game takes seconds, and several times as long on a loaded machine. */
const GAME_LIMIT = 60_000;

const start = (game: VsAiGame): { session: VsAiSession; standIn: StandIn } => {
  const standIn = standInAi();
  const setup = { clock, newSeed: () => "era-stop-seed", newAiSeed: () => 5, makeAi: standIn.makeAi, game };
  return { session: createVsAiSession(vsAiOptions("lio", setup)), standIn };
};
const draw = (session: VsAiSession, game: VsAiGame): string =>
  renderToString(<Game session={session} onNewGame={() => {}} game={game} />);
const pub = (session: VsAiSession) => session.getSnapshot().frame!.view.public;

/** Plays until the game passes turn `turn` or ends. */
async function playPast(session: VsAiSession, standIn: StandIn, turn: number): Promise<void> {
  for (let step = 0; step < 200; step++) {
    await flush();
    if (pub(session).turn > turn || pub(session).status.kind !== "active") return;
    if (session.getSnapshot().frame!.decision) await pressFirst(session);
    else if (standIn.release() === 0) throw new Error("nobody can move");
  }
  throw new Error(`the game did not pass turn ${turn} within 200 steps`);
}

const SCREENS = ["vsAi", "vsAiMap", "vsAiFuture"] as const;

describe("a free player's games against the AI (#686)", () => {
  const games = playerGames(appGames, false);

  it.each(SCREENS)(
    '"%s" ends after Era 1 with the Full Game offer and its disabled buy button',
    async (screen) => {
      const game = games[screen]!;
      const { session, standIn } = start(game);
      await playOut(session, standIn);
      expect(session.getSnapshot().aiRefusal).toBeNull();
      expect(pub(session).status.kind).toBe("over");
      expect(pub(session).turn).toBeLessThanOrEqual(3);
      const out = draw(session, game);
      expect(out).toContain("Game over: ");
      expect(out).toContain(OFFER_TEXT);
      expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Get the Full Game<\/button>/);
      session.stop();
    },
    GAME_LIMIT,
  );

  it.each(SCREENS)('"%s" starts the engine\'s free game: 3 turns, and its note says so', async (screen) => {
    const game = games[screen]!;
    expect(renderToString(<SidePicker onPick={() => {}} note={game.note} />)).toContain("only, 3 turns");
    const { session } = start(game);
    await flush();
    expect(pub(session).turns).toBe(3);
    // The map games keep their map; "Play against the AI" never had one.
    expect(pub(session).map === undefined).toBe(screen === "vsAi");
    session.stop();
  });

  it('"vsAiFree" follows #668: the free game with the offer', () => {
    expect(games.vsAiFree?.note).toBe(appGames.freeGame.note);
    expect(games.vsAiFree?.offerFullGame).toBe(true);
  });
});

describe("an owner's games against the AI (#686)", () => {
  const games = playerGames(appGames, true);

  it.each(SCREENS)(
    '"%s" runs past Era 1 with no offer',
    async (screen) => {
      const game = games[screen]!;
      expect(game.offerFullGame).toBeFalsy();
      const { session, standIn } = start(game);
      await flush();
      expect(pub(session).turns).toBeGreaterThan(3);
      await playPast(session, standIn, 3);
      expect(session.getSnapshot().aiRefusal).toBeNull();
      // Past turn 3, unless somebody won outright first, which no free game's end is.
      expect(pub(session).turn).toBeGreaterThan(3);
      expect(draw(session, game)).not.toContain(OFFER_TEXT);
      session.stop();
    },
    GAME_LIMIT,
  );

  it('"vsAiFree" stays the Era 1 game (#668) and shows an owner no offer', async () => {
    const game = games.vsAiFree!;
    expect(game.note).toBe(appGames.freeGame.note);
    expect(game.offerFullGame).toBeFalsy();
    const { session, standIn } = start(game);
    await playOut(session, standIn);
    expect(pub(session).status.kind).toBe("over");
    expect(draw(session, game)).not.toContain(OFFER_TEXT);
    session.stop();
  });
});

describe("the home screen's words about a failed check (#686)", () => {
  const props = { clock, newSeed: () => "s", newAiSeed: () => 1 };

  it("are drawn when the App is given them, and nothing is drawn otherwise", () => {
    expect(renderToString(<App {...props} notice={<p>Could not check</p>} />)).toContain("Could not check");
    expect(renderToString(<App {...props} />)).not.toContain("Could not check");
  });
});
