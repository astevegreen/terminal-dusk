// The test page behind ranked.e2e.ts (#682): the real RankedView drawn from a snapshot picked by `?view=`: `form`
// (the default), `free` (a free player's refusal), `limit` (the refusal at 5 games), `searching` or `started`. The
// buttons only record that they were pressed, in the page's `data-last` attribute.
import { createRoot } from "react-dom/client";
import { RankedView } from "../../src/online/RankedView.tsx";
import type { RankedSnapshot } from "../../src/online/rankedSession.ts";

const FORM: RankedSnapshot = { preset: "normal", side: null, phase: "form", busy: false, refusal: null, started: null };

const SNAPSHOTS: Record<string, RankedSnapshot> = {
  form: FORM,
  free: { ...FORM, refusal: "notEntitled" },
  limit: { ...FORM, refusal: "limitReached" },
  searching: { ...FORM, phase: "searching" },
  started: {
    ...FORM,
    phase: "started",
    started: { matchId: "m-1", mySide: "sae", status: { kind: "active" }, updatedAt: 1 },
  },
};

const note =
  (what: string) =>
  (...args: unknown[]): void => {
    document.body.dataset.last = [what, ...args.map(String)].join(" ");
  };
const done = (what: string) => (): Promise<void> => {
  note(what)();
  return Promise.resolve();
};

const view = new URLSearchParams(location.search).get("view") ?? "form";

createRoot(document.getElementById("root")!).render(
  <RankedView
    snapshot={SNAPSHOTS[view] ?? FORM}
    actions={{
      choosePreset: note("preset"),
      chooseSide: note("side"),
      search: done("search"),
      cancel: done("cancel"),
      again: note("again"),
    }}
    onOpen={note("open")}
    onPlayAi={note("ai")}
    onFullGame={note("full")}
    onBack={note("back")}
  />,
);
