// @vitest-environment happy-dom
// The result screen's rating change, through the hook and the screen that wires it (#680, #734): the change comes
// from the match's own `rating_change` row, so it is right when the game was already over at open, it waits and asks
// again while the row is not there, and an unranked game shows nothing.
import { act } from "react";
import { describe, expect, it } from "vitest";
import { settle, testScreen } from "../test/screen.ts";
import { PLAYER, TOKEN, createFakeLobby } from "./test/fakeLobby.ts";
import { LOADING_SNAPSHOT, Shown } from "./OnlineGameScreen.tsx";
import type { PlaySetup } from "./OnlineGameScreen.tsx";
import type { OnlineGame } from "./onlineGame.ts";
import { useRatingChange } from "./useRatingChange.ts";
import type { RatingSource } from "./useRatingChange.ts";

const { screen, render } = testScreen();

const CHANGE_ROW = { rating_before: 1500.2, rating_after: 1512.4, ranked_games: 4 };

function setup() {
  const fake = createFakeLobby();
  const source: RatingSource = {
    endpoint: fake.endpoint,
    token: () => Promise.resolve(TOKEN),
    playerId: PLAYER,
    matchId: "m-1",
    retryMs: 5,
    tries: 4,
  };
  return { fake, source };
}

function Probe({ source, over }: Readonly<{ source: RatingSource; over: boolean }>) {
  const c = useRatingChange(source, over);
  return <p data-testid="out">{c.kind === "changed" ? `${c.after}:${c.change}` : c.kind}</p>;
}
const out = (): string => screen.querySelector('[data-testid="out"]')?.textContent ?? "";
const settleAll = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await settle();
};
const urls = (fake: ReturnType<typeof createFakeLobby>): string[] => fake.requests.map((r) => r.url);

describe("useRatingChange reads the match's rating_change row", () => {
  it("shows the change when the game is already over at open, from the row and not from a read of the rating", async () => {
    const { fake, source } = setup();
    fake.answerNext({ status: 200, body: [{ ranked: true }] });
    fake.answerNext({ status: 200, body: [CHANGE_ROW] });
    await render(<Probe source={source} over />);
    await settleAll();
    expect(out()).toBe("1512:12");
    const asked = urls(fake);
    expect(asked[1]).toContain("/rest/v1/rating_change?");
    expect(asked[1]).toContain("match_id=eq.m-1");
    expect(asked[1]).toContain(`player=eq.${PLAYER}`);
    expect(asked.some((u) => u.includes("/rest/v1/rating?"))).toBe(false);
  });

  it("shows nothing while the game is on, and makes no request", async () => {
    const { fake, source } = setup();
    await render(<Probe source={source} over={false} />);
    await settleAll();
    expect(out()).toBe("none");
    expect(fake.requests).toEqual([]);
  });

  it("shows nothing for an unranked game and never reads rating_change", async () => {
    const { fake, source } = setup();
    fake.answerNext({ status: 200, body: [{ ranked: false }] });
    await render(<Probe source={source} over />);
    await settleAll();
    expect(out()).toBe("none");
    expect(urls(fake)).toHaveLength(1);
  });

  it("says waiting while the row is missing, then shows the change when Finalize has written it", async () => {
    const { fake, source } = setup();
    fake.answerNext({ status: 200, body: [{ ranked: true }] });
    fake.answerNext({ status: 200, body: [] });
    fake.answerNext({ status: 200, body: [CHANGE_ROW] });
    await render(<Probe source={{ ...source, retryMs: 300 }} over />);
    await settle();
    expect(out()).toBe("waiting");
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 400)));
    await settleAll();
    expect(out()).toBe("1512:12");
  });

  it("asks again after a failed read instead of staying silent, and gives up on waiting after its tries", async () => {
    const { fake, source } = setup();
    fake.answerNext({ status: 200, body: { nope: true } });
    fake.answerNext({ status: 200, body: [{ ranked: true }] });
    await render(<Probe source={source} over />);
    await settleAll();
    expect(out()).toBe("waiting");
    // Tries 1: a failed ranked read; 2: ranked read and a rating_change read; 3 and 4: rating_change reads (500).
    expect(urls(fake)).toHaveLength(5);
  });
});

describe("the online game screen wires the rating change into the result screen", () => {
  const play = {
    label: (id: string) => id,
    question: () => null,
    affiliation: () => undefined,
  } as unknown as PlaySetup;
  const gameOver = (): OnlineGame => {
    const snapshot = { ...LOADING_SNAPSHOT, turn: "over" as const };
    return { subscribe: () => () => {}, getSnapshot: () => snapshot, answer: () => Promise.resolve(), close: () => {} };
  };

  it("shows '1512, up 12' on a ranked game that is over", async () => {
    const { fake, source } = setup();
    fake.answerNext({ status: 200, body: [{ ranked: true }] });
    fake.answerNext({ status: 200, body: [CHANGE_ROW] });
    await render(<Shown game={gameOver()} play={play} onBack={() => {}} ratings={source} />);
    await settleAll();
    expect(screen.querySelector('[data-testid="rating-change"]')?.textContent).toBe("Rating: 1512, up 12");
  });

  it("says the rating has not updated yet when the row is not there, and shows no line without a source", async () => {
    const { fake, source } = setup();
    fake.answerNext({ status: 200, body: [{ ranked: true }] });
    fake.answerNext({ status: 200, body: [] });
    await render(<Shown game={gameOver()} play={play} onBack={() => {}} ratings={{ ...source, tries: 1 }} />);
    await settleAll();
    expect(screen.querySelector('[data-testid="rating-change"]')?.textContent).toBe("Your rating has not updated yet");
    await render(<Shown key="bare" game={gameOver()} play={play} onBack={() => {}} />);
    await settleAll();
    expect(screen.querySelector('[data-testid="rating-change"]')).toBeNull();
  });
});
