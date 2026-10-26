// The online game screen drawn from real online game snapshots (A9a's session on the fake Supabase, fake
// timers): the turn line, the deadline line, the board through GameScreen, answering only on your move, a
// refusal, Back, and the screen changing when the rival moves.
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Frame } from "@terminal-dusk/host";
import { GameScreen } from "../game/GameScreen.tsx";
import type { GameScreenProps } from "../game/GameScreen.tsx";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { nextMove, settle } from "../transport/test/remoteGame.ts";
import type { OnlineGameSnapshot } from "./onlineGame.ts";
import { LOADING_SNAPSHOT } from "./OnlineGameScreen.tsx";
import { OnlineGameView } from "./OnlineGameView.tsx";
import type { OnlineGameActions } from "./OnlineGameView.tsx";
import { NOW, clockWith, onlineRig, play, poll } from "./test/onlineRig.ts";
import { button, treeOf } from "./test/screenTree.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Calls = { closed: number; back: number };

const view = (snapshot: OnlineGameSnapshot, game: OnlineGameActions | null, calls?: Calls) => (
  <OnlineGameView
    snapshot={snapshot}
    game={game}
    label={cardName}
    question={cardQuestion}
    affiliation={cardAffiliation}
    onBack={() => {
      if (calls) calls.back++;
    }}
  />
);
const page = (snapshot: OnlineGameSnapshot, game: OnlineGameActions | null = null): string =>
  renderToString(view(snapshot, game));
const turnLine = (out: string): string | undefined => /<p role="status">([^<]*)<\/p>/.exec(out)?.[1];

/** The GameScreen element the view returns, found without calling any component, or null. */
function gameScreenIn(node: ReactNode): ReactElement<GameScreenProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = gameScreenIn(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (node.type === GameScreen) return node as ReactElement<GameScreenProps>;
  return gameScreenIn((node.props as { children?: ReactNode }).children);
}
const shown = (snapshot: OnlineGameSnapshot, game: OnlineGameActions | null) =>
  gameScreenIn(
    OnlineGameView({
      snapshot,
      game,
      label: cardName,
      question: cardQuestion,
      affiliation: cardAffiliation,
      onBack: () => {},
    }),
  );

const started = async (player = "alice", clock = clockWith({ lio: null, sae: null })) => {
  const r = onlineRig(player, { clock });
  await settle();
  return r;
};
const withStatus = (s: OnlineGameSnapshot, status: unknown): OnlineGameSnapshot => {
  const frame = s.frame!;
  const pub = { ...frame.view.public, status, pending: [] };
  return { ...s, turn: "over", frame: { ...frame, decision: null, view: { ...frame.view, public: pub } } as Frame };
};

describe("the turn line, in a role=status element", () => {
  it("says Your move on your move", async () => {
    const r = await started();
    expect(r.game.getSnapshot().turn).toBe("mine");
    expect(turnLine(page(r.game.getSnapshot()))).toBe("Your move");
  });
  it("says Waiting for SAE while LIO waits on the rival, and Waiting for LIO for SAE", async () => {
    const r = await started();
    await play(r);
    expect(r.game.getSnapshot().turn).toBe("rival");
    expect(turnLine(page(r.game.getSnapshot()))).toBe("Waiting for SAE");
    const bob = await started("bob");
    await play(bob); // alice's card choice
    await play(bob); // bob's; now alice is waited on
    expect(bob.game.getSnapshot().turn).toBe("rival");
    expect(turnLine(page(bob.game.getSnapshot()))).toBe("Waiting for LIO");
  });
  it("says You won, You lost or Draw once the game is over", async () => {
    const r = await started();
    r.fake.commit({ player: "bob", resign: true });
    await poll(r);
    expect(r.game.getSnapshot().turn).toBe("over");
    expect(turnLine(page(r.game.getSnapshot()))).toBe("You won");
    const bob = await started("bob");
    bob.fake.commit({ player: "bob", resign: true });
    await poll(bob);
    expect(turnLine(page(bob.game.getSnapshot()))).toBe("You lost");
    const draw = withStatus(r.game.getSnapshot(), { kind: "over", winner: null, reason: "turnLimitReached" });
    expect(turnLine(page(draw))).toBe("Draw");
  });
  it("says Loading the game before the first frame", () => {
    expect(turnLine(page(LOADING_SNAPSHOT))).toBe("Loading the game");
  });
});

describe("loading", () => {
  it("shows only the turn line and Back, never GameScreen", () => {
    expect(shown(LOADING_SNAPSHOT, null)).toBeNull();
    const out = page(LOADING_SNAPSHOT);
    expect(out).not.toContain('class="game"');
    expect(treeOf(view(LOADING_SNAPSHOT, null)).buttons.map((b) => b.text)).toEqual(["Back"]);
  });
  it("shows no GameScreen while turn is loading even with a frame", async () => {
    const r = await started();
    const s = { ...r.game.getSnapshot(), turn: "loading" as const };
    expect(shown(s, r.game)).toBeNull();
    expect(turnLine(page(s))).toBe("Loading the game");
  });
});

