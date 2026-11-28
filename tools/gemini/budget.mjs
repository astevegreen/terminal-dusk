// How much of agy's quota a review spends (owner, 28 Nov 2026): which changes agy is not asked about, when an earlier
// verdict carries over or only the delta is read, and the ledger that records each review. tools/gemini/agy.mjs
// exports all of it, as the other three copies' agy.mjs do (YODC, the course and flashcards).
import { appendFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// A change of fewer lines than this, on no high-risk path and no rail, is not sent to agy: the reviewer, CI and
// Sonar still read it.
export const SMALL = 30;
const LOCKFILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "Cargo.lock",
  "poetry.lock",
  "uv.lock",
  "Gemfile.lock",
  "composer.lock",
]);
const base = (f) => f.split("/").at(-1);
export const isLockfile = (f) => LOCKFILES.has(base(f));
export const isTest = (f) =>
  /(^|\/)(__tests__|tests?|e2e)\//.test(f) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)test_[^/]*\.py$/.test(f);
// Markdown only (a .txt or a file under docs/ can be data a build or a check reads, as flashcards' and YODC's copies
// say). The instruction files agents follow are rails or near-rails, never docs.
const INSTRUCTIONS = new Set(["CLAUDE.md", "AGENTS.md", "GEMINI.md"]);
export const isDoc = (f) =>
  /\.md$/i.test(f) && !INSTRUCTIONS.has(base(f)) && !f.startsWith(".claude/") && !f.startsWith(".agents/");

// Why a change is not sent to agy, or null when it is. deep and rails say whether it touches a high-risk path or a
// rail, which are always sent; author is the pull request's author. Dependabot is skipped before the rail check on
// purpose (agy on #753): its pull requests bump versions in package.json, lockfiles and workflows, all rails here, so
// checking rails first would never skip one, and the owner's 28 Nov cuts name Dependabot updates. GitHub sets the
// author, so no one else's pull request can claim it.
export function skipReason({ files = [], lines = 0 }, { deep = false, rails = false, author = "" } = {}) {
  if (/^dependabot(\[bot\])?$/i.test(author)) return "it is a Dependabot update";
  if (deep || rails) return null;
  const all = (test) => files.length > 0 && files.every((f) => test(f));
  if (all(isLockfile)) return "it changes only lockfiles";
  if (all(isTest)) return "it changes only tests";
  if (all(isDoc)) return "it changes only docs";
  if (lines < SMALL) return `it changes ${lines} lines, none on a high-risk path or a rail`;
  return null;
}

// A pass carries over the changes after it when they are fewer lines than this and touch no high-risk path or rail.
export const CARRY = 40;

// What an earlier verdict on the same change means for the next review: { mode, why }.
// - carry: it passed, and the delta since is small and touches no high-risk path or rail; no agy call
// - delta: it passed or asked for a fix; agy reads only the delta, with the earlier verdict as context
// - full: no earlier verdict, or one that neither passed nor asked for a fix (hold, retry)
export function carryOver(
  prior,
  delta,
  { deep = false, rails = false, pass = ["merge", "ship"], fixable = ["fix"] } = {},
) {
  if (!prior) return { mode: "full", why: "no earlier verdict to build on" };
  const short = String(prior.sha ?? "").slice(0, 8);
  if (pass.includes(prior.verdict) && delta.lines < CARRY && !deep && !rails)
    return {
      mode: "carry",
      why: `${prior.verdict} on ${short} carries over: the ${delta.lines} lines since touch no high-risk path or rail`,
    };
  if (pass.includes(prior.verdict) || fixable.includes(prior.verdict))
    return { mode: "delta", why: `only the changes since ${short} (${prior.verdict}) are reviewed` };
  return { mode: "full", why: `the earlier verdict (${prior.verdict}) is not built on` };
}

// The material's opening for a delta review: the earlier verdict, and what to read.
export function deltaPreamble(prior) {
  const list = (title, items = []) => (items.length ? [`${title}:`, ...items.map((i) => `- ${i}`), ""] : []);
  return [
    "# Earlier review",
    "",
    `agy reviewed this change at ${String(prior.sha).slice(0, 8)} and said \`${prior.verdict}\`.`,
    "",
    ...list("Its blockers", prior.blockers),
    ...list("Its notes", prior.notes),
    "Review only the changes since that commit, in the diff below: check that they fix the earlier blockers and add " +
      "no new problem. The rest of the change was reviewed then.",
    "",
  ].join("\n");
}

// The quota ledger: one JSON line per review (repo, pr, sha, mode, depth, model, passed, seconds, tokens, verdict),
// so the burn rate can be read and the thresholds tuned on data. One file serves every repo on this PC, as the quota
// file does. A carried-over or delta review builds only on a verdict this ledger recorded (tools/gemini-audit.mjs).
export const LEDGER_FILE = path.join(os.tmpdir(), "agy-ledger.jsonl");

export function appendLedger(entry, file = LEDGER_FILE, now = Date.now) {
  try {
    appendFileSync(file, `${JSON.stringify({ at: new Date(now()).toISOString(), ...entry })}\n`);
  } catch {
    // A review never fails because it could not write its ledger line.
  }
}

export function readLedger(file = LEDGER_FILE) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return text.split("\n").flatMap((line) => {
    try {
      return line.trim() ? [JSON.parse(line)] : [];
    } catch {
      return [];
    }
  });
}
