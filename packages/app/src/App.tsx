// The home screen: the game's name, a button to play the six-region map against the AI (A14, #439) first, a button
// to play against the AI without a map, a button to play online, a button into developer test mode and the sound
// controls (#646), and the tutorial (#642). The AI games, the tutorial and test mode need no account; only Play online asks to sign in.
import { ERA_1_FREE_BUTTON } from "@terminal-dusk/host/first-deck";
import { useState } from "react";
import { HomeSound } from "./audio/soundControls.tsx";
import { OnlineScreen } from "./online/OnlineScreen.tsx";
import { WatchScreen } from "./online/watch/WatchScreen.tsx";
import { cardAffiliation as fixtureAffiliation, cardName, cardQuestion } from "./testMode/fixture.ts";
import type { OnlineSetup } from "./online/OnlineScreen.tsx";
import { pointsOf } from "./displayText.ts";
import { realTimers } from "./online/timers.ts";
import type { Timers } from "./online/timers.ts";
import type { KeyValueStore } from "./platform/storage.ts";
import { TestModeScreen } from "./testMode/TestModeScreen.tsx";
import { tutorialEdition } from "./tutorial/edition.ts";
import type { OwnedEntitlements } from "./tutorial/edition.ts";
import { TutorialScreen } from "./tutorial/TutorialScreen.tsx";
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
  /** The free player's Era 1 game against the AI (L12); the same as `game` when left out. */
  freeGame?: VsAiGame;
  /** The optional 2025-2027 game against the AI (#601); the same as `game` when left out. */
  futureGame?: VsAiGame;
  /** Where the AI's difficulty is kept between visits (Platform.storage); left out, it is not kept. */
  store?: KeyValueStore;
  /** Supabase Auth and the session store; left out when this build has no online play set up. */
  online?: OnlineSetup;
  /** The player's owned copies of the Full Game and the platform they are checked against; left out, the player is
   *  free (#647). main.tsx passes none until web checkout (phase 6). */
  entitlements?: OwnedEntitlements;
  /** The timers an online game polls with; main.tsx passes the real ones, which are also the default. */
  timers?: Timers;
  /** The match id from a watch link (`?watch=<id>`): opens that game as a spectator instead of the home screen. */
  watch?: string;
};

const TAP = { minHeight: 44, minWidth: 44 } as const;

type Screen = "vsAi" | "vsAiMap" | "vsAiFree" | "vsAiFuture" | "tutorial" | "online" | "testMode";

export function App({
  clock,
  newSeed,
  newAiSeed,
  game,
  mapGame,
  freeGame,
  futureGame,
  store,
  online,
  entitlements,
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
  // The tutorial needs no account or entitlement: a guest plays it (#642), and an owner plays on past Era 1 (#647).
  if (screen === "tutorial") return tutorialRoute({ clock, newSeed, newAiSeed, entitlements });
  if (screen === "vsAi" || screen === "vsAiMap" || screen === "vsAiFree" || screen === "vsAiFuture") {
    const played = {
      vsAi: game,
      vsAiMap: mapGame ?? game,
      vsAiFree: freeGame ?? game,
      vsAiFuture: futureGame ?? game,
    }[screen];
    return (
      <VsAiScreen
        key={screen}
        clock={clock}
        newSeed={newSeed}
        newAiSeed={newAiSeed}
        {...(played ? { game: played } : {})}
        {...(store ? { store } : {})}
      />
    );
  }
  if (screen === "online") return onlineRoute({ clock, game, online, timers }, () => setScreen("home"));
  return <Home onPick={setScreen} />;
}

/** The tutorial as the app opens it: the Full Game's edition for an owner on this platform, otherwise the free one. */
export function tutorialRoute({
  clock,
  newSeed,
  newAiSeed,
  entitlements,
}: Readonly<{
  clock: () => number;
  newSeed: () => string;
  newAiSeed: () => number;
  entitlements?: OwnedEntitlements | undefined;
}>) {
  return (
    <TutorialScreen clock={clock} newSeed={newSeed} newAiSeed={newAiSeed} edition={tutorialEdition(entitlements)} />
  );
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
      points={game ? pointsOf(game.ruleset) : undefined}
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
      <button type="button" style={TAP} onClick={() => onPick("vsAiMap")}>
        Play the six-region map
      </button>
      <button type="button" style={TAP} onClick={() => onPick("vsAi")}>
        Play against the AI
      </button>
      <button type="button" style={TAP} onClick={() => onPick("vsAiFuture")}>
        Play the 2025-2027 game
      </button>
      <button type="button" style={TAP} onClick={() => onPick("vsAiFree")}>
        {ERA_1_FREE_BUTTON}
      </button>
      <button type="button" style={TAP} onClick={() => onPick("tutorial")}>
        Tutorial
      </button>
      <button type="button" style={TAP} onClick={() => onPick("online")}>
        Play online
      </button>
      <button type="button" style={TAP} onClick={() => onPick("testMode")}>
        Test mode
      </button>
      <HomeSound />
    </main>
  );
}
