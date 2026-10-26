import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { buttonsOf } from "../testMode/promptTree.ts";
import { logLine } from "../testMode/session.ts";
import { createVsAiSession } from "../vsAi/session.ts";
import { playOut } from "../vsAi/test/scriptedHuman.ts";
import { standInAi } from "../vsAi/test/standInAi.ts";
import { ReplayView } from "./ReplayScreen.tsx";
import type { ReplayRecording } from "./recording.ts";

const GAME_SEED = "replay-seed-never-shown-5d20";
const clock = (): number => 1_700_000_000_000;

let recording: ReplayRecording;
beforeAll(async () => {
  const standIn = standInAi();
  const session = createVsAiSession({ human: "lio", gameSeed: GAME_SEED, aiSeed: 5, clock, makeAi: standIn.makeAi });
  await playOut(session, standIn);
  const finished = session.replay();
  if (!finished) throw new Error("the fixture game did not leave a replay");
  recording = finished;
});

const view = (index: number, onGo: (i: number) => void = () => {}, onClose: () => void = () => {}) => (
  <ReplayView
    recording={recording}
    label={cardName}
    question={cardQuestion}
    affiliation={cardAffiliation}
    onClose={onClose}
    index={index}
    onGo={onGo}
  />
);
const html = (index: number): string => renderToString(view(index));
const disabled = (out: string, name: string): boolean =>
  new RegExp(`<button[^>]*disabled=""[^>]*>${name}</button>`).test(out);
const lines = (upTo: number): string[] => recording.frames.slice(0, upTo + 1).flatMap((f) => f.events.map(logLine));
/** Presses the named button of the viewer at `index` and returns the step it asked to go to (or null). */
function press(index: number, name: string): number | null {
  let went: number | null = null;
  const button = buttonsOf(view(index, (i) => (went = i))).find((b) => b.text === name);
  button?.click();
  return went;
}

describe("the replay viewer on a finished fixture game", () => {
  it("starts at Step 1 with First and Back disabled and Next and Last enabled", () => {
    const out = html(0);
    expect(out).toContain(`Step 1 of ${recording.frames.length}`);
    expect(disabled(out, "First")).toBe(true);
    expect(disabled(out, "Back")).toBe(true);
    expect(disabled(out, "Next")).toBe(false);
    expect(disabled(out, "Last")).toBe(false);
  });

  it("has First, Back, Next, Last and Close buttons of at least 44 px", () => {
    const out = html(1);
    for (const name of ["First", "Back", "Next", "Last", "Close"]) {
      expect(out).toMatch(new RegExp(`min-height:44px;min-width:44px"[^>]*>${name}</button>`));
    }
  });

  it("Next, Back, First, Last and Close ask for the right step", () => {
    const last = recording.frames.length - 1;
    expect(press(0, "Next")).toBe(1);
    expect(press(2, "Back")).toBe(1);
    expect(press(2, "First")).toBe(0);
    expect(press(1, "Last")).toBe(last);
    let closed = false;
    buttonsOf(
      view(
        0,
        () => {},
        () => (closed = true),
      ),
    )
      .find((b) => b.text === "Close")
      ?.click();
    expect(closed).toBe(true);
  });

  it("shows each step's turn and plays, and a log that grows going forward and shrinks going back", () => {
    for (let i = 0; i < recording.frames.length; i++) {
      const pub = recording.frames[i]!.view.public;
      const out = html(i);
      expect(out).toContain(`Turn ${pub.turn} of ${pub.turns}`);
      expect(out).toContain(`Plays made: ${pub.playsMade} of ${pub.playsPerTurn}`);
      expect(out).toContain(`Step ${i + 1} of ${recording.frames.length}`);
    }
    const grows = recording.frames.findIndex((f, i) => i > 0 && f.events.length > 0);
    expect(grows).toBeGreaterThan(0);
    const newLine = logLine(recording.frames[grows]!.events[0]!);
    expect(html(grows)).toContain(newLine);
    expect(html(grows - 1)).not.toContain(`>${newLine}<`);
    // Newest first: the last line of the shown steps comes before the first.
    const shown = lines(recording.frames.length - 1);
    const out = html(recording.frames.length - 1);
    expect(out.indexOf(shown.at(-1)!)).toBeLessThan(out.indexOf(shown[0]!));
  });

  it("shows both hands by name at every step", () => {
    for (let i = 0; i < recording.frames.length; i++) {
      const out = html(i);
      expect(out).toContain("LIO hand");
      expect(out).toContain("SAE hand");
      for (const side of ["lio", "sae"] as const) {
        for (const card of recording.frames[i]!.view.sides[side].hand) expect(out).toContain(cardName(card));
      }
    }
  });

  it("follows the era events: not shown yet before the first, then the latest one", () => {
    // The fixture game has no eras, so two eraStarted events are added to copies of its frames (2 and 4).
    const eraEvent = (era: string) => ({ kind: "eraStarted", visibility: "public", era, cardsAdded: 3 }) as const;
    const withEras: ReplayRecording = {
      ...recording,
      frames: recording.frames.map((f, i) =>
        i === 2
          ? { ...f, events: [...f.events, eraEvent("early")] }
          : i === 4
            ? { ...f, events: [...f.events, eraEvent("late")] }
            : f,
      ),
    };
    const at = (index: number): string =>
      renderToString(
        <ReplayView
          recording={withEras}
          label={cardName}
          question={cardQuestion}
          affiliation={cardAffiliation}
          onClose={() => {}}
          index={index}
          onGo={() => {}}
        />,
      );
    for (const i of [0, 1]) expect(at(i)).toContain("Era not shown yet");
    for (const i of [2, 3]) expect(at(i)).toContain("Era: early");
    expect(at(4)).toContain("Era: late");
    expect(at(2)).not.toContain("Era not shown yet");
    expect(at(recording.frames.length - 1)).toContain("Era: late");
    // Stepping back before the first era event goes back to "not shown yet".
    expect(at(1)).not.toContain("Era: early");
  });

  it("says Game active before the last step, then the final status and the seed hash at the last", () => {
    const last = recording.frames.length - 1;
    for (let i = 0; i < last; i++) {
      const out = html(i);
      expect(out).toContain("Game active");
      expect(out).not.toContain("Seed checked");
      expect(out).not.toContain("Game over");
    }
    const out = html(last);
    expect(out).toContain("Game over");
    expect(out).toContain(`Seed checked: ${recording.seedHash}`);
    expect(out).not.toContain("Game active");
    expect(disabled(out, "Next")).toBe(true);
    expect(disabled(out, "Last")).toBe(true);
    expect(disabled(out, "Back")).toBe(false);
  });

  it("never renders the game seed", () => {
    for (let i = 0; i < recording.frames.length; i++) expect(html(i)).not.toContain(GAME_SEED);
  });
});
