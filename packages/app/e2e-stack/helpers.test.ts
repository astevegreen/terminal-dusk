// The browser gate's helpers (A10), proved without a browser or a stack: where the mail catcher is, which code a
// message holds, which step each response is checked against, and that a leak is found and reported without its card.
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { canonical } from "../src/transport/test/leaks.ts";
import { createFakeSupabase, URL_BASE } from "../src/transport/test/fakeSupabase.ts";
import { checkResponses, frameSeqOf } from "./leakCheck.ts";
import type { Recorded } from "./leakCheck.ts";
import { codeFrom, mailpitUrl } from "./mail.ts";

const fake = createFakeSupabase(
  firstDeckRuleset,
  { ...firstDeckConfig(), matchId: "m1", players: { lio: "alice", sae: "bob" } },
  "seed-1",
  { "token-alice": "alice", "token-bob": "bob" },
);
const { secret, frames } = fake.current();
const secrets = new Map([[secret.state.meta.seq, secret]]);
const SEQ = secret.state.meta.seq;
const url = (path: string): string => `${URL_BASE}${path}`;
const viewRows = (viewer: "lio" | "sae") => [{ viewer, seq: SEQ, frame: frames[viewer] }];

describe("the mail catcher's address", () => {
  it("is the Supabase CLI's local default when no variable is set", () => {
    expect(mailpitUrl({})).toBe("http://127.0.0.1:54324");
  });
  it("comes from MAILPIT_URL, then INBUCKET_URL, without a trailing slash", () => {
    expect(mailpitUrl({ MAILPIT_URL: "http://mail.test:1/", INBUCKET_URL: "http://other.test" })).toBe(
      "http://mail.test:1",
    );
    expect(mailpitUrl({ INBUCKET_URL: "http://other.test/" })).toBe("http://other.test");
  });
});

describe("the sign-in code in a message", () => {
  it("is the 6-digit number, not digits in the address", () => {
    expect(codeFrom("Your code is 123456 for lio-111111@terminal-dusk.test", "lio-111111@terminal-dusk.test")).toBe(
      "123456",
    );
  });
  it("is null when the message has none", () => {
    expect(codeFrom("Hello, 12345 and 1234567", "a@terminal-dusk.test")).toBeNull();
  });
});

describe("the leak check", () => {
  it("passes each side's own frame and counts it", () => {
    const responses: Recorded[] = [
      { side: "lio", url: url("/rest/v1/match_view"), text: JSON.stringify(viewRows("lio")), atSeq: SEQ },
      { side: "sae", url: url("/rest/v1/match_view"), text: JSON.stringify(viewRows("sae")), atSeq: SEQ },
      { side: "sae", url: url("/functions/v1/submit"), text: JSON.stringify({ ok: true, seq: SEQ }), atSeq: SEQ },
    ];
    expect(checkResponses(responses, secrets)).toEqual({ checked: 3, problems: [] });
  });

  it("skips sign-in replies and empty bodies, which are not match-related", () => {
    const responses: Recorded[] = [
      { side: "lio", url: url("/auth/v1/otp"), text: "{}", atSeq: SEQ },
      { side: "lio", url: url("/rest/v1/match"), text: "", atSeq: SEQ },
    ];
    expect(checkResponses(responses, secrets).checked).toBe(0);
  });

  it("finds the rival's hand and the rival's frame, and reports them without any card id", () => {
    const rivalCard = secret.state.private.sae.hand[0];
    expect(rivalCard).toBeDefined();
    const leaky: Recorded = {
      side: "lio",
      url: url("/rest/v1/match_view"),
      text: JSON.stringify(viewRows("sae")),
      atSeq: SEQ,
    };
    const { problems } = checkResponses([leaky], secrets);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain("the rival's frame");
    expect(problems.join("\n")).not.toContain(JSON.stringify(rivalCard));
  });

  it("checks a row against the step it shows, and says when no state was read for that step", () => {
    const row = [{ viewer: "lio", seq: SEQ + 5, events: [] }];
    const body: Recorded = {
      side: "lio",
      url: url("/rest/v1/match_event"),
      text: canonical(row),
      atSeq: SEQ,
    };
    expect(checkResponses([body], secrets).problems).toEqual([
      `seq ${SEQ + 5}, lio, /rest/v1/match_event: no server state was read for this step to check it against`,
    ]);
  });

  it("does not count a rival's picked card the viewer's own knowledge lists, but does when it does not", () => {
    const card = secret.state.private.sae.hand[0] as string;
    const picked = structuredClone(secret);
    picked.state.private.sae.picks = [{ group: "g1", decisionId: "d1-sae", value: { kind: "chooseCard", card } }];
    const known = structuredClone(picked);
    known.state.private.lio.knowledge = [card];
    const body: Recorded = {
      side: "lio",
      url: url("/functions/v1/example"),
      text: canonical({ mine: { knowledge: [card] } }),
      atSeq: SEQ,
    };
    expect(checkResponses([body], new Map([[SEQ, known]])).problems).toEqual([]);
    expect(checkResponses([body], new Map([[SEQ, picked]])).problems).toEqual([
      `seq ${SEQ}, lio, /functions/v1/example: a hidden card`,
      `seq ${SEQ}, lio, /functions/v1/example: sae's unrevealed pick card`,
    ]);
  });

  it("does not count an ascending hidden order that only shows as the public left list, but does elsewhere", () => {
    const ordered = structuredClone(secret);
    ordered.state.secret.contingency.sae = [1, 4, 5, 6];
    const mk = (text: string): Recorded => ({ side: "lio", url: url("/functions/v1/example"), text, atSeq: SEQ });
    const publicLeft = mk(canonical({ contingency: { sae: { left: [1, 4, 5, 6] } } }));
    const real = mk(canonical({ contingency: { sae: { drawn: [1, 4, 5, 6] } } }));
    expect(checkResponses([publicLeft], new Map([[SEQ, ordered]])).problems).toEqual([]);
    expect(checkResponses([real], new Map([[SEQ, ordered]])).problems).toEqual([
      `seq ${SEQ}, lio, /functions/v1/example: sae's Contingency order`,
    ]);
  });

  it("reads the step a match_view reply shows", () => {
    expect(frameSeqOf({ url: url("/rest/v1/match_view"), text: JSON.stringify(viewRows("lio")) })).toBe(SEQ);
    expect(frameSeqOf({ url: url("/rest/v1/match"), text: "[]" })).toBeNull();
  });
});
