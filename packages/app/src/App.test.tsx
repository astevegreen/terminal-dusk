import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FIRST_DECK_NOTE,
  firstDeckCardName,
  firstDeckCardQuestion,
  firstDeckConfig,
  firstDeckRuleset,
} from "@terminal-dusk/host/first-deck";
import { App, Home, onlineRoute } from "./App.tsx";
import { button, treeOf } from "./online/test/screenTree.ts";
import { OnlineScreen } from "./online/OnlineScreen.tsx";
import { fakeTimers } from "./transport/test/remoteGame.ts";
import { createLocalMatch } from "./transport/localMatch.ts";
import type { VsAiGame } from "./vsAi/VsAiScreen.tsx";

describe("App placeholder screen", () => {
  it("shows the game's name", () => {
    expect(renderToString(<App clock={() => 0} newSeed={() => "s"} newAiSeed={() => 1} />)).toContain("Terminal Dusk");
  });
});

describe("the home screen", () => {
  it("offers the six-region map against the AI as its own button, which opens the vsAiMap screen (#439)", () => {
    const picked: string[] = [];
    const tree = treeOf(<Home onPick={(screen) => picked.push(screen)} />);
    expect(tree.buttons.map((b) => b.text)).toEqual([
      "Play against the AI",
      "Play the six-region map",
      "Play online",
      "Test mode",
    ]);
    button(tree, "Play the six-region map").press();
    button(tree, "Play against the AI").press();
    expect(picked).toEqual(["vsAiMap", "vsAi"]);
  });
});

describe("the online route", () => {
  const game: VsAiGame = {
    ruleset: firstDeckRuleset,
    makeMatch: (seed, clock) => createLocalMatch(firstDeckRuleset, firstDeckConfig(), seed, clock),
    cardName: firstDeckCardName,
    cardQuestion: firstDeckCardQuestion,
    cardRules: () => "rules",
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
    expect(route.props.rules).toBe(game.cardRules);
    expect(route.props.clock).toBe(clock);
    expect(route.props.timers).toBe(timers);
    expect(route.props.onBack).toBe(onBack);
  });
  it("leaves the names and questions out when the app has no game, so OnlineScreen uses its default", () => {
    const route = onlineRoute({ clock: () => 0, timers: fakeTimers() }, () => {});
    expect(route.props.label).toBeUndefined();
    expect(route.props.question).toBeUndefined();
    expect(route.props.rules).toBeUndefined();
  });
});
