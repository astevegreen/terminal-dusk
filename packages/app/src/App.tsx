// The home screen: the game's name, a button to play against the AI and a button into developer test mode.
import { useState } from "react";
import { TestModeScreen } from "./testMode/TestModeScreen.tsx";
import { VsAiScreen } from "./vsAi/VsAiScreen.tsx";
import type { VsAiGame } from "./vsAi/VsAiScreen.tsx";

export type AppProps = {
  clock: () => number;
  /** A fresh game seed. Seeds are made only in main.tsx (hard rule 8) and never shown. */
  newSeed: () => string;
  /** A fresh seed for the AI's noise. */
  newAiSeed: () => number;
  /** The game played against the AI; the developer fixture when left out. Test mode always uses its own fixture. */
  game?: VsAiGame;
};

const TAP = { minHeight: 44, minWidth: 44 } as const;

export function App({ clock, newSeed, newAiSeed, game }: Readonly<AppProps>) {
  const [screen, setScreen] = useState<"home" | "vsAi" | "testMode">("home");
  if (screen === "testMode") return <TestModeScreen clock={clock} />;
  if (screen === "vsAi")
    return <VsAiScreen clock={clock} newSeed={newSeed} newAiSeed={newAiSeed} {...(game ? { game } : {})} />;
  return (
    <main>
      <h1>Terminal Dusk</h1>
      <button type="button" style={TAP} onClick={() => setScreen("vsAi")}>
        Play against the AI
      </button>
      <button type="button" style={TAP} onClick={() => setScreen("testMode")}>
        Test mode
      </button>
    </main>
  );
}
