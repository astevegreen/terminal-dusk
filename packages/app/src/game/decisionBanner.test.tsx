// The decision banner and the glowing countries on the game screen (L7, #487): the question in a banner just above
// the hand strip, with the choices that are not countries; the countries the decision lists glow on the map, by
// name; nothing glows on a screen that cannot answer; and the sheet has no Play tab any more.
import type { Decision } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TAP_A_COUNTRY } from "../promptChoices.tsx";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { GameScreen } from "./GameScreen.tsx";
import type { GameScreenProps } from "./GameScreen.tsx";
import { baseFrame, withMap } from "./test/mapFixture.ts";

const asking = (decision: Decision): Frame => ({ ...withMap(baseFrame()), decision });
const html = (frame: Frame, extra: Partial<GameScreenProps> = {}): string =>
  renderToString(
    <GameScreen
      frame={frame}
      log={[]}
      era={null}
      label={cardName}
      question={cardQuestion}
      affiliation={cardAffiliation}
      {...extra}
    />,
  );
/** The banner's html, up to the bottom edge after it. */
const bannerOf = (out: string): string => {
  const start = out.indexOf('<section aria-label="Decision" data-testid="decision" class="game-banner">');
  const end = out.indexOf('<div class="game-bottom"', start);
  if (start < 0 || end < 0) throw new Error("no banner between the map and the bottom edge");
  return out.slice(start, end);
};
const glowing = (out: string): string[] =>
  [...out.matchAll(/<li class="dm-marker" data-country="([^"]+)"[^>]*data-pick="glow"/g)].map((m) => m[1]!);

const placing: Decision = {
  id: "d9",
  side: "lio",
  kind: "placeInfluence",
  options: { points: 3, countries: ["w2", "e1"] },
};
const realign: Decision = { id: "d9", side: "lio", kind: "realign", options: { attempts: 2, targets: ["w3"] } };
const menu: Decision = {
  id: "d9",
  side: "lio",
  kind: "chooseAction",
  options: { points: 2, actions: ["place", "intervene"], targets: ["e2"] },
};

describe("the decision banner (L7, #487)", () => {
  it("sits between the map and the bottom edge, with the question and a hint to tap a glowing country", () => {
    const banner = bannerOf(html(asking(placing), { onAnswer: () => {} }));
    expect(banner).toContain("LIO: place 1 influence (3 points left)");
    expect(banner).toContain(TAP_A_COUNTRY);
    expect(banner).not.toContain("<button");
  });
  it("keeps the choices that are not countries as buttons: Stop realigning, another action", () => {
    expect(bannerOf(html(asking(realign), { onAnswer: () => {} }))).toMatch(/<button[^>]*>Stop realigning<\/button>/);
    const actions = bannerOf(html(asking(menu), { onAnswer: () => {} }));
    expect(actions).toMatch(/<button[^>]*>Place influence<\/button>/);
    expect(actions).not.toContain("Intervene in");
  });
  it("shows a refusal in the banner", () => {
    expect(bannerOf(html(asking(placing), { onAnswer: () => {}, refusal: "too dear" }))).toContain("Refused: too dear");
  });
});

describe("the glowing countries on the game screen (L7, #487)", () => {
  it("glow exactly where the decision's options say: a placing, a realignment, an intervention", () => {
    expect(glowing(html(asking(placing), { onAnswer: () => {} })).sort()).toEqual(["e1", "w2"]);
    expect(glowing(html(asking(realign), { onAnswer: () => {} }))).toEqual(["w3"]);
    expect(glowing(html(asking(menu), { onAnswer: () => {} }))).toEqual(["e2"]);
  });
  it("are named after the choice and the country, never its id", () => {
    const out = html(asking(placing), { onAnswer: () => {} });
    expect(out).toContain('data-choice="Place in Cedaria"');
    expect(out).toContain('data-choice="Place in Birchmark"');
    expect(out).not.toMatch(/(Place|Intervene|Realign) in [we]\d/);
  });
  it("do not glow on a screen that cannot answer, which lists the choices by name in the banner instead", () => {
    const out = html(asking(placing));
    expect(glowing(out)).toEqual([]);
    expect(out).not.toContain("data-pick");
    expect(bannerOf(out)).toContain("<li>Place in Cedaria</li>");
  });
  it("leave the sheet with Details only: the decision is no longer a tab (and the log is in its drawer, L9)", () => {
    const out = html(asking(placing), { onAnswer: () => {} });
    const tabs = [...out.matchAll(/role="tab"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
    expect(tabs).toEqual(["Details"]);
  });
});
