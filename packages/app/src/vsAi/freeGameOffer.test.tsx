// The free game against the AI ends with the Full Game offer the free tutorial shows (#668); no other game does.
import { ERA_1_FREE_NOTE, era1FreeConfig, firstDeckCardName, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { vsAiGames } from "../App.tsx";
import { cardAffiliation, cardQuestion } from "../testMode/fixture.ts";
import { createLocalMatch } from "../transport/localMatch.ts";
import { OFFER_BUY, OFFER_PLACEHOLDER_LABEL, OFFER_TEXT } from "../tutorial/FullGameOffer.tsx";
import { createVsAiSession } from "./session.ts";
import type { VsAiSession } from "./session.ts";
import { flush, playOut } from "./test/scriptedHuman.ts";
import { standInAi } from "./test/standInAi.ts";
import { Game, vsAiOptions } from "./VsAiScreen.tsx";
import type { VsAiGame } from "./VsAiScreen.tsx";

const clock = (): number => 1_700_000_000_000;
// One short match (the free game's 3 turns) stands for every game here, so only the screen it is opened on differs.
const plain: VsAiGame = {
  ruleset: firstDeckRuleset,
  makeMatch: (seed, now) => createLocalMatch(firstDeckRuleset, era1FreeConfig(), seed, now),
  cardName: firstDeckCardName,
  cardQuestion,
  cardAffiliation,
  note: ERA_1_FREE_NOTE,
};

const startSession = () => {
  const standIn = standInAi();
  const setup = { clock, newSeed: () => "free-offer-seed", newAiSeed: () => 5, makeAi: standIn.makeAi, game: plain };
  return { session: createVsAiSession(vsAiOptions("lio", setup)), standIn };
};
const draw = (session: VsAiSession, game: VsAiGame | undefined): string =>
  renderToString(<Game session={session} onNewGame={() => {}} game={game} />);

let finished: VsAiSession;
beforeAll(async () => {
  const { session, standIn } = startSession();
  await playOut(session, standIn);
  expect(session.getSnapshot().frame!.view.public.status.kind).toBe("over");
  finished = session;
});

describe("the end of a game against the AI (#668)", () => {
  it("a finished free game shows the result and the offer, with a 44 px buy button that is disabled", () => {
    const out = draw(finished, { ...plain, offerFullGame: true });
    expect(out).toContain("Game over: ");
    expect(out).toContain(OFFER_PLACEHOLDER_LABEL);
    expect(out).toContain(OFFER_TEXT);
    const buy = new RegExp(`<button[^>]*>${OFFER_BUY}</button>`).exec(out)?.[0];
    expect(buy).toContain("disabled");
    expect(buy).toContain("min-height:44px");
    // The offer comes before the end buttons, so it is read first.
    expect(out.indexOf(OFFER_TEXT)).toBeLessThan(out.indexOf("New game"));
  });

  it("a finished game from the plain game shows the result and no offer", () => {
    for (const game of [plain, undefined]) {
      const out = draw(finished, game);
      expect(out).toContain("Game over: ");
      expect(out).not.toContain(OFFER_TEXT);
    }
  });

  it("a free game that still runs shows no offer", async () => {
    const { session } = startSession();
    await flush();
    expect(session.getSnapshot().frame!.view.public.status.kind).toBe("active");
    expect(draw(session, { ...plain, offerFullGame: true })).not.toContain(OFFER_TEXT);
    session.stop();
  });
});

describe("the games the App opens against the AI (#668)", () => {
  const named = (note: string): VsAiGame => ({ ...plain, note });
  const given = { game: named("first"), mapGame: named("map"), freeGame: named("free"), futureGame: named("future") };

  it('"vsAiFree" shows the offer at the end', () => {
    const free = vsAiGames(given).vsAiFree;
    expect(free?.note).toBe("free");
    expect(draw(finished, free)).toContain(OFFER_TEXT);
  });

  it('"vsAi", "vsAiMap" and "vsAiFuture" show none', () => {
    const games = vsAiGames(given);
    expect([games.vsAi?.note, games.vsAiMap?.note, games.vsAiFuture?.note]).toEqual(["first", "map", "future"]);
    for (const game of [games.vsAi, games.vsAiMap, games.vsAiFuture]) {
      expect(draw(finished, game)).not.toContain(OFFER_TEXT);
    }
  });

  it("a screen with no game of its own plays the plain one, and only the free screen's copy of it has the offer", () => {
    const games = vsAiGames({ game: given.game });
    expect(draw(finished, games.vsAiFree)).toContain(OFFER_TEXT);
    for (const game of [games.vsAi, games.vsAiMap, games.vsAiFuture, given.game]) {
      expect(draw(finished, game)).not.toContain(OFFER_TEXT);
    }
  });

  it("with no games at all every screen plays the developer fixture, which has no offer", () => {
    expect(Object.values(vsAiGames({}))).toEqual([undefined, undefined, undefined, undefined]);
  });
});
