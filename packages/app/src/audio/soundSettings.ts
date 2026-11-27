// The player's sound setting (#646): muted or not, and how loud. It is kept in Platform.storage under one key, and
// every value is told to the AudioPlayer, so what the controls show is what plays.
import type { AudioPlayer } from "../platform/audio.ts";
import type { KeyValueStore } from "../platform/storage.ts";

/** `volume` is a whole number from 0 (silent) to 100 (full). */
export type SoundSetting = Readonly<{ muted: boolean; volume: number }>;

export const DEFAULT_SOUND: SoundSetting = { muted: false, volume: 80 };

export const SOUND_KEY = "sound.settings";

function isSetting(value: unknown): value is SoundSetting {
  if (typeof value !== "object" || value === null) return false;
  const { muted, volume } = value as Record<string, unknown>;
  return (
    typeof muted === "boolean" && typeof volume === "number" && Number.isInteger(volume) && volume >= 0 && volume <= 100
  );
}

/** The saved setting; the default when nothing is saved or the saved text is not a sound setting. */
export function parseSound(text: string | null): SoundSetting {
  try {
    const saved: unknown = JSON.parse(text ?? "null");
    if (isSetting(saved)) return { muted: saved.muted, volume: saved.volume };
  } catch {
    // Not JSON: the default.
  }
  return DEFAULT_SOUND;
}

export type SoundSettings = {
  /** The setting now; the same object until it changes. */
  get(): SoundSetting;
  /** Changes the setting, tells the player and saves it. A volume that is no number is ignored. */
  set(change: Partial<SoundSetting>): void;
  /** Calls `listener` after each change; the returned function stops it. */
  subscribe(listener: () => void): () => void;
  /** Settles once the saved setting has been read. */
  loaded: Promise<void>;
};

const whole = (volume: number | undefined, before: number): number =>
  volume === undefined || !Number.isFinite(volume) ? before : Math.round(Math.min(100, Math.max(0, volume)));

export function soundSettings(store: KeyValueStore, audio: AudioPlayer): SoundSettings {
  let current = DEFAULT_SOUND;
  // A choice made before the saved setting is read wins over it.
  let chosen = false;
  const listeners = new Set<() => void>();

  const apply = (next: SoundSetting): void => {
    current = next;
    audio.setVolume(next.volume);
    audio.setMuted(next.muted);
    for (const listener of listeners) listener();
  };

  async function load(): Promise<void> {
    const saved = await store.get(SOUND_KEY);
    if (!chosen) apply(parseSound(saved));
  }

  apply(DEFAULT_SOUND);
  return {
    get: () => current,
    set: (change) => {
      chosen = true;
      apply({ muted: change.muted ?? current.muted, volume: whole(change.volume, current.volume) });
      void store.set(SOUND_KEY, JSON.stringify(current));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    loaded: load(),
  };
}
