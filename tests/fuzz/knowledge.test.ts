// The fuzz checks for shown hands (#185): hiddenFrom lets a side see the rival cards it was shown, and only those;
// checkKnowledge catches knowledge that does not match the rival's hand and a shown hand sent to the wrong viewer.
import { createGame, seedHash } from "@terminal-dusk/engine";
import type { CardId, GameEvent, GameState, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkKnowledge, checkNoLeaks, hiddenFrom, knowledgeOf } from "./checks.ts";
import { ruleset } from "./play.ts";

const SEED = "knowledge-seed";
const SETUP = {
  seedHash: seedHash(SEED),
  hands: { lio: ["c1", "c4"], sae: ["c2", "c5", "c8"] },
  deck: ["c10"],
  turns: 1,
  playsPerTurn: 1,
  handSize: 2,
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
};

/** A new game with LIO knowing `lioKnows` of SAE's hand, and SAE's hand replaced by `saeHand` if given. */
function game(lioKnows: CardId[], saeHand?: CardId[]): GameState {
  const r = createGame(ruleset, SETUP, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  const s = JSON.parse(JSON.stringify(r.value.state)) as GameState;
  s.private.lio.knowledge = lioKnows;
  if (saeHand !== undefined) s.private.sae.hand = saeHand;
  return s;
}

/** The event a revealHand of `side`'s hand emits, showing `cards`; `to` and `count` forge it. */
function revealed(side: Side, cards: CardId[], to?: Side, count = cards.length): GameEvent {
  return {
    kind: "handRevealed",
    visibility: to ?? (side === "lio" ? "sae" : "lio"),
    side,
    cards,
    publicForm: { kind: "handRevealedHidden", visibility: "public", side, cards: count },
  };
}
const drawn = (side: Side, card: CardId): GameEvent => ({
  kind: "cardDrawn",
  visibility: side,
  side,
  card,
  publicForm: { kind: "cardDrawnHidden", visibility: "public", side },
});
const none = { lio: [], sae: [] };

describe("hiddenFrom and checkNoLeaks with knowledge", () => {
  it("a card in the viewer's own knowledge is no longer hidden from it; every other rival card still is", () => {
    const s = game(["c5"]);
    expect(hiddenFrom(s, "lio")).not.toContain("c5");
    expect(hiddenFrom(s, "lio")).toEqual(expect.arrayContaining(["c2", "c8"]));
    expect(hiddenFrom(s, "sae")).not.toContain("c5"); // SAE's own card
    expect(hiddenFrom(s, "spectator")).toContain("c5");
    expect(() => checkNoLeaks(s, [], SEED)).not.toThrow();
  });
  it("a view naming a rival card that is not in knowledge still fails checkNoLeaks", () => {
    const s = game(["c5"]);
    s.public.markers = ["c8"];
    expect(() => checkNoLeaks(s, [], SEED)).toThrow(/the view for 'lio' shows card "c8"/);
  });
  it("a shown card named to the spectator still fails checkNoLeaks", () => {
    const s = game(["c5"]);
    s.public.markers = ["c5"];
    expect(() => checkNoLeaks(s, [], SEED)).toThrow(/the view for 'spectator' shows card "c5"/);
  });
});

describe("checkKnowledge", () => {
  it("passes a reveal whose cards are all in the peeking side's knowledge, in the order known before", () => {
    const s = game(["c5", "c2", "c8"]);
    expect(() => checkKnowledge(s, [revealed("sae", ["c2", "c5", "c8"])], { lio: ["c5"], sae: [] })).not.toThrow();
  });
  it("passes a reveal of an empty hand, whose public form counts 0 cards", () => {
    const s = game([], []);
    expect(() => checkKnowledge(s, [revealed("sae", [])], none)).not.toThrow();
  });
  it("passes a revealed card that left the rival's hand later in the step, or left and was drawn again", () => {
    expect(() => checkKnowledge(game(["c2"], ["c2", "c8"]), [revealed("sae", ["c2", "c5"])], none)).not.toThrow();
    const again = [revealed("sae", ["c2", "c5"]), drawn("sae", "c2")];
    expect(() => checkKnowledge(game([], ["c2", "c8"]), again, { lio: ["c2"], sae: [] })).not.toThrow();
  });
  it("(a) fails a knowledge holding a card not in the rival's hand, or a card twice", () => {
    expect(() => checkKnowledge(game(["c4"]), [], none)).toThrow(
      /lio's knowledge holds \["c4"\], which are not in sae's hand/,
    );
    expect(() => checkKnowledge(game(["c5", "c5"]), [], none)).toThrow(/holds \["c5"\] more than once/);
  });
  it("(b) fails a knowledge missing a just-revealed card", () => {
    const s = game(["c2", "c5"]);
    expect(() => checkKnowledge(s, [revealed("sae", ["c2", "c5", "c8"])], none)).toThrow(
      /event 0 showed lio \["c8"\], still in sae's hand, but lio does not know them/,
    );
  });
  it("(c) fails a known card dropped while still in the rival's hand, and known cards reordered", () => {
    expect(() => checkKnowledge(game(["c5"]), [], { lio: ["c2", "c5"], sae: [] })).toThrow(/lio knew \["c2","c5"\]/);
    expect(() => checkKnowledge(game(["c5", "c2"]), [], { lio: ["c2", "c5"], sae: [] })).toThrow(/now knows them as/);
  });
  it("(c) passes a known card that left the rival's hand, or left it and was drawn again in the step", () => {
    expect(() => checkKnowledge(game(["c5"], ["c5", "c8"]), [], { lio: ["c2", "c5"], sae: [] })).not.toThrow();
    const s = game(["c5"]);
    expect(() => checkKnowledge(s, [drawn("sae", "c2")], { lio: ["c2", "c5"], sae: [] })).not.toThrow();
  });
  it("(d) fails a handRevealed sent to the shown side instead of the peeking side", () => {
    const s = game(["c2", "c5", "c8"]);
    expect(() => checkKnowledge(s, [revealed("sae", ["c2", "c5", "c8"], "sae")], none)).toThrow(
      /shows sae's hand to 'sae', not to the peeking side lio/,
    );
  });
  it("(d) fails a public form whose count is not the matching handRevealed's card count", () => {
    const s = game(["c2", "c5", "c8"]);
    expect(() => checkKnowledge(s, [revealed("sae", ["c2", "c5", "c8"], "lio", 2)], none)).toThrow(
      /'sae' gets .* for a shown hand, not only/,
    );
  });
  it("(d) compares the count with the event, not the hand after the step (a turn-end refill can follow)", () => {
    const s = game(["c2"], ["c2", "c5", "c8", "c10"]);
    expect(() => checkKnowledge(s, [revealed("sae", ["c2"]), drawn("sae", "c10")], none)).not.toThrow();
  });
  it("knowledgeOf gives each side's knowledge, for the next step's check", () => {
    expect(knowledgeOf(game(["c5"]))).toEqual({ lio: ["c5"], sae: [] });
  });
});
