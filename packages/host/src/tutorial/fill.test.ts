// Filling tutorial lines from the live game (#699; docs/design/tutorial.md, "Numbers and places come from the live
// game"). Every frame here comes from a real first-deck tutorial game (test/tutorialGame.ts).
import { techRaceCost, type InfluenceEntry } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { firstDeckRuleset } from "../firstDeck.ts";
import { deepFreeze } from "../test/deepFreeze.ts";
import { inForce, learnerFrames, learnerFrameWhere, racingLio } from "../test/tutorialGame.ts";
import type { Frame } from "../types.ts";
import { fillLine, fillText } from "./fill.ts";

const fill = (words: string, frame: Frame) => fillText(words, frame, firstDeckRuleset);

/** The game's first frame: LIO holds Taiwan, nothing is in force, and the tech race starts at its first step. */
const start = deepFreeze(learnerFrames().next().value!);
/** LIO's second play of turn 1, with Maastricht's +1 for LIO and Handover of Hong Kong's -1 for SAE in force. */
const maastricht = deepFreeze(learnerFrameWhere((f) => inForce(f, "e1-lio-001") && f.decision?.kind === "playCardAs"));
/** A turn-4 frame with Rwandan Genocide's -2 for LIO and -1 for SAE in force. */
const rwanda = deepFreeze(learnerFrameWhere((f) => inForce(f, "e1-neu-001")));
/** A frame after LIO took the tech race's first step, with nothing in force: the next step costs LIO 2. */
const raced = deepFreeze(
  learnerFrameWhere((f) => techRaceCost(f.view.public, "lio") === 2 && f.view.public.modifiers.length === 0, racingLio),
);
/** The start frame with Taiwan's LIO influence set to 0 by hand (no seeded game reaches it): LIO holds nothing. */
const noInfluence: Frame = deepFreeze({
  ...start,
  view: {
    ...start.view,
    public: {
      ...start.view.public,
      influence: start.view.public.influence!.map((e: InfluenceEntry) =>
        e.country === "taiwan" ? { ...e, lio: 0 } : e,
      ),
    },
  },
});

describe("the frames these tests use", () => {
  it("are the moments the slots and conditions describe", () => {
    const mods = (f: Frame) => f.view.public.modifiers.map((m) => [m.source, m.mod.side, m.mod.add]);
    expect(mods(start)).toEqual([]);
    expect(mods(maastricht)).toEqual([
      ["e1-lio-014", "sae", -1],
      ["e1-lio-001", "lio", 1],
    ]);
    expect(mods(rwanda)).toEqual([
      ["e1-neu-001", "lio", -2],
      ["e1-neu-001", "sae", -1],
    ]);
    expect(mods(raced)).toEqual([]);
    expect([techRaceCost(start.view.public, "lio"), techRaceCost(raced.view.public, "lio")]).toEqual([1, 2]);
    expect(start.view.public.abilities?.sae).toMatchObject({ id: "unifiedCommand", ready: false });
  });
});

