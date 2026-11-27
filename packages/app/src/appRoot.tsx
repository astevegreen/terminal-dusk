// Mounts the app into the #root element of the page. The clock and the seeds are made here and passed down, so
// nothing below needs the browser's clock or random numbers. The caller says which sound files there are and how
// online play is set up: main.tsx from the build, the browser tests' owner page with no sounds and a stand-in server.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { appGames } from "./appGames.ts";
import { SoundSettingsContext } from "./audio/soundControls.tsx";
import { soundSettings } from "./audio/soundSettings.ts";
import { AudioPlayerContext } from "./audio/useEventSounds.tsx";
import { EntitledApp } from "./entitlements/EntitledApp.tsx";
import type { OnlineSetup } from "./online/OnlineScreen.tsx";
import { realTimers } from "./online/timers.ts";
import { matchIdFromSearch } from "./online/watch/watchLink.ts";
import { unlockOnGesture, webAudio } from "./platform/audio.ts";
import type { SoundFiles } from "./platform/audio.ts";
import { webStore } from "./platform/storage.ts";

const randomWords = (count: number): Uint32Array => crypto.getRandomValues(new Uint32Array(count));
const newSeed = (): string => Array.from(randomWords(4), (n) => n.toString(16).padStart(8, "0")).join("");
const newAiSeed = (): number => randomWords(1)[0] ?? 0;

/** Starts the app. Without `online`, this build has no online play and no account, so the player is free. */
export function mountApp(sounds: SoundFiles, online: OnlineSetup | undefined): void {
  // Sound, the same on every platform: the manifest's files, unlocked by the player's first tap or key press, as loud
  // as the player's saved setting says (#646).
  const audio = webAudio(sounds, () => new AudioContext());
  unlockOnGesture(window, audio);
  const sound = soundSettings(webStore(localStorage), audio);
  const watchId = matchIdFromSearch(location.search);
  const root = document.getElementById("root");
  if (!root) throw new Error("the page has no #root element");
  createRoot(root).render(
    <StrictMode>
      <AudioPlayerContext.Provider value={audio}>
        <SoundSettingsContext.Provider value={sound}>
          <EntitledApp
            clock={() => Date.now()}
            newSeed={newSeed}
            newAiSeed={newAiSeed}
            {...appGames}
            store={webStore(localStorage)}
            timers={realTimers}
            {...(watchId === null ? {} : { watch: watchId })}
            {...(online ? { online } : {})}
          />
        </SoundSettingsContext.Provider>
      </AudioPlayerContext.Provider>
    </StrictMode>,
  );
}
