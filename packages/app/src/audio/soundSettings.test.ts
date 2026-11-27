import { describe, expect, it } from "vitest";
import { memoryStore } from "../platform/storage.ts";
import type { KeyValueStore } from "../platform/storage.ts";
import { webAudio } from "../platform/audio.ts";
import type { AudioPlayer, SoundContext } from "../platform/audio.ts";
import { DEFAULT_SOUND, SOUND_KEY, parseSound, soundSettings } from "./soundSettings.ts";

/** A player that writes down what it is told. */
function toldPlayer(): AudioPlayer & { told: string[] } {
  const told: string[] = [];
  return {
    told,
    play: () => {},
    unlock: () => {},
    setVolume: (volume) => void told.push(`volume ${volume}`),
    setMuted: (muted) => void told.push(`muted ${muted}`),
  };
}

/** A store whose saved value arrives only when the test lets it. */
function slowStore(saved: string): { store: KeyValueStore; writes: string[]; arrive: () => Promise<void> } {
  const writes: string[] = [];
  let release: () => void = () => {};
  const read = new Promise<string>((resolve) => {
    release = () => resolve(saved);
  });
  const store: KeyValueStore = {
    get: () => read,
    set: (_key, value) => {
      writes.push(value);
      return Promise.resolve();
    },
    remove: () => Promise.resolve(),
  };
  return {
    store,
    writes,
    arrive: async () => {
      release();
      await read;
    },
  };
}

describe("the sound setting (#646)", () => {
  it("is unmuted at volume 80 for a new player", async () => {
    expect(DEFAULT_SOUND).toEqual({ muted: false, volume: 80 });
    const player = toldPlayer();
    const settings = soundSettings(memoryStore(), player);
    await settings.loaded;
    expect(settings.get()).toEqual(DEFAULT_SOUND);
    expect(player.told).toContain("volume 80");
    expect(player.told).toContain("muted false");
    expect(player.told).not.toContain("muted true");
  });

  it("keeps mute and volume under one key, and a later visit reads them back", async () => {
    const store = memoryStore();
    const first = soundSettings(store, toldPlayer());
    await first.loaded;
    first.set({ volume: 35 });
    first.set({ muted: true });
    expect(first.get()).toEqual({ muted: true, volume: 35 });
    expect(JSON.parse((await store.get(SOUND_KEY)) ?? "")).toEqual({ muted: true, volume: 35 });

    const player = toldPlayer();
    const later = soundSettings(store, player);
    await later.loaded;
    expect(later.get()).toEqual({ muted: true, volume: 35 });
    expect(player.told.slice(-2)).toEqual(["volume 35", "muted true"]);
  });

  it("tells the player each change at once", async () => {
    const player = toldPlayer();
    const settings = soundSettings(memoryStore(), player);
    await settings.loaded;
    player.told.length = 0;
    settings.set({ muted: true });
    expect(player.told).toEqual(["volume 80", "muted true"]);
  });

  it("tells its listeners of a change, until they stop listening", async () => {
    const settings = soundSettings(memoryStore(), toldPlayer());
    await settings.loaded;
    let heard = 0;
    const stop = settings.subscribe(() => (heard += 1));
    settings.set({ volume: 10 });
    expect(heard).toBe(1);
    stop();
    settings.set({ volume: 20 });
    expect(heard).toBe(1);
  });

  it("hands out the same value until something changes, as useSyncExternalStore needs", async () => {
    const settings = soundSettings(memoryStore(), toldPlayer());
    await settings.loaded;
    const before = settings.get();
    expect(settings.get()).toBe(before);
    settings.set({ volume: 10 });
    expect(settings.get()).not.toBe(before);
  });

  it("keeps the volume a whole number from 0 to 100, and ignores one that is no number", async () => {
    const settings = soundSettings(memoryStore(), toldPlayer());
    await settings.loaded;
    settings.set({ volume: 140 });
    expect(settings.get().volume).toBe(100);
    settings.set({ volume: -3 });
    expect(settings.get().volume).toBe(0);
    settings.set({ volume: 41.6 });
    expect(settings.get().volume).toBe(42);
    settings.set({ volume: Number.NaN });
    expect(settings.get().volume).toBe(42);
  });

  it("falls back to the default for stored text that is not a sound setting", () => {
    const bad = [
      null,
      "",
      "not json",
      "null",
      "7",
      "[]",
      "{}",
      '{"muted":"yes","volume":50}',
      '{"muted":false}',
      '{"muted":false,"volume":"50"}',
      '{"muted":false,"volume":101}',
      '{"muted":false,"volume":-1}',
      '{"muted":false,"volume":50.5}',
    ];
    for (const text of bad) expect(parseSound(text), String(text)).toEqual(DEFAULT_SOUND);
    expect(parseSound('{"muted":true,"volume":0}')).toEqual({ muted: true, volume: 0 });
  });

  it("starts at the default when the stored text is bad", async () => {
    const store = memoryStore();
    await store.set(SOUND_KEY, "{oops");
    const settings = soundSettings(store, toldPlayer());
    await settings.loaded;
    expect(settings.get()).toEqual(DEFAULT_SOUND);
  });

  it("a choice made before the saved one is read wins over it", async () => {
    const slow = slowStore('{"muted":false,"volume":10}');
    const player = toldPlayer();
    const settings = soundSettings(slow.store, player);
    settings.set({ muted: true });
    await slow.arrive();
    await settings.loaded;
    expect(settings.get()).toEqual({ muted: true, volume: 80 });
    expect(player.told.at(-1)).toBe("muted true");
    expect(slow.writes).toEqual(['{"muted":true,"volume":80}']);
  });

  it("muted means play does nothing, and unmuted it plays again", async () => {
    let started = 0;
    const context: SoundContext = {
      state: "running",
      destination: {},
      resume: () => Promise.resolve(),
      decodeAudioData: () => Promise.resolve({}),
      createGain: () => ({ gain: { value: 1 }, connect: () => {} }),
      createBufferSource: () => ({ buffer: null, connect: () => {}, start: () => (started += 1) }),
    };
    const audio = webAudio(
      { sounds: [{ id: "uiTap", file: "tap.ogg" }] },
      () => context,
      () => Promise.resolve(new ArrayBuffer(1)),
    );
    const settings = soundSettings(memoryStore(), audio);
    await settings.loaded;
    audio.unlock();
    await new Promise((resolve) => setTimeout(resolve, 0));
    settings.set({ muted: true });
    audio.play("uiTap");
    expect(started).toBe(0);
    settings.set({ muted: false });
    audio.play("uiTap");
    expect(started).toBe(1);
  });
});
