// Placeholder screen until the first game screen: the game's name and a button into developer test mode.
import { useState } from "react";
import { TestModeScreen } from "./testMode/TestModeScreen.tsx";

export function App({ clock }: Readonly<{ clock: () => number }>) {
  const [testMode, setTestMode] = useState(false);
  if (testMode) return <TestModeScreen clock={clock} />;
  return (
    <main>
      <h1>Terminal Dusk</h1>
      <button type="button" style={{ minHeight: 44, minWidth: 44 }} onClick={() => setTestMode(true)}>
        Test mode
      </button>
    </main>
  );
}