describe("the board", () => {
  it("is drawn through GameScreen with the session's log, era and frame, and the game's label and question", async () => {
    const r = await started();
    await play(r);
    const s = r.game.getSnapshot();
    const props = shown(s, r.game)!.props;
    expect(props.frame).toBe(s.frame);
    expect(props.log).toBe(s.log);
    expect(props.era).toBe(s.era);
    expect(props.label).toBe(cardName);
    expect(props.question).toBe(cardQuestion);
    expect(page(s)).toContain('class="game"');
  });
  it("passes onAnswer only on your move, and it answers through the session", async () => {
    const r = await started();
    expect(shown(r.game.getSnapshot(), r.game)!.props.onAnswer).toBeTypeOf("function");
    const answered: unknown[] = [];
    const spy: OnlineGameActions = { answer: (v) => (answered.push(v), Promise.resolve()), close: () => {} };
    shown(r.game.getSnapshot(), spy)!.props.onAnswer!("x" as never);
    expect(answered).toEqual(["x"]);
    await play(r);
    expect(r.game.getSnapshot().turn).toBe("rival");
    expect(shown(r.game.getSnapshot(), r.game)!.props.onAnswer).toBeUndefined();
    r.fake.commit({ player: "bob", resign: true });
    await poll(r);
    expect(shown(r.game.getSnapshot(), r.game)!.props.onAnswer).toBeUndefined();
  });
  it("shows a refused answer", async () => {
    const r = await started();
    const { args } = nextMove(r.fake.current());
    r.fake.commit(nextMove(r.fake.current()).submission); // the server moves on before this client's answer lands
    await r.game.answer(args.value);
    const s = r.game.getSnapshot();
    expect(s.refusal).not.toBeNull();
    expect(shown(s, r.game)!.props.refusal).toBe(s.refusal!.code);
    expect(page(s)).toContain(`<output role="alert">Refused: ${s.refusal!.code}</output>`);
  });
  it("changes when the session delivers the rival's move", async () => {
    const r = await started();
    await play(r);
    const before = page(r.game.getSnapshot());
    expect(turnLine(before)).toBe("Waiting for SAE");
    await play(r); // bob's move, seen on the next poll
    const after = page(r.game.getSnapshot());
    expect(turnLine(after)).toBe("Your move");
    expect(after).not.toBe(before);
    expect(shown(r.game.getSnapshot(), r.game)!.props.frame.seq).toBe(2);
  });
});

describe("the deadline line", () => {
  const lineOf = (out: string): string | null => {
    const m = /<p role="status">[^<]*<\/p><p>([^<]*)<\/p>/.exec(out);
    return m ? m[1]! : null;
  };
  it("says how long the waiting side has, with the extra deadline still to come", async () => {
    const r = await started("alice", clockWith({ lio: NOW + 2 * DAY + 4 * HOUR, sae: null }));
    expect(lineOf(page(r.game.getSnapshot()))).toBe("2 days 4 hours left, then one extra deadline");
  });
  it("leaves the extra deadline out under loss on time", async () => {
    const r = await started("alice", clockWith({ lio: NOW + DAY + HOUR, sae: null }, "lossOnTime"));
    expect(lineOf(page(r.game.getSnapshot()))).toBe("1 day 1 hour left");
  });
  it("says time is up, with no extra deadline, once the deadline has passed", async () => {
    const r = await started("alice", clockWith({ lio: NOW - 1, sae: null }));
    expect(lineOf(page(r.game.getSnapshot()))).toBe("time is up");
  });
  it("is left out when the deadline is null or the game is over", async () => {
    const r = await started();
    expect(r.game.getSnapshot().deadline).toBeNull();
    expect(lineOf(page(r.game.getSnapshot()))).toBeNull();
    const timed = await started("alice", clockWith({ lio: NOW + DAY, sae: null }));
    const over = withStatus(timed.game.getSnapshot(), { kind: "over", winner: "lio", reason: "x" });
    expect(over.deadline).not.toBeNull();
    expect(lineOf(page(over))).toBeNull();
  });
});

describe("Back", () => {
  it("is 44 px, closes the session and goes back", async () => {
    const r = await started();
    const calls = { closed: 0, back: 0 };
    const game: OnlineGameActions = { answer: () => Promise.resolve(), close: () => void calls.closed++ };
    expect(page(r.game.getSnapshot())).toMatch(/<button[^>]*min-width:44px[^>]*>Back<\/button>/);
    button(treeOf(view(r.game.getSnapshot(), game, calls)), "Back").press();
    expect(calls).toEqual({ closed: 1, back: 1 });
  });
  it("closes the real session, so it polls no more", async () => {
    const r = await started();
    button(treeOf(view(r.game.getSnapshot(), r.game)), "Back").press();
    const sent = r.sent.length;
    r.timers.fire();
    await settle();
    expect(r.sent).toHaveLength(sent);
  });
  it("still goes back while loading, with no session yet", () => {
    const calls = { closed: 0, back: 0 };
    button(treeOf(view(LOADING_SNAPSHOT, null, calls)), "Back").press();
    expect(calls.back).toBe(1);
  });
});

describe("secrets", () => {
  it("no rendered page contains a token", async () => {
    const r = await started("alice", clockWith({ lio: NOW + DAY, sae: NOW + DAY }));
    const pages = [page(r.game.getSnapshot())];
    r.game.subscribe(() => pages.push(page(r.game.getSnapshot())));
    await play(r);
    await play(r);
    expect(pages.length).toBeGreaterThan(2);
    for (const out of pages) for (const token of ["token-alice", "token-bob"]) expect(out).not.toContain(token);
  });
});
