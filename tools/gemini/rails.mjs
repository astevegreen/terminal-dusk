// agy's second look as a merge gate (owner's policy, 28 Oct 2026): which changes touch a rail, how a review's
// findings and the rail audit's answer are read, and what the pull request does next. Pure functions; the audit
// itself runs in tools/gemini-audit.mjs (`pr <n>`).
//   P3: a [blocker] from agy holds like a reviewer blocker (one fix pass first); notes never hold.
//   P4: a change touching a rail gets a deep audit asking whether it loosens, bypasses or disables a check, guard,
//       gate, hook or required review. Yes holds it for the owner; no merges it like any other change.
//   P2: an audit that could not run is a machine failure: it retries by itself and never waits for the owner.
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

import { sameAccount } from "../github-trust.mjs";

// The models that audit a rail, in order: Opus, then Gemini's fast models, newest first (agy.mjs, ORDERS.rail;
// tools/gemini-audit.mjs asks for that order). It is the owner's 28 Oct 2026 order (Argon, Opus, then Flash) without
// Argon, whose usage is too small (owner, 19 Nov 2026). Never Sonnet: the Claude reviewer already covers that family.
// When none of them is available the audit can't run, and the pull request retries (P2).

// TD's agents and skills also wire hooks and tool limits in their front matter (the lanes' bash-guard, the
// implementer's file lock), so a changed line of that kind there touches a rail too.
const AGENT_OR_SKILL = /^\.claude\/(agents|skills)\/.+\.md$/;
const WIRING = /^\s*(?:-\s*)?(?:hooks|matcher|command|tools|disallowedTools|permissionMode)\s*:/;

// Each file a unified diff changes, with its added and removed lines (without the leading + or -). A rename or copy
// also carries `from`, the old path: from its `rename from` / `copy from` line, else the `a/` path of the header.
export function diffFiles(diff) {
  const files = [];
  for (const raw of String(diff).split("\n")) {
    const line = raw.replace(/\r$/, "");
    const head = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    const moved = /^(?:rename|copy) from (.+)$/.exec(line);
    if (head) {
      const entry = { file: head[2], changed: [] };
      if (head[1] !== head[2]) entry.from = head[1];
      files.push(entry);
    } else if (moved && files.length && !files.at(-1).changed.length) files.at(-1).from = moved[1];
    else if (files.length && /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line))
      files.at(-1).changed.push(line.slice(1));
  }
  return files;
}

// The rails a diff touches: [{ file, what }], empty when it touches none. Both sides of a rename count: moving a rail
// out of its folder (tools/git-hooks/pre-push to docs/) removes it, so it is audited like any other change to it.
export function railHits(diff) {
  const hits = [];
  for (const { file, from, changed } of diffFiles(diff)) {
    const hit = (from === undefined ? [file] : [from, file])
      .map((p) => ({ file: p, rail: RAILS.find((r) => r.test(p)) }))
      .find((h) => h.rail);
    if (hit) hits.push({ file: hit.file, what: hit.rail.what });
    else if (AGENT_OR_SKILL.test(file) && changed.some((l) => WIRING.test(l)))
      hits.push({ file, what: "a hook or tool limit in an agent's or skill's front matter" });
    // An agent or skill moved out of its folder no longer loads, and its hooks and tool limits go with it.
    else if (from !== undefined && AGENT_OR_SKILL.test(from) && !AGENT_OR_SKILL.test(file))
      hits.push({ file: from, what: "an agent or skill, with its hooks and tool limits, moved out of .claude/" });
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
  // Line by line, as flashcards' copy reads it: a multiline pattern whose \W* can cross newlines backtracks on a
  // long answer.
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /^[^\w\n]*LOOSENS:[^\w\n]*(?:yes|no)\b/i.test(l));
  if (at < 0) return { loosens: null, reason: text.trim().slice(0, 800) };
  const yes = /^[^\w\n]*LOOSENS:[^\w\n]*yes\b/i.test(lines[at]);
  // In the one-call review (a rail prompt appended to the review's), the rail lines end where `Findings:` starts.
  const after = lines.slice(at + 1);
  const end = after.findIndex((l) => /^[^\w\n]*Findings:/i.test(l));
  const rest = (end < 0 ? after : after.slice(0, end)).join("\n").trim();
  return { loosens: yes, reason: rest.slice(0, 800) || "no reason given" };
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
  const mine = (c) => sameAccount(c.author?.login, me);
  const v = comments
    .filter(mine)
    .map((c) => readVerdict(c.body))
    .filter((x) => x?.sha === sha)
    .at(-1);
  return v && v.verdict !== "retry" ? v : null;
}

// The earlier verdict a new commit's review may build on (gemini-audit.mjs, carry-over and delta reviews): the newest
// one this script's account posted for another commit, other than a retry (which reviewed nothing) or a skip (agy
// never read it). A carried-over merge builds on the commit agy last read (`from`), so carry-overs never add up past
// agy.mjs's CARRY. The account is the agents' own login too, so a marker alone is never enough: the verdict counts
// only when this PC's quota ledger recorded it, for this repository, pull request and commit. Else null, and the
// review is a full one.
export function priorVerdict(comments, sha, me, ledger, { repo, pr }) {
  if (!me) return null;
  const mine = (c) => sameAccount(c.author?.login, me);
  const v = comments
    .filter(mine)
    .map((c) => readVerdict(c.body))
    .findLast((x) => x?.sha && x.sha !== sha && x.verdict !== "retry" && !x.skipped);
  if (!v) return null;
  const base = v.from ?? v.sha;
  const recorded = ledger.some(
    (l) => l.repo === repo && l.pr === pr && l.sha === v.sha && l.verdict === v.verdict && (l.from ?? l.sha) === base,
  );
  return recorded ? { ...v, sha: base } : null;
}

// Whether agy ever stopped this pull request (fix or hold) in a comment this script's account posted: such a pull
// request is never skipped afterwards, even when a fix push leaves it small, docs-only or off the rails, so the fix
// is read (agy on #753; flashcards' rails.mjs has the same function).
export function everStopped(comments, me) {
  if (!me) return false;
  return comments
    .filter((c) => sameAccount(c.author?.login, me))
    .map((c) => readVerdict(c.body))
    .some((v) => v?.verdict === "fix" || v?.verdict === "hold");
}
