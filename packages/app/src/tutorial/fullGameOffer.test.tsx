// The free player's tutorial ends at Era 1 with the Full Game offer; an owner's plays on (#647).
import { TUTORIAL_LESSONS } from "@terminal-dusk/host";
import type { TutorialEdition } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { flush } from "../vsAi/test/scriptedHuman.ts";
import { standInAi } from "../vsAi/test/standInAi.ts";
import { tutorialEdition } from "./edition.ts";
import { FullGameOffer, OFFER_BUY, OFFER_PLACEHOLDER_LABEL, OFFER_TEXT } from "./FullGameOffer.tsx";
import { playUntil, pub } from "./test/playTutorial.ts";
import { createTutorialSession } from "./tutorialSession.ts";
import type { TutorialSession } from "./tutorialSession.ts";
import { TutorialGame } from "./TutorialScreen.tsx";

const clock = (): number => 1_700_000_000_000;
const lesson = TUTORIAL_LESSONS[0]!;
const web = { platform: "web", source: "checkout" } as const;

const start = (edition: TutorialEdition): TutorialSession =>
  createTutorialSession({
    lesson,
    edition,
    clock,
    newSeed: () => "full-game-offer-seed",
    newAiSeed: () => 5,
    makeAi: standInAi().makeAi,
  });

const draw = (s: TutorialSession, edition: TutorialEdition) =>
  renderToString(<TutorialGame lesson={lesson} started={s} edition={edition} onNewGame={() => {}} />);

describe("which edition the tutorial is", () => {
  it("is the free edition with no entitlements", () => {
    expect(tutorialEdition()).toBe("free");
    expect(tutorialEdition({ owned: [], platform: "web" })).toBe("free");
  });
  it("is the full edition with an entitlement for the platform", () => {
    expect(tutorialEdition({ owned: [web], platform: "web" })).toBe("full");
  });
  it("is the free edition with an entitlement for another platform only", () => {
    expect(tutorialEdition({ owned: [web], platform: "steam" })).toBe("free");
  });
});

describe("the end of the tutorial's game", () => {
  it("free edition: the game is over after turn 3, and the end view shows the result and the Full Game offer", async () => {
    const started = start("free");
    await playUntil(started, (s) => pub(s).status.kind === "over");
    expect(pub(started).turn).toBe(3);
    const out = draw(started, "free");
    expect(out).toContain("Game over: ");
    expect(out).toContain(OFFER_TEXT);
    expect(out).toContain(OFFER_PLACEHOLDER_LABEL);
    expect(out).toMatch(new RegExp(`<button[^>]*disabled[^>]*>${OFFER_BUY}</button>`));
    // The offer comes before the end buttons, so it is read first.
    expect(out.indexOf(OFFER_TEXT)).toBeLessThan(out.indexOf("New game"));
    started.session.stop();
  });

  it("full edition: the match goes on into turn 4, and no offer is shown", async () => {
    const started = start("full");
    await playUntil(started, (s) => pub(s).turn === 4);
    expect(pub(started).status.kind).toBe("active");
    expect(draw(started, "full")).not.toContain(OFFER_TEXT);
    started.session.stop();
  });

  it("no offer while a free game still runs", async () => {
    const started = start("free");
    await flush();
    expect(pub(started).status.kind).toBe("active");
    expect(draw(started, "free")).not.toContain(OFFER_TEXT);
    started.session.stop();
  });
});

describe("the Full Game offer", () => {
  it("labels its placeholder words and shows a 44 px buy button that cannot be tapped yet", () => {
    const out = renderToString(<FullGameOffer />);
    expect(out).toContain(OFFER_PLACEHOLDER_LABEL);
    expect(out).toMatch(/<button[^>]*disabled/);
    expect(out).toContain("min-height:44px");
  });
});