describe("each slot, filled from a real game frame", () => {
  it("cardPoints: a named card's points now, with a modifier in force", () => {
    // Freedom Agenda (e1-lio-002) is a 2-point card: 2 at the start, 3 with Maastricht's +1, 1 under Rwandan Genocide.
    expect(fill("{cardPoints:e1-lio-002}", start)).toBe("2");
    expect(fill("{cardPoints:e1-lio-002}", maastricht)).toBe("3");
    expect(fill("{cardPoints:e1-lio-006}", rwanda)).toBe("2");
    expect(fill("{cardPoints:e1-lio-012}", rwanda)).toBe("1");
  });

  it("pointsBefore and pointsAfter: a rival card whose event changes spends, played with its event first or last", () => {
    // Primakov's Turn (e1-sae-008, 1 point) takes 1 off LIO's spends, never below 1. With Maastricht's +1 in force,
    // its event first leaves 1 + 1 - 1 = 1; its points first give 1 + 1 = 2.
    expect(fill("{pointsBefore:e1-sae-008} then {pointsAfter:e1-sae-008}", maastricht)).toBe("1 then 2");
    expect(fill("{pointsBefore:e1-sae-008} then {pointsAfter:e1-sae-008}", start)).toBe("1 then 1");
  });

  it("modifierTakesOff: what a modifier in force takes off the learner's spends", () => {
    expect(fill("Rwandan Genocide takes off {modifierTakesOff:e1-neu-001}.", rwanda)).toBe(
      "Rwandan Genocide takes off 2.",
    );
    expect(fill("{modifierTakesOff:e1-lio-001}", maastricht)).toBe("-1");
  });

  it("techRaceCost: the cost of the tech race step the side would try", () => {
    expect(fill("It costs {techRaceCost:lio}.", start)).toBe("It costs 1.");
    expect(fill("It costs {techRaceCost:lio}.", raced)).toBe("It costs 2.");
    expect(fill("{techRaceCost:sae}", raced)).toBe("1");
  });

  it("eventPoints: the points a rival card's event gives its side when the learner plays it", () => {
    // Second Chechen War (e1-sae-004) gives SAE 2 when LIO plays it; Handover of Hong Kong's -1 for SAE stops at 1.
    expect(fill("would give SAE {eventPoints:e1-sae-004}", start)).toBe("would give SAE 2");
    expect(fill("would give SAE {eventPoints:e1-sae-004}", maastricht)).toBe("would give SAE 1");
  });

  it("influenceIn: the countries where LIO has influence, in map order", () => {
    expect(fill("({influenceIn:lio})", start)).toBe("(Taiwan)");
    const later = [...learnerFrames()].find((f) => f.view.public.turn === 2)!;
    expect(fill("({influenceIn:lio})", later)).toBe("(Japan, Taiwan)");
  });

  it("homeNeighbours: the countries next to LIO's home box", () => {
    expect(fill("next to the United States ({homeNeighbours:lio})", start)).toBe(
      "next to the United States (Mexico, Cuba, Canada)",
    );
  });
});

describe("each condition, picking its variant from a real game frame", () => {
  const chapter1 = {
    say:
      "You can place where you already have influence ({influenceIn:lio}), next to it, or next to the United States " +
      "({homeNeighbours:lio}).",
    variants: [
      {
        if: [{ kind: "noInfluence" as const, side: "lio" as const }],
        say: "You can place next to the United States ({homeNeighbours:lio}).",
      },
    ],
  };

  it("noInfluence: chapter 1 drops its own-influence part when LIO holds nothing", () => {
    expect(fillLine(chapter1, noInfluence, firstDeckRuleset)).toEqual({
      variant: 0,
      text: "You can place next to the United States (Mexico, Cuba, Canada).",
    });
    expect(fillLine(chapter1, start, firstDeckRuleset)).toEqual({
      variant: null,
      text: "You can place where you already have influence (Taiwan), next to it, or next to the United States (Mexico, Cuba, Canada).",
    });
  });

  it("modifierInForce: a variant for a turn with the named card's modifier in force", () => {
    const line = {
      say: "Plain.",
      variants: [{ if: [{ kind: "modifierInForce" as const, card: "e1-neu-001" }], say: "Smaller." }],
    };
    expect(fillLine(line, rwanda, firstDeckRuleset).text).toBe("Smaller.");
    expect(fillLine(line, maastricht, firstDeckRuleset).text).toBe("Plain.");
  });

  it("pointsBeforeEqualsAfter: a variant for when the rival card's event changes nothing", () => {
    const line = {
      say: "Event first: {pointsBefore:e1-sae-008}. Points first: {pointsAfter:e1-sae-008}.",
      variants: [{ if: [{ kind: "pointsBeforeEqualsAfter" as const, card: "e1-sae-008" }], say: "Same either way." }],
    };
    expect(fillLine(line, start, firstDeckRuleset).text).toBe("Same either way.");
    expect(fillLine(line, maastricht, firstDeckRuleset).text).toBe("Event first: 1. Points first: 2.");
  });

  it("pointsBelowTechRaceCost: a variant for a card that can't pay the next step", () => {
    const below = (card: string) => ({ kind: "pointsBelowTechRaceCost" as const, card, side: "lio" as const });
    const line = (card: string) => ({ say: "Race.", variants: [{ if: [below(card)], say: "Too few points." }] });
    // After the first step the next costs 2: a 1-point card can't pay it, Second Chechen War's 3 can.
    expect(fillLine(line("e1-lio-012"), raced, firstDeckRuleset).text).toBe("Too few points.");
    expect(fillLine(line("e1-sae-004"), raced, firstDeckRuleset).text).toBe("Race.");
    expect(fillLine(line("e1-lio-012"), start, firstDeckRuleset).text).toBe("Race.");
  });

  it("picks the first variant whose conditions all hold, and keeps that variant's own allow", () => {
    const allow = [{ kind: "placeInfluence" as const }];
    const line = {
      say: "Plain.",
      variants: [
        {
          if: [
            { kind: "modifierInForce" as const, card: "e1-neu-001" },
            { kind: "noInfluence" as const, side: "lio" as const },
          ],
          say: "Both.",
        },
        { if: [{ kind: "modifierInForce" as const, card: "e1-neu-001" }], say: "One.", allow },
      ],
    };
    expect(fillLine(line, rwanda, firstDeckRuleset)).toEqual({ variant: 1, text: "One.", allow });
  });
});

