import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoachingPanel } from "./CoachingPanel.tsx";

const html = (props: Parameters<typeof CoachingPanel>[0]): string => renderToString(<CoachingPanel {...props} />);

describe("the coaching panel (#641)", () => {
  it("shows the chapter's title and the coach's words in a status region", () => {
    const out = html({ text: "Play a card.", chapter: "Your first turn", style: "coach" });
    expect(out).toContain('role="status"');
    expect(out).toContain("Your first turn");
    expect(out).toContain("Play a card.");
    expect(out.indexOf("Your first turn")).toBeLessThan(out.indexOf("Play a card."));
  });

  it("marks a coach step and a hint differently", () => {
    expect(html({ text: "Play a card.", chapter: "C", style: "coach" })).toContain("coaching-coach");
    const hint = html({ text: "A hint.", chapter: "C", style: "hint" });
    expect(hint).toContain("coaching-hint");
    expect(hint).not.toContain("coaching-coach");
  });

  it("keeps the chapter's title between steps, when the coach says nothing", () => {
    const out = html({ text: null, chapter: "Your first turn", style: null });
    expect(out).toContain("Your first turn");
    expect(out).not.toContain("coaching-text");
  });

  it("draws nothing once there is neither a chapter nor words (the coaching is over)", () => {
    expect(html({ text: null, chapter: null, style: null })).toBe("");
  });
});
