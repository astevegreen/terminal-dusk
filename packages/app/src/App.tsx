// The home screen: the game's name, a button to play against the AI, a button to play the six-region map against
// the AI (A14, #439), a button to play online and a button into developer test mode. The AI games and test mode
// need no account; only Play online asks to sign in.
import { useState } from "react";
import { OnlineScreen } from "./online/OnlineScreen.tsx";
import { WatchScreen } from "./online/watch/WatchScreen.tsx";
import { cardAffiliation as fixtureAffiliation, cardName, cardQuestion } from "./testMode/fixture.ts";
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
  /** The game on the six-region map against the AI; the same as `game` when left out. */
  mapGame?: VsAiGame;
  /** Supabase Auth and the session store; left out when this build has no online play set up. */
  online?: OnlineSetup;
  /** The timers an online game polls with; main.tsx passes the real ones, which are also the default. */
  timers?: Timers;
  /** The match id from a watch link (`?watch=<id>`): opens that game as a spectator instead of the home screen. */
  watch?: string;
};

const TAP = { minHeight: 44, minWidth: 44 } as const;

type Screen = "vsAi" | "vsAiMap" | "online" | "testMode";

export function App({
  clock,
  newSeed,
  newAiSeed,
  game,
  mapGame,
  online,
  timers = realTimers,
  watch,
}: Readonly<AppProps>) {
  const [screen, setScreen] = useState<"home" | Screen>("home");
  const [watching, setWatching] = useState(watch ?? null);
  if (watching !== null && online) {
    const play = {
      clock,
      timers,
      label: game?.cardName ?? cardName,
      question: game?.cardQuestion ?? cardQuestion,
      rules: game?.cardRules,
      affiliation: game?.cardAffiliation ?? fixtureAffiliation,
    };
    return (
      <WatchScreen key={watching} auth={online.auth} matchId={watching} play={play} onBack={() => setWatching(null)} />
    );
  }
  if (screen === "testMode") return <TestModeScreen clock={clock} />;
  if (screen === "vsAi" || screen === "vsAiMap") {
    const played = screen === "vsAiMap" ? (mapGame ?? game) : game;
    return (
      <VsAiScreen
        key={screen}
        clock={clock}
        newSeed={newSeed}
        newAiSeed={newAiSeed}
        {...(played ? { game: played } : {})}
      />
    );
  }
  if (screen === "online") return onlineRoute({ clock, game, online, timers }, () => setScreen("home"));
  return <Home onPick={setScreen} />;
}

/** The online screen as the app opens it: with the game's card names, questions and rules text and the app's timers. */
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
      rules={game?.cardRules}
      affiliation={game?.cardAffiliation}
      onBack={onBack}
    />
  );
}

/** The home screen's buttons; `onPick` opens the chosen screen. */
export function Home({ onPick }: Readonly<{ onPick: (screen: Screen) => void }>) {
  return (
    <main>
      <h1>Terminal Dusk</h1>
      <button type="button" style={TAP} onClick={() => onPick("vsAi")}>
        Play against the AI
      </button>
      <button type="button" style={TAP} onClick={() => onPick("vsAiMap")}>
        Play the six-region map
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