describe("a line the frame and content cannot fill", () => {
  it("throws, never shows blank or wrong text", () => {
    expect(() => fill("{modifierTakesOff:e1-neu-001}", start)).toThrow(/no modifier of e1-neu-001/);
    expect(() => fill("({influenceIn:lio})", noInfluence)).toThrow(/names no country/);
    expect(() => fill("{score:lio}", start)).toThrow(/unknown slot "score"/);
    expect(() => fill("{techRaceCost:usa}", start)).toThrow(/not a side/);
    expect(() => fill("{cardPoints:e9-lio-001}", start)).toThrow(/no card e9-lio-001/);
    expect(() => fill("a { b", start)).toThrow(/never closes/);
    expect(() => fill("{eventPoints:e1-sae-001}", start)).toThrow(/trigger step/);
  });

  it("throws for a frame from another ruleset, or a spectator's frame", () => {
    expect(() => fill("{cardPoints:e1-lio-002}", { ...start, ruleset: "other" })).toThrow(/ruleset other/);
    expect(() => fill("{cardPoints:e1-lio-002}", { ...start, viewer: "spectator" })).toThrow(/spectator/);
    expect(() => fill("No slots.", { ...start, ruleset: "other" })).toThrow(/ruleset other/);
    const plain = {
      say: "No slots.",
      variants: [{ if: [{ kind: "pointsBeforeEqualsAfter" as const, card: "e1-sae-008" }], say: "x" }],
    };
    expect(() => fillLine(plain, { ...start, ruleset: "other" }, firstDeckRuleset)).toThrow(/ruleset other/);
  });
});

describe("hidden cards", () => {
  it("never names a card or number hidden from the learner: SAE's hand is not in the frame, and filling reads only its public part", () => {
    const saeHand = [...learnerFrames()][0]!; // the learner's own frame never holds SAE's hand
    const hidden = ["e1-sae-002", "e1-sae-003", "e1-sae-005", "e1-sae-006", "e1-sae-007"];
    for (const id of hidden) expect(JSON.stringify(saeHand)).not.toContain(id);
    const line =
      "{cardPoints:e1-lio-002} {pointsBefore:e1-sae-008} {pointsAfter:e1-sae-008} {eventPoints:e1-sae-004} " +
      "{techRaceCost:lio} ({influenceIn:lio}) ({homeNeighbours:lio})";
    const publicOnly = deepFreeze({ ...maastricht, view: { public: maastricht.view.public } } as unknown as Frame);
    const text = fill(line, maastricht);
    expect(text).toBe("3 1 2 1 1 (Japan, Taiwan) (Mexico, Cuba, Canada)");
    expect(fill(line, publicOnly)).toBe(text);
    for (const id of hidden) expect(text).not.toContain(id);
  });
});
