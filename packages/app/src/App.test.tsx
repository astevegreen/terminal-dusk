import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FIRST_DECK_NOTE,
  firstDeckCardName,
  firstDeckCardQuestion,
  firstDeckConfig,
  firstDeckRuleset,
} from "@terminal-dusk/host/first-deck";
import { App, onlineRoute } from "./App.tsx";
import { OnlineScreen } from "./online/OnlineScreen.tsx";
import { fakeTimers } from "./transport/test/remoteGame.ts";
import { createLocalMatch } from "./transport/localMatch.ts";
import type { VsAiGame } from "./vsAi/VsAiScreen.tsx";

describe("App placeholder screen", () => {
  it("shows the game's name", () => {
    expect(renderToString(<App clock={() => 0} newSeed={() => "s"} newAiSeed={() => 1} />)).toContain("Terminal Dusk");
  });
});

describe("the online route", () => {
  const game: VsAiGame = {
    ruleset: firstDeckRuleset,
    makeMatch: (seed, clock) => createLocalMatch(firstDeckRuleset, firstDeckConfig(), seed, clock),
    cardName: firstDeckCardName,
    cardQuestion: firstDeckCardQuestion,
    cardAffiliation: () => undefined,
    note: FIRST_DECK_NOTE,
  };
  it("hands OnlineScreen the game's card names and questions, the clock, the timers and Back", () => {
    const clock = () => 0;
    const timers = fakeTimers();
    const onBack = () => {};
    const route = onlineRoute({ clock, game, timers }, onBack);
    expect(route.type).toBe(OnlineScreen);
    expect(route.props.label).toBe(firstDeckCardName);
    expect(route.props.question).toBe(firstDeckCardQuestion);
    expect(route.props.clock).toBe(clock);
    expect(route.props.timers).toBe(timers);
    expect(route.props.onBack).toBe(onBack);
  });
  it("leaves the names and questions out when the app has no game, so OnlineScreen uses its default", () => {
    const route = onlineRoute({ clock: () => 0, timers: fakeTimers() }, () => {});
    expect(route.props.label).toBeUndefined();
    expect(route.props.question).toBeUndefined();
  });
});
