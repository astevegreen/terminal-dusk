import type { GameEvent } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { GameScreen } from "../game/GameScreen.tsx";
import type { GameScreenProps } from "../game/GameScreen.tsx";
import { silentAudio } from "../platform/audio.ts";
import { ReplayView, spectatorFrame } from "../replay/ReplayScreen.tsx";
import type { ReplayRecording } from "../replay/recording.ts";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { createVsAiSession } from "../vsAi/session.ts";
import { playOut } from "../vsAi/test/scriptedHuman.ts";
import { standInAi } from "../vsAi/test/standInAi.ts";
import type { SoundId } from "./cues.ts";
import { eventSounds } from "./cues.ts";
import { EventSounds, playEventSounds } from "./useEventSounds.tsx";
import type { Heard, Pace } from "./useEventSounds.tsx";

let recording: ReplayRecording;
beforeAll(async () => {
  const standIn = standInAi();
  const clock = (): number => 1_700_000_000_000;
  const session = createVsAiSession({ human: "lio", gameSeed: "sound-seed", aiSeed: 5, clock, makeAi: standIn.makeAi });
  await playOut(session, standIn);
  const finished = session.replay();
  if (!finished) throw new Error("the fixture game did not leave a replay");
  recording = finished;
});

const shuffled: GameEvent = { kind: "drawPileReshuffled", visibility: "public", cards: 3 };
const passed: GameEvent = { kind: "playPassed", visibility: "public", side: "lio" };
// A kind with no sound. Only its kind matters here, so the rest of the event is left out.
const eraEnded = { kind: "modifierEnded" } as unknown as GameEvent;

/** A frame at `seq` holding `events`; the rest of it plays no part in the sounds. */
const frame = (seq: number, events: GameEvent[] = [shuffled], matchId = "m"): Frame =>
  ({ ...spectatorFrame(recording, recording.frames[0]!), matchId, seq, events }) as Frame;

/** Hands the frames to the rule one after another, as a screen would, and returns what each one played. */
function listen(frames: readonly Frame[], pace: Pace = "live"): SoundId[][] {
  let heard: Heard | null = null;
  return frames.map((next) => {
    const played: SoundId[] = [];
    heard = playEventSounds(heard, next, pace, { ...silentAudio(), play: (id) => void played.push(id) });
    return played;
  });
}

describe("which events make a sound, in a game", () => {
  it("is silent for the frame the screen opens on, which may hold the whole game so far", () => {
    expect(listen([frame(40, [shuffled, passed, shuffled])])).toEqual([[]]);
  });

  it("plays each new event's sound once, in order", () => {
    expect(listen([frame(1), frame(2, [passed, shuffled, shuffled])])).toEqual([[], ["notice", "shuffle", "shuffle"]]);
  });

  it("plays nothing for a re-render, or the same step shown to another viewer", () => {
    const second = frame(2, [passed]);
    const otherViewer: Frame = { ...second, viewer: "lio" };
    expect(listen([frame(1), second, second, { ...second }, otherViewer])).toEqual([[], ["notice"], [], [], []]);
  });

  it("plays nothing for an event whose entry is null", () => {
    expect(eventSounds.modifierEnded).toBeNull();
    expect(listen([frame(1), frame(2, [eraEnded, passed])])).toEqual([[], ["notice"]]);
  });

  it("plays every event of a frame that merges several steps, as an online poll can", () => {
    expect(listen([frame(1), frame(5, [passed, shuffled])])).toEqual([[], ["notice", "shuffle"]]);
  });

  it("is silent when the steps start over, and plays the new game from its next step", () => {
    expect(listen([frame(9), frame(0), frame(1, [passed])])).toEqual([[], [], ["notice"]]);
  });

  it("is silent for the first frame of another game", () => {
    expect(listen([frame(1), frame(7, [passed], "other"), frame(8, [passed], "other")])).toEqual([[], [], ["notice"]]);
  });
});

describe("which events make a sound, in a replay", () => {
  it("plays a step forward, and nothing for the opening step or a step back", () => {
    expect(listen([frame(0), frame(1, [passed]), frame(0), frame(1, [passed])], "step")).toEqual([
      [],
      ["notice"],
      [],
      ["notice"],
    ]);
  });

  it("plays nothing while it jumps ahead, and plays the step after the jump", () => {
    expect(listen([frame(0), frame(30), frame(31, [passed])], "step")).toEqual([[], [], ["notice"]]);
  });

  it("meets recorded steps that are numbered one after another, so Next always counts as one step", () => {
    const seqs = recording.frames.map((recorded) => recorded.seq);
    expect(seqs.length).toBeGreaterThan(2);
    expect(seqs).toEqual(seqs.map((_, index) => seqs[0]! + index));
  });
});

type Props = { children?: ReactNode };

/** The props of the first EventSounds element in a tree of elements, without drawing anything. */
function soundsOf(node: ReactNode): { frame: Frame; pace?: Pace } | null {
  if (Array.isArray(node)) return node.map(soundsOf).find((found) => found !== null) ?? null;
  if (!isValidElement(node)) return null;
  const element = node as ReactElement<Props>;
  if (element.type === EventSounds) return element.props as { frame: Frame; pace?: Pace };
  return soundsOf(element.props.children);
}

const screen = (extra: Partial<GameScreenProps> = {}) =>
  GameScreen({
    frame: frame(3),
    log: [],
    era: null,
    label: cardName,
    question: cardQuestion,
    affiliation: cardAffiliation,
    ...extra,
  });

describe("the game screen", () => {
  it("sounds the events of the frame it draws, as a live game", () => {
    expect(soundsOf(screen())).toMatchObject({ frame: { seq: 3 }, pace: undefined });
  });

  it("is given the replay's step pace by the replay viewer", () => {
    const view = ReplayView({
      recording,
      label: cardName,
      question: cardQuestion,
      affiliation: cardAffiliation,
      onClose: () => {},
      index: 1,
      onGo: () => {},
    }) as ReactElement<{ children: ReactElement<GameScreenProps> }>;
    const props = view.props.children.props;
    expect(props.soundPace).toBe("step");
    expect(soundsOf(GameScreen(props))).toMatchObject({ frame: { seq: recording.frames[1]!.seq }, pace: "step" });
  });
});
