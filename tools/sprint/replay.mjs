// Rebuilds a queue snapshot at any moment of a recorded sprint, from a fixture of issues and pull requests
// with their timelines (tools/sprint/fixtures/october.jsonl: one item per line). The tests replay October
// with it, and `queue.mjs --fixture <file> --at <time>` answers as the queue would have then.
// A fixture keeps no check history, so every pull request reads as green and mergeable unless a test says otherwise.
import { OWNER, REQUIRED_CHECKS } from "./rules.mjs";

export const readFixture = (text) =>
  text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l));

const ms = (s) => new Date(s).getTime();

function stateAt(item, t) {
  let open = true;
  let draft = item.kind === "pr" ? initialDraft(item) : false;
  let title = item.events.find((e) => e.e === "renamed")?.from ?? item.title;
  let autoMerge = false;
  let reviewRequested = false;
  const labels = new Set();
  for (const e of item.events) {
    if (ms(e.t) > t) break;
    if (e.e === "labeled") labels.add(e.l);
    else if (e.e === "unlabeled") labels.delete(e.l);
    else if (e.e === "closed") open = false;
    else if (e.e === "reopened") open = true;
    else if (e.e === "converted_to_draft") draft = true;
    else if (e.e === "ready_for_review") draft = false;
    else if (e.e === "renamed") title = e.to;
    else if (/^auto_(merge|squash|rebase)_enabled$/.test(e.e)) autoMerge = true;
    else if (e.e === "auto_merge_disabled") autoMerge = false;
    else if (e.e === "review_requested") reviewRequested = true;
    else if (e.e === "reviewed" && e.s === "approved") reviewRequested = false;
  }
  return { open, draft, title, labels: [...labels], autoMerge, reviewRequested };
}

// A pull request opened as a draft when its first draft event marks it ready.
function initialDraft(item) {
  const first = item.events.find((e) => e.e === "ready_for_review" || e.e === "converted_to_draft");
  return first ? first.e === "ready_for_review" : Boolean(item.draft);
}

export function snapshotAt(items, at, { freeMb = 16000, localMinutes = 0, owner = OWNER } = {}) {
  const t = ms(at);
  const S = { now: new Date(t), freeMb, localMinutes, owner, issues: [], prs: [], sonar: {}, mainChangedAt: null };
  for (const item of items) {
    if (ms(item.created) > t) continue;
    const s = stateAt(item, t);
    const comments = item.comments.filter((c) => ms(c.t) <= t).map((c) => ({ author: c.a, createdAt: c.t, body: c.b }));
    if (item.kind === "issue") {
      S.issues.push({
        number: item.n,
        title: s.title,
        state: s.open ? "OPEN" : "CLOSED",
        labels: s.labels,
        deps: item.deps,
        comments,
      });
      continue;
    }
    const merged = item.merged && ms(item.merged) <= t;
    if (merged && item.base === "main" && (!S.mainChangedAt || ms(item.merged) > ms(S.mainChangedAt)))
      S.mainChangedAt = item.merged;
    S.prs.push({
      number: item.n,
      title: s.title,
      state: merged ? "MERGED" : s.open ? "OPEN" : "CLOSED",
      isDraft: s.draft,
      head: item.head,
      base: item.base,
      labels: s.labels,
      mergeable: "MERGEABLE",
      autoMerge: s.autoMerge,
      checks: REQUIRED_CHECKS.map((name) => ({ name, state: "SUCCESS" })),
      closes: item.closes,
      reviewRequired: s.reviewRequested && !merged,
      reviewers: [],
      comments,
    });
  }
  return S;
}
