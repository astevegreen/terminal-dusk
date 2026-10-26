// The home screen: the game's name, a button to play against the AI, a button to play online and a button into
// developer test mode. The AI and test mode need no account; only Play online asks to sign in.
import { useState } from "react";
import { OnlineScreen } from "./online/OnlineScreen.tsx";
import type { OnlineSetup } from "./online/OnlineScreen.tsx";
import { realTimers } from "./online/timers.ts";
import type { Timers } from "./online/timers.ts";
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
  /** Supabase Auth and the session store; left out when this build has no online play set up. */
  online?: OnlineSetup;
  /** The timers an online game polls with; main.tsx passes the real ones, which are also the default. */
  timers?: Timers;
};

const TAP = { minHeight: 44, minWidth: 44 } as const;

export function App({ clock, newSeed, newAiSeed, game, online, timers = realTimers }: Readonly<AppProps>) {
  const [screen, setScreen] = useState<"home" | "vsAi" | "online" | "testMode">("home");
  if (screen === "testMode") return <TestModeScreen clock={clock} />;
  if (screen === "vsAi")
    return <VsAiScreen clock={clock} newSeed={newSeed} newAiSeed={newAiSeed} {...(game ? { game } : {})} />;
  if (screen === "online") return onlineRoute({ clock, game, online, timers }, () => setScreen("home"));
  return <Home onPick={setScreen} />;
}

/** The online screen as the app opens it: with the game's card names and questions and the app's timers. */
export function onlineRoute(
  {
    clock,
    game,
    online,
    timers,
  }: Readonly<{ clock: () => number; game?: VsAiGame | undefined; online?: OnlineSetup | undefined; timers: Timers }>,
  onBack: () => void,
) {
  return (
    <OnlineScreen
      online={online}
      clock={clock}
      timers={timers}
      label={game?.cardName}
      question={game?.cardQuestion}
      affiliation={game?.cardAffiliation}
      onBack={onBack}
    />
  );
}

/** The home screen's buttons; `onPick` opens the chosen screen. */
export function Home({ onPick }: Readonly<{ onPick: (screen: "vsAi" | "online" | "testMode") => void }>) {
  return (
    <main>
      <h1>Terminal Dusk</h1>
      <button type="button" style={TAP} onClick={() => onPick("vsAi")}>
        Play against the AI
      </button>
      <button type="button" style={TAP} onClick={() => onPick("online")}>
        Play online
      </button>
      <button type="button" style={TAP} onClick={() => onPick("testMode")}>
        Test mode
      </button>
    </main>
  );
}
