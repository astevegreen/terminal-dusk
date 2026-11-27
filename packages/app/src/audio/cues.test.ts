import type { EventKind } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { eventSounds, SOUND_IDS, UI_CUES, uiSounds } from "./cues.ts";
import type { SoundId } from "./cues.ts";

/** What a cue may say: a known sound, or null for silence. */
const known = (sound: unknown): boolean => sound === null || (SOUND_IDS as readonly unknown[]).includes(sound);

describe("sound cues", () => {
  it("a missing EventKind key fails the type check", () => {
    const { cardDrawn, ...rest } = eventSounds;
    // @ts-expect-error: a map without cardDrawn's entry does not cover every event kind (hard rule 9).
    const incomplete: Record<EventKind, SoundId | null> = rest;
    expect(cardDrawn).toBe("cardDraw");
    expect(Object.keys(incomplete)).not.toContain("cardDrawn");
  });
  it("every event sound is a known SoundId or null", () => {
    expect(Object.entries(eventSounds).filter(([, sound]) => !known(sound))).toEqual([]);
  });
  it("every UI cue has an entry that is a known SoundId or null", () => {
    expect(Object.keys(uiSounds).sort()).toEqual([...UI_CUES].sort());
    expect(Object.entries(uiSounds).filter(([, sound]) => !known(sound))).toEqual([]);
  });
  it("lists each SoundId once", () => {
    expect(new Set(SOUND_IDS).size).toBe(SOUND_IDS.length);
  });
  it("has no SoundId that nothing plays, so the owner is never asked to approve an unused file", () => {
    const played = new Set<unknown>([...Object.values(eventSounds), ...Object.values(uiSounds)]);
    expect(SOUND_IDS.filter((id) => !played.has(id))).toEqual([]);
  });
  it("gives a drawn card the same sound whether or not the viewer may see which card", () => {
    expect(eventSounds.cardDrawnHidden).toBe(eventSounds.cardDrawn);
    expect(eventSounds.handRevealedHidden).toBe(eventSounds.handRevealed);
  });
});
