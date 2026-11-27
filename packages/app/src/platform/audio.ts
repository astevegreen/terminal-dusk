// The `audio` part of the Platform interface (docs/architecture.md, Decision 7): plays the manifest's sound files by
// sound id. Browsers keep sound off until the player has touched the page, so nothing plays before `unlock`. Sound is
// never needed to play: no call on a player ever throws or rejects, and whatever fails is just silent.
import type { SoundId } from "../audio/cues.ts";

export type AudioPlayer = {
  /** Plays the sound's file now. Silent when muted, before unlock, or when the manifest has no file for the id. */
  play(id: SoundId): void;
  /** Called on a tap or key press: starts the sound, or starts it again after the browser stopped it. */
  unlock(): void;
  /** 0 (silent) to 100 (full). */
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
};

/** The sound manifest (packages/content, `soundManifest`): which file in `sounds/` plays each id. */
export type SoundFiles = { sounds: readonly { id: string; file: string }[] };

type SoundGain = { gain: { value: number }; connect(to: unknown): unknown };
type SoundSource = { buffer: unknown; connect(to: unknown): unknown; start(): void };

/** The part of the browser's `AudioContext` that `webAudio` uses. */
export type SoundContext = {
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  createGain(): SoundGain;
  createBufferSource(): SoundSource;
};

type LoadSound = (url: string) => Promise<ArrayBuffer>;

const fetchSound: LoadSound = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`no sound file at ${url}`);
  return response.arrayBuffer();
};

/** A player that makes no sound, for tests and for a screen given no player. */
export function silentAudio(): AudioPlayer {
  return { play: () => {}, unlock: () => {}, setVolume: () => {}, setMuted: () => {} };
}

/**
 * A player over the browser's Web Audio. The context is made, and the manifest's files (and only those) are loaded,
 * on the first `unlock`. A sound asked for while the browser holds the context stopped is dropped, never saved up.
 */
export function webAudio(manifest: SoundFiles, makeContext: () => SoundContext, load = fetchSound): AudioPlayer {
  let open: { context: SoundContext; output: SoundGain } | null = null;
  let volume = 100;
  let muted = false;
  const buffers = new Map<string, unknown>();

  const applyLevel = (): void => {
    if (open) open.output.gain.value = muted ? 0 : volume / 100;
  };

  /** A file that is missing or is no sound leaves its id silent; it is not asked for again. */
  async function loadOne(context: SoundContext, id: string, file: string): Promise<void> {
    try {
      buffers.set(id, await context.decodeAudioData(await load(`sounds/${file}`)));
    } catch {
      // Nothing to do: this id stays silent.
    }
  }

  async function resume(context: SoundContext): Promise<void> {
    try {
      await context.resume();
    } catch {
      // Nothing to do: the next tap or key press tries again.
    }
  }

  function start(): SoundContext | null {
    if (open) return open.context;
    try {
      const context = makeContext();
      const output = context.createGain();
      output.connect(context.destination);
      open = { context, output };
    } catch {
      return null; // This browser has no sound.
    }
    applyLevel();
    for (const { id, file } of manifest.sounds) void loadOne(open.context, id, file);
    return open.context;
  }

  return {
    play: (id) => {
      const buffer = buffers.get(id);
      if (muted || open === null || buffer === undefined || open.context.state !== "running") return;
      try {
        const source = open.context.createBufferSource();
        source.buffer = buffer;
        source.connect(open.output);
        source.start();
      } catch {
        // Nothing to do: this one sound is lost.
      }
    },
    unlock: () => {
      const context = start();
      if (context && context.state !== "running") void resume(context);
    },
    setVolume: (next) => {
      if (!Number.isFinite(next)) return;
      volume = Math.min(100, Math.max(0, next));
      applyLevel();
    },
    setMuted: (next) => {
      muted = next;
      applyLevel();
    },
  };
}

/**
 * Unlocks the sound on the player's taps and key presses, for as long as the page is open: the browser can stop the
 * sound again (a phone call, the app left in the background). A finger tap lets a browser start sound only as it
 * lifts, so `pointerup` is listened for beside `pointerdown`. Listens before the page's own handlers, so one of
 * them stopping an event does not stop the unlock.
 */
export function unlockOnGesture(target: Pick<EventTarget, "addEventListener">, audio: AudioPlayer): void {
  const unlock = (): void => audio.unlock();
  for (const type of ["pointerdown", "pointerup", "keydown"]) target.addEventListener(type, unlock, { capture: true });
}
