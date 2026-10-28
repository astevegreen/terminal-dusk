// agy's second look as a merge gate (owner's policy, 28 Oct 2026): which changes touch a rail, how a review's
// findings and the rail audit's answer are read, and what the pull request does next. Pure functions; the audit
// itself runs in tools/gemini-audit.mjs (`pr <n>`).
//   P3: a [blocker] from agy holds like a reviewer blocker (one fix pass first); notes never hold.
//   P4: a change touching a rail gets a deep audit asking whether it loosens, bypasses or disables a check, guard,
//       gate, hook or required review. Yes holds it for the owner; no merges it like any other change.
//   P2: an audit that could not run is a machine failure: it retries by itself and never waits for the owner.
import { ARGON, FLASH, OPUS } from "./agy.mjs";

// The rails: where a loosened check hides its own failure. The first six are the same in YODC and the course;
// the rest are TD's own: this audit is a merge gate now, so its code and GEMINI.md (agy's instructions for it) are
// rails too, and so is the root package.json, whose scripts are the gate (`pnpm gate`, `pnpm test`).
export const RAILS = [
  { test: (f) => f.startsWith("tools/hooks/"), what: "tools/hooks" },
  { test: (f) => f.startsWith("tools/gates/"), what: "tools/gates" },
  { test: (f) => f.startsWith("tools/git-hooks/"), what: "tools/git-hooks" },
  { test: (f) => f.startsWith(".github/workflows/"), what: ".github workflows" },
  { test: (f) => /^\.claude\/settings[^/]*\.json$/.test(f), what: ".claude/settings*.json" },
  { test: (f) => /^(\.github\/|docs\/)?CODEOWNERS$/.test(f), what: "CODEOWNERS" },
  { test: (f) => f.startsWith("tools/gemini/") || f === "tools/gemini-audit.mjs", what: "agy's audit" },
  { test: (f) => f === "GEMINI.md", what: "GEMINI.md, agy's instructions" },
  { test: (f) => f === "package.json", what: "the root package.json, whose scripts run the gate" },
];

// The models a rail audit may use, in order: the two deepest, then Flash, so the audit never waits for the deep
// models (owner's rule). Never Sonnet: the Claude reviewer already covers that family. When none of the three is
// available the audit can't run, and the pull request retries (P2). agy.mjs's ORDER stays as it is, because its
// copies in the three repos must stay the same; tools/gemini-audit.mjs passes this order instead.
export const RAIL_MODELS = [ARGON, OPUS, FLASH];

// TD's agents and skills also wire hooks and tool limits in their front matter (the lanes' bash-guard, the
// implementer's file lock), so a changed line of that kind there touches a rail too.
const AGENT_OR_SKILL = /^\.claude\/(agents|skills)\/.+\.md$/;
const WIRING = /^\s*(?:-\s*)?(?:hooks|matcher|command|tools|disallowedTools|permissionMode)\s*:/;

// Each file a unified diff changes, with its added and removed lines (without the leading + or -).
export function diffFiles(diff) {
  const files = [];
  for (const line of String(diff).split("\n")) {
    const head = /^diff --git a\/.+? b\/(.+)$/.exec(line);
    if (head) files.push({ file: head[1], changed: [] });
    else if (files.length && /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
      files.at(-1).changed.push(line.slice(1));
  }
  return files;
}

// The rails a diff touches: [{ file, what }], empty when it touches none.
export function railHits(diff) {
  const hits = [];
  for (const { file, changed } of diffFiles(diff)) {
    const rail = RAILS.find((r) => r.test(file));
    if (rail) hits.push({ file, what: rail.what });
    else if (AGENT_OR_SKILL.test(file) && changed.some((l) => WIRING.test(l)))
      hits.push({ file, what: "a hook or tool limit in an agent's or skill's front matter" });
  }
  return hits;
}

// A review's findings in the GEMINI.md format: "[blocker] file:line …" or "[note] …", maybe numbered or bulleted.
export function findings(response) {
  const out = { blockers: [], notes: [] };
  for (const line of String(response ?? "").split(/\r?\n/)) {
    const m = /^\s*(?:[-*]|\d+[.)])?\s*\**\[(blocker|note|minor)\]\**:?\s*(.*)$/i.exec(line);
    if (m) (m[1].toLowerCase() === "blocker" ? out.blockers : out.notes).push(m[2].trim());
  }
  return out;
}

