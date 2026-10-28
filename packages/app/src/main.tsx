// Browser entry point: mounts the app into the #root element of index.html. The clock and the seeds are made
// here and passed down, so nothing below needs the browser's clock or random numbers.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  FIRST_DECK_NOTE,
  SIX_REGION_MAP_NOTE,
  firstDeckCardName,
  firstDeckCardQuestion,
  firstDeckCardRules,
  firstDeckConfig,
  firstDeckRuleset,
  sixRegionMapConfig,
} from "@terminal-dusk/host/first-deck";
import { createLocalMatch } from "./transport/localMatch.ts";
import { App } from "./App.tsx";
import type { VsAiGame } from "./vsAi/VsAiScreen.tsx";
import type { OnlineSetup } from "./online/OnlineScreen.tsx";
import { webStore } from "./platform/storage.ts";
import { realTimers } from "./online/timers.ts";

/** The game against the AI: the real first deck. Test mode keeps its own developer fixture. */
const firstDeckGame: VsAiGame = {
  ruleset: firstDeckRuleset,
  makeMatch: (seed, clock) => createLocalMatch(firstDeckRuleset, firstDeckConfig(), seed, clock),
  cardName: firstDeckCardName,
  cardQuestion: firstDeckCardQuestion,
  cardRules: firstDeckCardRules,
  cardAffiliation: (id) => firstDeckRuleset.cards.find((card) => card.id === id)?.affiliation,
  note: FIRST_DECK_NOTE,
};

/** The first deck on the six-region map against the AI (A14, #439): the same cards, only the map is added. */
const sixRegionMapGame: VsAiGame = {
  ...firstDeckGame,
  makeMatch: (seed, clock) => createLocalMatch(firstDeckRuleset, sixRegionMapConfig(), seed, clock),
  note: SIX_REGION_MAP_NOTE,
};

/**
 * Online play: Supabase from Vite's environment, the session kept in localStorage, games created as `web` and
 * invite codes copied with the browser's clipboard. Left out when either setting is missing, so the online
 * screen says online play is not set up in this build.
 */
function onlineSetup(): OnlineSetup | undefined {
  const url: unknown = import.meta.env.VITE_SUPABASE_URL;
  const anonKey: unknown = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== "string" || url === "" || typeof anonKey !== "string" || anonKey === "") return undefined;
  return {
    auth: { url, anonKey, fetch: (input, init) => fetch(input, init) },
    store: webStore(localStorage),
    platform: "web",
    copy: (text) => navigator.clipboard.writeText(text),
  };
}
const online = onlineSetup();

const randomWords = (count: number): Uint32Array => crypto.getRandomValues(new Uint32Array(count));
const newSeed = (): string => Array.from(randomWords(4), (n) => n.toString(16).padStart(8, "0")).join("");
const newAiSeed = (): number => randomWords(1)[0] ?? 0;

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
  <StrictMode>
    <App
      clock={() => Date.now()}
      newSeed={newSeed}
      newAiSeed={newAiSeed}
      game={firstDeckGame}
      mapGame={sixRegionMapGame}
      timers={realTimers}
      {...(online ? { online } : {})}
    />
  </StrictMode>,
);
