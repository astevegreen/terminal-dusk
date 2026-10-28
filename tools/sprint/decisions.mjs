// The Decisions digest (`queue.mjs digest`, owner's policy of 28 Oct 2026, P5). Design questions (game rules,
// cards, balance, new mechanics, a numbered Decision in docs/architecture.md) are batched on one standing issue:
// at most one comment a day, with one @astevegreen mention, posted only when a question is new since the last
// one. Each question carries the asker's recommendation, and work goes on meanwhile. Technical questions never
// come here: an Opus architect decides them on their issue ("Decision (architect): …").
// The owner answers on that issue, one line per question starting with its number, or on the question's own
// issue; rules.mjs (ownerAnswer) reads both. Pure: queue.mjs posts what this plans.
import { BLOCKED, DECISIONS, OWNER, byNumber, has, newest, newestSprint, ownerAnswer } from "./rules.mjs";

export const DIGEST = "<!-- decisions-digest -->";
export const DIGEST_EVERY_MS = 24 * 60 * 60_000;
const MAX_QUESTION = 900; // characters of each question shown in the digest

export const DECISIONS_BODY =
  "Design questions for the owner: game rules, cards, balance, new mechanics, or a change to a numbered Decision " +
  "in docs/architecture.md. `node tools/sprint/queue.mjs digest` collects them here, at most one comment a day " +
  `with one @${OWNER} mention, each with a recommendation. Work goes on meanwhile.\n\n` +
  "Answer in a comment here, one line per question starting with its issue number (`#412 take the " +
  "recommendation`), or on the question's own issue. Technical questions never come here: an architect decision " +
  'is recorded on the issue ("Decision (architect): …") and the work goes on.';

const ms = (s) => new Date(s).getTime();

// Blocked issues whose newest sprint comment asks a question ("Blocked:") the owner has not answered yet.
export function openQuestions(S) {
  const owner = S.owner ?? OWNER;
  return S.issues
    .filter((i) => i.state === "OPEN" && has(i, "blocked"))
    .map((issue) => ({ issue, ask: newestSprint(issue, owner) }))
    .filter(({ issue, ask }) => ask?.body.startsWith(BLOCKED) && !ownerAnswer(issue, { ...S, owner }))
    .sort((a, b) => byNumber(a.issue, b.issue));
}

function question({ issue, ask }, fresh) {
  let text = ask.body.slice(BLOCKED.length).trim();
  if (text.length > MAX_QUESTION) text = `${text.slice(0, MAX_QUESTION)}… (the rest is on the issue)`;
  const advice = /recommend/i.test(text) ? "" : "\n\n_No recommendation given; the issue says more._";
  return `### #${issue.number} ${issue.title}${fresh ? " (new)" : ""}\n${text}${advice}`;
}

// What `digest` should do now: { post, reason, issue, questions, fresh, body? }. issue is the Decisions issue's
// number, or null when it doesn't exist yet (queue.mjs creates it before the first digest).
export function digest(S) {
  const owner = S.owner ?? OWNER;
  const qs = openQuestions(S);
  const d = S.issues.find((i) => i.state === "OPEN" && i.title === DECISIONS) ?? null;
  const last = d ? newest(d.comments, (c) => c.author !== owner && c.body.startsWith(DIGEST)) : null;
  const listed = new Set([...(last?.body ?? "").matchAll(/^### #(\d+)/gm)].map((m) => Number(m[1])));
  const fresh = qs.filter((q) => !listed.has(q.issue.number));
  const base = {
    issue: d?.number ?? null,
    questions: qs.map((q) => q.issue.number),
    fresh: fresh.map((q) => q.issue.number),
  };
  if (!qs.length) return { ...base, post: false, reason: "no design question waits for the owner" };
  if (!fresh.length) return { ...base, post: false, reason: "every open question was in the last digest" };
  if (last && ms(S.now) - ms(last.createdAt) < DIGEST_EVERY_MS)
    return {
      ...base,
      post: false,
      reason: `the last digest went out at ${last.createdAt}; the next may go 24 hours after it`,
    };
  const count = qs.length === 1 ? "1 design question waits" : `${qs.length} design questions wait`;
  const head =
    `${DIGEST}\n@${owner} ${count} for you (${fresh.length} new). Answer here, one line per question starting ` +
    "with its number, or on its issue; each has a recommendation you can just accept. Work goes on meanwhile.";
  const freshSet = new Set(base.fresh);
  const body = [head, ...qs.map((q) => question(q, freshSet.has(q.issue.number)))].join("\n\n");
  return { ...base, post: true, reason: `${fresh.length} new question(s) since the last digest`, body };
}
