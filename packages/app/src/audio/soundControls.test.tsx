// The sound controls (#646): a mute toggle and a volume slider on Home, and a mute button at the right end of the game's hand strip. What
// pressing and dragging them does in a browser, and that it survives a reload, is in e2e/soundSettings.e2e.ts.
import type { Frame } from "@terminal-dusk/host";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Home } from "../App.tsx";
import { GameScreen } from "../game/GameScreen.tsx";
import { treeOf } from "../online/test/screenTree.ts";
import { silentAudio } from "../platform/audio.ts";
import { memoryStore } from "../platform/storage.ts";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { createTestSession } from "../testMode/session.ts";
import { MuteToggle, SoundSettingsContext, VolumeSlider } from "./soundControls.tsx";
import { soundSettings } from "./soundSettings.ts";
import type { SoundSetting } from "./soundSettings.ts";

async function withSound(node: ReactNode, change?: Partial<SoundSetting>): Promise<string> {
  const settings = soundSettings(memoryStore(), silentAudio());
  await settings.loaded;
  if (change !== undefined) settings.set(change);
  return renderToString(<SoundSettingsContext.Provider value={settings}>{node}</SoundSettingsContext.Provider>);
}

function frameFor(viewer: "lio" | "spectator"): Frame {
  const session = createTestSession(() => 0);
  session.setViewer(viewer);
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return frame;
}

const muteOf = (html: string): string => /<button[^>]*>Mute<\/button>/.exec(html)?.[0] ?? "";
const sliderOf = (html: string): string => /<input[^>]*type="range"[^>]*>/.exec(html)?.[0] ?? "";
const home = <Home onPick={() => {}} />;
const game = (
  <GameScreen
    frame={frameFor("lio")}
    log={[]}
    era={null}
    label={cardName}
    question={cardQuestion}
    affiliation={cardAffiliation}
  />
);
/** The page from the bottom edge on. */
const bottomOf = (html: string): string => /<div class="game-bottom">[^]*$/.exec(html)?.[0] ?? "";

describe("the sound controls on Home (#646)", () => {
  it("are a Mute toggle, not pressed, and a volume slider from 0 to 100 at 80", async () => {
    const out = await withSound(home);
    expect(muteOf(out)).toContain('type="button"');
    expect(muteOf(out)).toContain('aria-pressed="false"');
    const slider = sliderOf(out);
    expect(slider).toContain('min="0"');
    expect(slider).toContain('max="100"');
    expect(slider).toContain('step="1"');
    expect(slider).toContain('value="80"');
    expect(out).toMatch(/<label[^>]*>Volume/);
  });

  it("show the player's own setting", async () => {
    const out = await withSound(home, { muted: true, volume: 15 });
    expect(muteOf(out)).toContain('aria-pressed="true"');
    expect(sliderOf(out)).toContain('value="15"');
  });

  it("are both at least 44 px tall, and the toggle 44 px wide", async () => {
    const out = await withSound(home);
    expect(muteOf(out)).toContain("min-height:44px");
    expect(muteOf(out)).toContain("min-width:44px");
    expect(sliderOf(out)).toContain("min-height:44px");
  });

  it("are left out when the app has no sound setting", () => {
    const out = renderToString(home);
    expect(muteOf(out)).toBe("");
    expect(sliderOf(out)).toBe("");
  });
});

describe("the mute button in game (#646)", () => {
  it("is at the right end of the hand strip, after it and not part of the hand", async () => {
    const out = await withSound(game);
    // The last thing in the bottom edge: a sibling of the strip's section, which has closed before it.
    expect(bottomOf(out)).toMatch(/<\/section><button[^>]*class="game-mute-button"[^>]*>Mute<\/button><\/div><\/div>$/);
    expect(out.match(/>Mute<\/button>/g)).toHaveLength(1);
  });

  it("says whether sound is muted", async () => {
    expect(muteOf(await withSound(game))).toContain('aria-pressed="false"');
    expect(muteOf(await withSound(game, { muted: true }))).toContain('aria-pressed="true"');
  });

  it("has no volume slider beside it", async () => {
    expect(sliderOf(await withSound(game))).toBe("");
  });

  it("is left out when the app has no sound setting", () => {
    expect(muteOf(renderToString(game))).toBe("");
  });
});

describe("pressing and dragging (#646)", () => {
  it("the Mute toggle asks for the other state", () => {
    const asked: boolean[] = [];
    for (const muted of [false, true]) {
      const [toggle] = treeOf(<MuteToggle muted={muted} onChange={(next) => asked.push(next)} />).buttons;
      expect(toggle?.pressed).toBe(muted);
      toggle?.press();
    }
    expect(asked).toEqual([true, false]);
  });

  it("the slider asks for the volume it was dragged to, as a number", () => {
    const asked: number[] = [];
    const label = VolumeSlider({ volume: 80, onChange: (next) => asked.push(next) });
    const input = (label.props as { children: unknown[] }).children.find(
      (child): child is { props: { onChange: (event: unknown) => void } } =>
        typeof child === "object" && child !== null && (child as { type?: unknown }).type === "input",
    );
    input?.props.onChange({ currentTarget: { value: "35" } });
    expect(asked).toEqual([35]);
  });
});
