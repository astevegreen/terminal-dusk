// Plays the sound of each new event on a game screen (#645). Sound follows the frame's events, never a comparison of
// two states, and each event sounds once.
import type { Frame } from "@terminal-dusk/host";
import { createContext, memo, useContext, useEffect, useRef } from "react";
import { silentAudio } from "../platform/audio.ts";
import type { AudioPlayer } from "../platform/audio.ts";
import { eventSounds } from "./cues.ts";

/** The app's player (main.tsx). A screen drawn without one is silent. */
export const AudioPlayerContext = createContext<AudioPlayer>(silentAudio());

/** The last frame a screen dealt with, by game and step. */
export type Heard = { matchId: string; seq: number };

/**
 * `live`: a game being played, where one frame may bring several steps at once (an online poll). `step`: a replay,
 * where only the next recorded step sounds, so jumping ahead or going back is silent.
 */
export type Pace = "live" | "step";

/**
 * Plays the sounds of `frame`'s events when they are new since `heard`, and returns what to remember. The first
 * frame a screen sees is silent: it can hold every event since the game began (an online game opened midway), and
 * a screen shown again, after a replay, must not sound its last move twice.
 */
export function playEventSounds(heard: Heard | null, frame: Frame, pace: Pace, audio: AudioPlayer): Heard {
  const isNew =
    heard !== null &&
    heard.matchId === frame.matchId &&
    (pace === "step" ? frame.seq === heard.seq + 1 : frame.seq > heard.seq);
  if (isNew) {
    for (const event of frame.events) {
      const id = eventSounds[event.kind];
      if (id !== null) audio.play(id);
    }
  }
  return { matchId: frame.matchId, seq: frame.seq };
}

export function useEventSounds(frame: Frame, pace: Pace = "live"): void {
  const audio = useContext(AudioPlayerContext);
  const heard = useRef<Heard | null>(null);
  useEffect(() => {
    heard.current = playEventSounds(heard.current, frame, pace, audio);
  }, [frame, pace, audio]);
}

function EventSoundsInner({ frame, pace }: { frame: Frame; pace?: Pace | undefined }): null {
  useEventSounds(frame, pace);
  return null;
}

/**
 * `useEventSounds` as an element, for a screen that is drawn without hooks of its own. Draws nothing. Wrapped in
 * `memo`, like TopBar: a memo element is not a plain function, so the test walkers that call function components
 * directly (testMode/promptTree.ts, online/test/screenTree.ts) step over its hooks.
 */
export const EventSounds = memo(EventSoundsInner);
