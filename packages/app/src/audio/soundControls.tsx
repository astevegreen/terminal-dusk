// The sound controls (#646): a Mute toggle and a volume slider on Home, and a Mute button at the right end of the
// game's hand strip. All read and change the one sound setting (soundSettings.ts); without one, nothing is drawn.
import { createContext, memo, useContext, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import type { SoundSettings } from "./soundSettings.ts";

/** The app's sound setting (main.tsx). A screen drawn without one has no sound controls. */
export const SoundSettingsContext = createContext<SoundSettings | null>(null);

type ToggleProps = Readonly<{
  muted: boolean;
  onChange: (muted: boolean) => void;
  className?: string;
  style?: CSSProperties | undefined;
}>;

/** A button with a fixed name, pressed while sound is muted. */
export function MuteToggle({ muted, onChange, className, style }: ToggleProps) {
  return (
    <button type="button" className={className} style={style} aria-pressed={muted} onClick={() => onChange(!muted)}>
      Mute
    </button>
  );
}

export function VolumeSlider({ volume, onChange }: Readonly<{ volume: number; onChange: (volume: number) => void }>) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      Volume
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={volume}
        style={{ minHeight: 44, width: 200 }}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <span aria-hidden="true">{volume}</span>
    </label>
  );
}

function useSetting(settings: SoundSettings) {
  return useSyncExternalStore(settings.subscribe, settings.get, settings.get);
}

// Home has no stylesheet, so the pressed look is set here: bold, with a bar under the name, as in a game.
const PRESSED = { fontWeight: "bold", boxShadow: "inset 0 -3px 0 currentColor" } as const;

function HomeControls({ settings }: Readonly<{ settings: SoundSettings }>) {
  const { muted, volume } = useSetting(settings);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginTop: 16 }}>
      <MuteToggle
        muted={muted}
        onChange={(next) => settings.set({ muted: next })}
        style={{ minHeight: 44, minWidth: 44, ...(muted ? PRESSED : {}) }}
      />
      <VolumeSlider volume={volume} onChange={(next) => settings.set({ volume: next })} />
    </div>
  );
}

function GameButton({ settings }: Readonly<{ settings: SoundSettings }>) {
  const { muted } = useSetting(settings);
  return <MuteToggle muted={muted} onChange={(next) => settings.set({ muted: next })} className="game-mute-button" />;
}

function HomeSoundInner() {
  const settings = useContext(SoundSettingsContext);
  return settings === null ? null : <HomeControls settings={settings} />;
}

function MuteButtonInner() {
  const settings = useContext(SoundSettingsContext);
  return settings === null ? null : <GameButton settings={settings} />;
}

// Wrapped in `memo`, like TopBar: the test walkers that call function components directly step over their hooks.
export const HomeSound = memo(HomeSoundInner);
export const MuteButton = memo(MuteButtonInner);
