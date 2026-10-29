// Rules text survives the hop from the online flow into the board: Shown (the screen that wraps a live game)
// hands the setup's rules to OnlineGameView, so the hand in the rendered page carries each card's rules (#417).
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { Shown } from "./OnlineGameScreen.tsx";
import type { PlaySetup } from "./OnlineGameScreen.tsx";
import { clockWith, onlineRig, play } from "./test/onlineRig.ts";
import { settle } from "../transport/test/remoteGame.ts";

const setup = (rules?: (card: string) => string | undefined): PlaySetup => ({
  clock: () => 0,
  timers: onlineRig().timers,
  label: cardName,
  question: cardQuestion,
  affiliation: cardAffiliation,
  ...(rules ? { rules } : {}),
});

describe("Shown passes the rules text on to the hand", () => {
  it("draws each hand card's rules when the setup has them, and names only when it has not", async () => {
    const r = onlineRig("alice", { clock: clockWith({ lio: null, sae: null }) });
    await settle();
    await play(r);
    const page = (p: PlaySetup): string => renderToString(<Shown game={r.game} play={p} onBack={() => {}} />);
    expect(page(setup((card) => `RULES-OF-${card}`))).toMatch(/<p class="hand-card-rules">RULES-OF-[^<]+<\/p>/);
    expect(page(setup())).not.toContain("hand-card-rules");
  });
});
