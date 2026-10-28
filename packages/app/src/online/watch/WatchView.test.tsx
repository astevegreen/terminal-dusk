// The watch screen drawn from real snapshots of a watched game: read-only board, spectator wording, and a
// finished game handing over to its replay.
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameScreen } from "../../game/GameScreen.tsx";
import type { GameScreenProps } from "../../game/GameScreen.tsx";
import { cardAffiliation, cardName, cardQuestion } from "../../testMode/fixture.ts";
import { settle } from "../../transport/test/remoteGame.ts";
import { onlineRig } from "../test/onlineRig.ts";
import { watchText, WatchView } from "./WatchView.tsx";
import type { OnlineGameSnapshot } from "../onlineGame.ts";

const base = { label: cardName, question: cardQuestion, affiliation: cardAffiliation, onBack: () => undefined };

function gameScreenIn(node: ReactNode): ReactElement<GameScreenProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = gameScreenIn(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (node.type === GameScreen) return node as ReactElement<GameScreenProps>;
  return gameScreenIn((node.props as { children?: ReactNode }).children);
}

async function snapshots() {
  const r = onlineRig("carol");
  await settle();
  const live = r.game.getSnapshot();
  r.fake.commit({ player: "bob", resign: true });
  r.timers.fire();
  await settle();
  return { live, over: r.game.getSnapshot() };
}

describe("WatchView", () => {
  it("says who is being waited for and gives the board no way to answer", async () => {
    const { live } = await snapshots();
    expect(watchText(live)).toMatch(/^Waiting for /);
    const tree = WatchView({ snapshot: live, replay: null, ...base });
    const screen = gameScreenIn(tree);
    expect(screen).not.toBeNull();
    expect(screen!.props.onAnswer).toBeUndefined();
    expect(renderToString(tree)).toContain("Watching");
  });

  it("names the winner by side, never 'You won'", async () => {
    const { over } = await snapshots();
    expect(over.turn).toBe("over");
    const text = watchText(over);
    expect(text).toMatch(/^Game over/);
    expect(text).not.toMatch(/You/);
  });

  it("loading shows only the header", () => {
    const loading: OnlineGameSnapshot = {
      frame: null,
      log: [],
      era: null,
      turn: "loading",
      deadline: null,
      refusal: null,
    };
    const tree = WatchView({ snapshot: loading, replay: null, ...base });
    expect(gameScreenIn(tree)).toBeNull();
    expect(watchText(loading)).toBe("Loading the game");
  });

  it("a finished game shows the final board and says the replay is not ready when there is none", async () => {
    const { over } = await snapshots();
    const out = renderToString(WatchView({ snapshot: over, replay: "none", ...base }));
    expect(out).toContain("The replay is not available yet.");
  });
});