// The rail audit's answer: its first "LOOSENS: yes|no" line, and the reason after it. loosens is null when the
// answer says neither.
export function railAnswer(response) {
  const text = String(response ?? "");
  const m = /^\W*LOOSENS:\W*(yes|no)\b.*$/im.exec(text);
  if (!m) return { loosens: null, reason: text.trim().slice(0, 800) };
  const rest = text.slice(m.index + m[0].length).trim();
  return { loosens: m[1].toLowerCase() === "yes", reason: rest.slice(0, 800) || "no reason given" };
}

// What the pull request does next, from the review and the rail audit (null when no rail was touched). Each is
// { ok: true, response } or { ok: false, error }.
//   merge: no agy blocker and no loosened rail; the notes go on the pull request and hold nothing
//   fix:   agy found blockers; one fix pass, then audit again (blockers left after it: held)
//   hold:  the rail audit says the change loosens a rail, or gave no clear answer: held for the owner
//   retry: agy's review or the rail audit could not run; the pull request waits for it and retries by itself,
//          never for the owner (P2), and never merges unaudited
export function decide({ review, rail = null, hits = [] }) {
  const { blockers, notes } = review.ok ? findings(review.response) : { blockers: [], notes: [] };
  const where = hits.map((h) => h.file).join(", ");
  if (rail && !rail.ok)
    return {
      verdict: "retry",
      blockers,
      notes,
      why: `the rail audit could not run (${rail.error}); a change to ${where} waits for it and retries by itself`,
    };
  if (rail) {
    const answer = railAnswer(rail.response);
    if (answer.loosens === true)
      return { verdict: "hold", blockers, notes, why: `the rail audit says it loosens a rail: ${answer.reason}` };
    if (answer.loosens === null)
      return {
        verdict: "hold",
        blockers,
        notes,
        why: `the rail audit gave no clear yes or no about ${where}, so it waits for the owner`,
      };
  }
  if (!review.ok)
    return {
      verdict: "retry",
      blockers,
      notes,
      why: `agy's second look could not run (${review.error}); the pull request waits for it and retries by itself`,
    };
  if (blockers.length) return { verdict: "fix", blockers, notes, why: `agy found ${blockers.length} blocker(s)` };
  return {
    verdict: "merge",
    blockers,
    notes,
    why: rail ? "no agy blocker, and the rail audit found nothing loosened" : "no agy blocker",
  };
}

// The verdict travels in the audit comment, so a second `pr <n>` on the same commit reuses it instead of asking
// agy again. Base64 keeps "-->" in a finding from ending the HTML comment early.
const VERDICT = "<!-- gemini-verdict ";
export const verdictMarker = (v) => `${VERDICT}${Buffer.from(JSON.stringify(v)).toString("base64")} -->`;
export function readVerdict(body) {
  const m = new RegExp(String.raw`${VERDICT}([A-Za-z0-9+/=]+) -->`).exec(String(body ?? ""));
  if (!m) return null;
  try {
    return JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// The verdict a second `pr <n>` may reuse instead of asking agy again: the newest one for this commit, in a comment
// the audit's own account posted. `me` is the login gh is signed in as (the bot, or the owner while the bot is
// suspended). A marker in anyone else's comment is ignored, or a pasted marker could merge a pull request agy never
// saw. A retry is never reused: the audit runs again. comments: gh's { author: { login }, body }, oldest first.
export function reusableVerdict(comments, sha, me) {
  if (!me) return null;
  const mine = (c) => String(c.author?.login ?? "").toLowerCase() === me.toLowerCase();
  const v = comments
    .filter(mine)
    .map((c) => readVerdict(c.body))
    .filter((x) => x?.sha === sha)
    .at(-1);
  return v && v.verdict !== "retry" ? v : null;
}
