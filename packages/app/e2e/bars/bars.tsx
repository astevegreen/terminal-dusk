// The test page behind onlineBars.e2e.ts (L10, #490): the real Online and Watch game views (OnlineGameView,
// WatchView), drawn from a real frame of the six-region game made on a local match, with a snapshot written here in
// place of the one the online session would fetch. So their top bars, whose page lines (Back, the turn and deadline
// lines, "Watching") share one line with the status, the Details button and the ticker, are measured in a browser
// without the online stack. `?view=` picks the screen: `online-mine`, `online-rival` (the default) or `watch`.
import { createRoot } from "react-dom/client";
import type { Viewer } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import {
  firstDeckCardName,
  firstDeckCardQuestion,
  firstDeckCardRules,
  firstDeckRuleset,
  sixRegionMapConfig,
} from "@terminal-dusk/host/first-deck";
import { pointsOf } from "../../src/displayText.ts";
import type { OnlineGameSnapshot } from "../../src/online/onlineGame.ts";
import { OnlineGameView } from "../../src/online/OnlineGameView.tsx";
import { WatchView } from "../../src/online/watch/WatchView.tsx";
import { createLocalMatch } from "../../src/transport/localMatch.ts";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
// The longest lines the views write: a deadline with its extension still to come, and a long log line.
const DEADLINE = {
  side: "lio",
  at: NOW + 95 * HOUR,
  rule: "graceThenLoss",
  days: 3,
  graceLeft: true,
  now: NOW,
} as const;
const LOG = ["LIO placed 1 influence in Poland for 1 point.", "SAE placed 1 influence in Ukraine for 1 point."];

function frameFor(viewer: Viewer): Frame {
  const made = createLocalMatch(firstDeckRuleset, sixRegionMapConfig(), "0123456789abcdef", () => NOW);
  if (!made.ok) throw new Error(made.error.code);
  let frame: Frame | null = null;
  made.value.transportFor(viewer).subscribe((f) => {
    frame = f;
  });
  if (frame === null) throw new Error("no frame");
  return frame;
}

const display = {
  label: firstDeckCardName,
  question: firstDeckCardQuestion,
  rules: firstDeckCardRules,
  affiliation: (id: string) => firstDeckRuleset.cards.find((card) => card.id === id)?.affiliation,
  onBack: () => undefined,
};

function screen(view: string) {
  if (view === "watch") {
    const snapshot: OnlineGameSnapshot = {
      frame: frameFor("spectator"),
      log: LOG,
      era: "era-1",
      turn: "rival",
      deadline: null,
      refusal: null,
    };
    return <WatchView snapshot={snapshot} replay={null} {...display} />;
  }
  const mine = view === "online-mine";
  const snapshot: OnlineGameSnapshot = {
    frame: frameFor("lio"),
    log: LOG,
    era: "era-1",
    turn: mine ? "mine" : "rival",
    deadline: DEADLINE,
    refusal: null,
  };
  const game = { answer: () => Promise.resolve(), close: () => undefined };
  return <OnlineGameView snapshot={snapshot} game={game} points={pointsOf(firstDeckRuleset)} {...display} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("the test page has no #root element");
createRoot(root).render(screen(new URLSearchParams(location.search).get("view") ?? "online-rival"));
