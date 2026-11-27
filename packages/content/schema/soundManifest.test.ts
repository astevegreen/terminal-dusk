import { describe, expect, it } from "vitest";
import { soundManifestSchema } from "./soundManifest.ts";

// A made-up entry: no real sound file exists. The owner approves each one before it is listed.
const entry = {
  id: "uiTap",
  file: "tap.ogg",
  source: "https://example.org/sounds/tap",
  licence: "CC0",
  retrieved: "2026-11-27",
  aiGenerated: false,
  ownerApproved: true,
};
const passes = (value: unknown) => soundManifestSchema.safeParse(value).success;
const withEntry = (change: Record<string, unknown>) => passes({ sounds: [{ ...entry, ...change }] });

describe("the sound manifest schema", () => {
  it("accepts the empty manifest", () => {
    expect(passes({ sounds: [] })).toBe(true);
  });

  it("accepts a full entry, with or without an author", () => {
    expect(withEntry({})).toBe(true);
    expect(withEntry({ author: "A. Maker", aiGenerated: true })).toBe(true);
  });

  it.each(["id", "file", "source", "licence", "retrieved", "aiGenerated", "ownerApproved"])(
    "rejects an entry without %s",
    (field) => {
      expect(withEntry({ [field]: undefined })).toBe(false);
    },
  );

  it("allows CC0 as the only licence", () => {
    expect(withEntry({ licence: "CC-BY-4.0" })).toBe(false);
    expect(withEntry({ licence: "" })).toBe(false);
  });

  it("rejects a sound the owner has not approved", () => {
    expect(withEntry({ ownerApproved: false })).toBe(false);
    expect(withEntry({ ownerApproved: "true" })).toBe(false);
  });

  it("takes the retrieved date as a real day, year-month-day", () => {
    for (const retrieved of ["27 Nov 2026", "2026-13-01", "2026-02-30", "2026-11-27T10:00:00Z"]) {
      expect(withEntry({ retrieved }), retrieved).toBe(false);
    }
  });

  it("takes a file as a plain name inside the sounds folder", () => {
    for (const file of ["../tap.ogg", "ui/tap.ogg", "ui\\tap.ogg", "https://example.org/tap.ogg", ".hidden", ""]) {
      expect(withEntry({ file }), file).toBe(false);
    }
    expect(withEntry({ file: "manifest.json" })).toBe(false);
  });

  it("rejects empty text and unknown fields", () => {
    expect(withEntry({ id: "" })).toBe(false);
    expect(withEntry({ source: "" })).toBe(false);
    expect(withEntry({ author: "" })).toBe(false);
    expect(withEntry({ volume: 3 })).toBe(false);
    expect(passes({ sounds: [], music: [] })).toBe(false);
    expect(passes({})).toBe(false);
  });

  it("rejects an id listed twice", () => {
    const result = soundManifestSchema.safeParse({ sounds: [entry, { ...entry, file: "other.ogg" }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["sounds", 1, "id"]);
  });
});
