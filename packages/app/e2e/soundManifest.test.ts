// Guards public/sounds/ (#644): the manifest and the folder match, and every listed id is a sound the app asks for.
// `pnpm content:check` checks each entry's fields. It reads files with Node, as server.test.ts does, so it sits in
// e2e/; Vitest still runs it with the unit tests.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOUND_IDS } from "../src/audio/cues";

type Listed = { id: string; file: string };

const folder = new URL("../public/sounds/", import.meta.url);

/** What is wrong between a manifest's entries and the sounds folder's contents, one line each. */
function manifestProblems(sounds: readonly Listed[], inFolder: readonly string[]): string[] {
  const ids = sounds.map((s) => s.id);
  const listed = new Set(sounds.map((s) => s.file));
  const present = new Set(inFolder);
  return [
    ...sounds.filter((s) => !present.has(s.file)).map((s) => `missing file: ${s.file}`),
    ...inFolder.filter((f) => f !== "manifest.json" && !listed.has(f)).map((f) => `unlisted file: ${f}`),
    ...ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `id listed twice: ${id}`),
    ...ids.filter((id) => !(SOUND_IDS as readonly string[]).includes(id)).map((id) => `not a sound id: ${id}`),
  ];
}

describe("the shipped sound manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", folder), "utf8")) as { sounds: Listed[] };

  it("lists every file in the folder, finds every file it lists, and uses each sound id at most once", () => {
    expect(manifestProblems(manifest.sounds, readdirSync(folder))).toEqual([]);
  });
});

describe("the manifest check", () => {
  const tap = { id: "uiTap", file: "tap.ogg" };

  it("passes the empty manifest", () => {
    expect(manifestProblems([], ["manifest.json"])).toEqual([]);
  });

  it("passes a listed file that exists under a sound id", () => {
    expect(manifestProblems([tap], ["manifest.json", "tap.ogg"])).toEqual([]);
  });

  it("reports a listed file that does not exist, also when only the letter case differs", () => {
    expect(manifestProblems([tap], ["manifest.json"])).toEqual(["missing file: tap.ogg"]);
    expect(manifestProblems([tap], ["manifest.json", "Tap.ogg"])).toEqual([
      "missing file: tap.ogg",
      "unlisted file: Tap.ogg",
    ]);
  });

  it("reports a file in the folder that is not listed", () => {
    expect(manifestProblems([], ["manifest.json", "extra.mp3"])).toEqual(["unlisted file: extra.mp3"]);
  });

  it("reports an id listed twice", () => {
    const twice = [tap, { id: "uiTap", file: "other.ogg" }];
    expect(manifestProblems(twice, ["tap.ogg", "other.ogg"])).toEqual(["id listed twice: uiTap"]);
  });

  it("reports an id that is not one of the app's sound ids", () => {
    expect(manifestProblems([{ id: "music", file: "tap.ogg" }], ["tap.ogg"])).toEqual(["not a sound id: music"]);
  });
});
