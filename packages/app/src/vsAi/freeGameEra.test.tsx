// The era line on turn 1 of a free game (#669). The free tutorial plays the free game's numbers on the six-region
// map, so its frame has an era from the start. The free game against the AI has no map, so its frame has none.
import { TUTORIAL_LESSONS } from "@terminal-dusk/host";
import { ERA_1_FREE_NOTE, era1FreeConfig, firstDeckCardName, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardAffiliation, cardQuestion } from "../testMode/fixture.ts";
import { createLocalMatch } from "../transport/localMatch.ts";
import { createTutorialSession } from "../tutorial/tutorialSession.ts";
import { TutorialGame } from "../tutorial/TutorialScreen.tsx";
import { createVsAiSession } from "./session.ts";
import { flush } from "./test/scriptedHuman.ts";
import { standInAi } from "./test/standInAi.ts";
import { Game, vsAiOptions } from "./VsAiScreen.tsx";
import type { VsAiGame } from "./VsAiScreen.tsx";

const clock = (): number => 1_700_000_000_000;

describe("the era line on turn 1 of a free game (#669)", () => {
  it("the free tutorial names Era 1", async () => {
    const lesson = TUTORIAL_LESSONS[0]!;
    const started = createTutorialSession({
      lesson,
      edition: "free",
      clock,
      newSeed: () => "free-era-seed",
      newAiSeed: () => 5,
      makeAi: standInAi().makeAi,
    });
    await flush();
    const out = renderToString(<TutorialGame lesson={lesson} started={started} edition="free" onNewGame={() => {}} />);
    expect(out).toContain("<span>Turn 1 of 3</span>");
    expect(out).toContain("<span>The Thaw (Era 1, 1991–2001)</span>");
    expect(out).not.toContain("Era not shown yet");
    started.session.stop();
  });

  it("the free game against the AI, which has no map, still says the era is not shown yet", async () => {
    const free: VsAiGame = {
      ruleset: firstDeckRuleset,
      makeMatch: (seed, now) => createLocalMatch(firstDeckRuleset, era1FreeConfig(), seed, now),
      cardName: firstDeckCardName,
      cardQuestion,
      cardAffiliation,
      note: ERA_1_FREE_NOTE,
    };
    const setup = { clock, newSeed: () => "free-era-seed", newAiSeed: () => 5, makeAi: standInAi().makeAi, game: free };
    const session = createVsAiSession(vsAiOptions("lio", setup));
    await flush();
    expect(session.getSnapshot().frame!.view.public.era).toBeUndefined();
    const out = renderToString(<Game session={session} onNewGame={() => {}} game={free} />);
    expect(out).toContain("<span>Turn 1 of 3</span>");
    expect(out).toContain("<span>Era not shown yet</span>");
    session.stop();
  });
});
