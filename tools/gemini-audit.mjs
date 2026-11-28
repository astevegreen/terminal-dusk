// Hands Gemini (agy, headless) read-only material and posts its answer to GitHub itself.
// Gemini never gets GitHub access or write permission; a failed run posts one "skipped" line.
// Usage: node tools/gemini-audit.mjs specs <issue numbers...> | pr <n> [--asked "<owner's words>"] | prs | weekly |
// narrative [--dry-run]
// `pr <n>` is the merge gate (tools/gemini/rails.mjs): it audits one pull request, asks the rail question in the same
// call when the diff touches a rail, posts the answer, and prints one line of JSON with the verdict (merge, fix, hold
// or retry). It runs last, after the reviewer, CI and Sonar (CLAUDE.md, Finishing), and spends agy's quota only
// where it adds something (owner, 28 Nov 2026): it skips docs-only, test-only, lockfile-only and Dependabot changes
// and small ones off the high-risk paths and rails; after a fix push it carries a small safe delta over, or reviews
// only the delta. Every review adds one line to the quota ledger (agy.mjs, LEDGER_FILE).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEEP_PATHS,
  appendLedger,
  askFirstAvailable,
  askModel,
  buildPrompt,
  byLine,
  carryOver,
  deltaPreamble,
  diffStats,
  pickDepth,
  readLedger,
  reviewModels,
  skipReason,
} from "./gemini/agy.mjs";
import { CUT_LINE, NO_API, apiFor } from "./gemini/gemini-api.mjs";
import { decide, priorVerdict, railHits, readVerdict, reusableVerdict, verdictMarker } from "./gemini/rails.mjs";
import {
  comment,
  comments,
  createIssue,
  deltaSince,
  is403,
  issue,
  openIssues,
  openPullRequests,
  pullRequest,
} from "./github-rest.mjs";
import { collaborators, fromFork, trustedComment, trustedIssue } from "./github-trust.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const MARKER = "<!-- gemini-audit -->";
const MAX_DIFF = 200_000;
const USAGE =
  'usage: node tools/gemini-audit.mjs specs <n...> | pr <n> [--asked "<owner\'s words>"] | prs | weekly | narrative [--dry-run]';
// The ledger names the repository, since every repo on this PC writes to the one file.
export const REPO = "astevegreen/terminal-dusk";
const PINNED = { weekly: "Gemini weekly audit", narrative: "How the code is organised" };

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const at = argv.indexOf("--asked");
const ASKED = at >= 0 ? argv[at + 1] : undefined;
const [mode, ...numbers] = argv.filter((a, k) => a !== "--dry-run" && (at < 0 || (k !== at && k !== at + 1)));
// Made on first use, so importing this file (the tests do) leaves nothing behind.
let tmp;
const tmpDir = () => (tmp ??= mkdtempSync(path.join(os.tmpdir(), "gemini-audit-")));

function run(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 11 * 60_000,
  });
}
function gh(...args) {
  const r = run("gh", args);
  if (r.status !== 0)
    throw new Error(
      `gh ${args.slice(0, 2).join(" ")} failed: ${(r.stderr || r.error?.message || "").trim().split("\n")[0]}`,
    );
  return r.stdout;
}

// The login gh is signed in as: the account this script posts its audits under. Read as the YODC queue's
// `identity` does; the bot while it can sign in, the owner while it is suspended.
function signedIn() {
  return gh("api", "user", "--jq", ".login").trim();
}

// The models agy offers, asked of `agy models` once per run however many audits it makes (agy.mjs, reviewModels).
let listing;
const agyModels = (args) => (listing ??= run("agy", args));

// what: what is reviewed, for pickDepth; deepPaths: extra path prefixes that make it a deep review; order: which of
// agy.mjs's ORDERS asks, instead of the depth's (a rail change's "rail"); api: askModel's `api`, instead of
// apiFor(what.kind) (a rail change's NO_API); also: a second prompt appended to the first, so one call answers both
// (the rail question). Returns { model, response, passed, seconds, tokens, depth, why, note }, so the comment can
// say which model answered and why it was chosen, and name a Gemini model nobody has sorted yet.
function askGemini(promptName, material, what, { deepPaths = DEEP_PATHS, order, api = apiFor(what.kind), also } = {}) {
  const read = (name) => readFileSync(path.join(ROOT, "tools", "gemini", "prompts", `${name}.md`), "utf8");
  const text = also ? `${read(promptName).trim()}\n\n${read(also)}` : read(promptName);
  let file;
  if (material) {
    file = path.join(tmpDir(), "material.md");
    writeFileSync(file, material);
  }
  const prompt = buildPrompt(text, file);
  const pick = pickDepth(what, deepPaths);
  const picked = reviewModels(agyModels, order ?? pick.depth);
  const answer = askFirstAvailable(picked.models, (model, meter) =>
    askModel((args) => run("agy", args), prompt, model, ["--add-dir", tmpDir()], api, meter),
  );
  return { ...answer, ...pick, note: picked.note };
}

function post(kind, number, text) {
  const body = `${MARKER}\n${text}\n`;
  if (DRY) return console.log(`--- would comment on ${kind} #${number} ---\n${body}`);
  const file = path.join(tmpDir(), `comment-${kind}-${number}.md`);
  writeFileSync(file, body);
  // Through REST, not `gh <kind> comment`, which needs GraphQL (tools/github-rest.mjs).
  comment((args) => gh(...args), number, file);
}

// The answering model may be a Claude model (agy.mjs, ORDERS); the by-line names it. The model-list note (agy lists
// a Gemini model nobody has sorted, or none of the fast ones) is quoted under the by-line, line by line, so a note of
// two lines stays two lines; YODC's and the course's audits post it the same way.
export const report = (label, answer) =>
  [
    `**Gemini audit: ${label}**`,
    `_${byLine(answer)}_`,
    ...(answer.note
      ? [
          answer.note
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
        ]
      : []),
    "",
    answer.response,
  ].join("\n");
const skipped = (err) => `Gemini audit skipped: ${err.message}`;

// One issue's spec as the audits read it: its body, then its Decision comments (github-rest.mjs, `issue`), under a
// heading saying which wins, so a change that follows a Decision is not reported as off-spec.
function issueText(n, ghRun = gh) {
  const i = issue((args) => ghRun(...args), n);
  const text = `# #${i.number} ${i.title}\n\n${i.body}\n`;
  if (!i.decisions.length) return text;
  return [
    text,
    `## Decisions on #${i.number}: they override the issue body above where they differ\n`,
    "The owner's and the architect's Decision comments, oldest first; where two differ, the later one holds.\n",
    `${i.decisions.join("\n\n---\n\n")}\n`,
  ].join("\n");
}

// The open issue a collaborator opened under this title: anyone can open an issue of the same name.
export function pinnedIssueOf(issues, title, team) {
  return issues.find((i) => i.title === title && trustedIssue(i, team))?.number;
}

// That issue's number, opened and pinned when there is none. Every open issue is read, so strangers' issues of the
// same title can't push the collaborator's off a page.
export function pinnedIssue(title, { gh: run = gh, dry = DRY, log = console.error } = {}) {
  const rest = (args) => run(...args);
  const found = pinnedIssueOf(openIssues(rest), title, collaborators(rest));
  if (found) return found;
  if (dry) return 0;
  const n = createIssue(rest, title, "One comment per run from tools/gemini-audit.mjs.");
  try {
    run("issue", "pin", String(n));
  } catch (err) {
    // Pinning has no REST route, so a cloud session can't: the audit goes on with the issue unpinned.
    if (!is403(err)) throw err;
    log(`#${n} is not pinned: ${err.message}`);
  }
  return n;
}

// Each issue's spec in turn, for the spec audit. A plain map(issueText) would pass the list index as ghRun.
export const specMaterial = (ns, ghRun = gh) => ns.map((n) => issueText(n, ghRun)).join("\n---\n\n");

function specs() {
  if (!numbers.length) throw new Error("specs needs at least one issue number");
  const material = specMaterial(numbers);
  let answer;
  try {
    answer = askGemini("spec-audit", material, { kind: "spec" });
  } catch (err) {
    for (const n of numbers) post("issue", n, skipped(err));
    return;
  }
  // The prompt asks for one "## #<n>" section per issue; post each issue its own section.
  for (const n of numbers) {
    const section = new RegExp(String.raw`^## #${n}\b[\s\S]*?(?=^## #\d+|(?![\s\S]))`, "m").exec(answer.response)?.[0];
    post("issue", n, report("spec", { ...answer, response: section ?? answer.response }));
  }
}

// The task spec, description and diff of pull request `pr`, as one material file.
function prMaterial(pr, diff, ghRun) {
  const linked = /\b(?:closes|fixes|resolves)\s+#(\d+)/i.exec(pr.body ?? "")?.[1];
  const spec = linked ? issueText(linked, ghRun) : 'No linked task spec (no "Closes #n" in the pull request).\n';
  const cut = diff.length > MAX_DIFF ? `${diff.slice(0, MAX_DIFF)}\n${CUT_LINE}\n` : diff;
  return `# Task spec\n\n${spec}\n# Pull request #${pr.number}\n\n${pr.body ?? ""}\n\n# Diff\n\n\`\`\`diff\n${cut}\`\`\`\n`;
}

// The rail part of the material: the owner's own words, when they asked for a loosening (`--asked`), so the rail
// question flags only loosening beyond them (tools/gemini/prompts/rail-audit.md).
const askedFor = (asked) =>
  `# What the owner asked for, in their own words\n\n${asked?.trim() || "No owner's words were given: every loosening counts."}\n\n`;

// The ledger line for one review, written once its verdict is known.
const ledgerLine = (pr, sha, mode, verdict, answer = {}) => ({
  repo: REPO,
  pr,
  sha,
  mode,
  depth: answer.depth ?? null,
  model: answer.model ?? null,
  passed: (answer.passed ?? []).map((p) => p.model),
  seconds: answer.seconds ?? 0,
  tokens: answer.tokens ?? null,
  verdict,
});

const LEDGER = { read: readLedger, append: appendLedger };

// The merge gate for one pull request: agy's review, with the rail question in the same call when the diff touches a
// rail. In order:
// - a verdict this script already posted for the same commit is reused, unless it was a retry (rails.mjs,
//   reusableVerdict);
// - a change agy can't add to (skipReason: Dependabot, lockfiles, tests or docs alone, a small one off the
//   high-risk paths and rails) merges on the reviewer, CI and Sonar, with a comment saying so;
// - after an earlier `merge` or `fix` that this PC's ledger recorded (rails.mjs, priorVerdict), a small delta off
//   the high-risk paths and rails carries the merge over, and anything else is reviewed as the delta alone, with
//   the earlier verdict as context (agy.mjs, carryOver);
// - otherwise the whole pull request is reviewed.
// io stands in for gh, agy, the comment, the signed-in login and the ledger in the tests. It reads through REST, so
// it runs in cloud sessions too, where GraphQL (`gh pr view`) is refused (tools/github-rest.mjs). asked: the
// owner's own words, when they asked for a loosening.
export function auditPr(number, io = { gh, ask: askGemini, post, me: signedIn }, { asked = ASKED } = {}) {
  const ghArgs = (args) => io.gh(...args);
  const ledger = io.ledger ?? LEDGER;
  const pr = pullRequest(ghArgs, number);
  // The repository is public: a stranger's diff and description never reach agy, and get no verdict.
  if (fromFork(pr)) throw new Error(`pull request #${pr.number} is from a fork, so it is not audited`);
  pr.comments = comments(ghArgs, number);
  // Who this script posts as is asked only when a comment carries a verdict, so a first audit costs no extra call.
  const marked = pr.comments.some((c) => readVerdict(c.body));
  const me = marked ? io.me() : null;
  const old = marked ? reusableVerdict(pr.comments, pr.headRefOid, me) : null;
  if (old) return { pr: pr.number, ...old, reused: true };
  const sha = pr.headRefOid;
  const finish = (verdict, mode, answer, parts) => {
    io.post("pr", pr.number, [verdictMarker(verdict), ...parts].join("\n\n"));
    ledger.append({
      ...ledgerLine(pr.number, sha, mode, verdict.verdict, answer),
      ...(verdict.from && { from: verdict.from }),
    });
    return { pr: pr.number, ...verdict };
  };
  const diff = io.gh("pr", "diff", String(number));
  const whole = diffStats(diff);
  const wholeHits = railHits(diff);
  const deep = (stats) => pickDepth({ kind: "change", ...stats }).depth === "deep";
  const skip = skipReason(whole, { deep: deep(whole), rails: wholeHits.length > 0, author: pr.author?.login ?? "" });
  if (skip) {
    const why = `agy skipped: ${skip}; the reviewer, CI and Sonar still decide`;
    const verdict = { sha, verdict: "merge", blockers: [], notes: [], why, skipped: true };
    return { ...finish(verdict, "skip", {}, [`**Verdict: merge**: ${why}.`]), rails: [] };
  }
  const prior = marked ? priorVerdict(pr.comments, sha, me, ledger.read(), { repo: REPO, pr: pr.number }) : null;
  const delta = prior ? deltaSince(ghArgs, prior.sha, sha) : null;
  let reviewed = { diff, stats: whole, hits: wholeHits, mode: "full", preamble: "" };
  if (delta) {
    const stats = diffStats(delta.diff);
    const hits = railHits(delta.diff);
    const plan = carryOver(prior, stats, { deep: deep(stats), rails: hits.length > 0 });
    if (plan.mode === "carry") {
      const verdict = { sha, verdict: "merge", blockers: [], notes: [], why: plan.why, from: prior.sha };
      return { ...finish(verdict, "carry", {}, [`**Verdict: merge**: ${plan.why}.`]), rails: [] };
    }
    if (plan.mode === "delta")
      reviewed = { diff: delta.diff, stats, hits, mode: "delta", preamble: `${deltaPreamble(prior)}\n` };
  }
  const { hits } = reviewed;
  const what = { kind: "change", ...reviewed.stats };
  const material = `${reviewed.preamble}${prMaterial(pr, reviewed.diff, io.gh)}${hits.length ? askedFor(asked) : ""}`;
  // One call. On a rail change it also asks the rail question (rail-audit.md, appended), answered by Opus or
  // Gemini's fast models, never Sonnet (agy.mjs, ORDERS.rail); with none of them available it can't run, and the
  // verdict is retry. It never goes to the Gemini API, which sees only the diff and the rules files: rails wait for
  // agy (owner, 7 Nov: "Rails wait for the PC").
  const opts = hits.length ? { also: "rail-audit", order: "rail", api: NO_API } : undefined;
  let review;
  try {
    review = { ok: true, ...io.ask("pr-audit", material, what, opts) };
  } catch (err) {
    review = { ok: false, error: err.message, seconds: err.seconds, tokens: err.tokens };
  }
  const verdict = { sha, ...decide({ review, rail: hits.length ? review : null, hits }) };
  const label = hits.length ? `pull request and rails (${hits.map((h) => h.file).join(", ")})` : "pull request";
  const shown = reviewed.mode === "delta" ? `${label}, changes since ${prior.sha.slice(0, 8)}` : label;
  const parts = [
    review.ok ? report(shown, review) : skipped(new Error(review.error)),
    `**Verdict: ${verdict.verdict}**: ${verdict.why}.`,
  ];
  return { ...finish(verdict, reviewed.mode, review, parts), rails: hits.map((h) => h.file) };
}

// The open pull requests from this repository's own branches without an audit yet, or whose newest audit could not
// run (verdict retry). A fork's pull request is never due, and only a collaborator's comment is an audit.
export function duePrs(open) {
  const due = (p) => {
    const audits = p.comments.filter((c) => trustedComment(c) && c.body.includes(MARKER));
    return !audits.length || readVerdict(audits.at(-1).body)?.verdict === "retry";
  };
  return open.filter((p) => !fromFork(p) && due(p));
}

// Every due pull request, one JSON line each. A fork's comments are not even read.
export function auditDuePrs({ gh: run = gh, audit = auditPr, post: send = post, log = console.log } = {}) {
  const rest = (args) => run(...args);
  const open = openPullRequests(rest)
    .filter((p) => !fromFork(p))
    .map((p) => ({ ...p, comments: comments(rest, p.number) }));
  for (const pr of duePrs(open)) {
    try {
      log(JSON.stringify(audit(pr.number)));
    } catch (err) {
      send("pr", pr.number, skipped(err));
    }
  }
}

function repoWide(promptName, label) {
  const n = pinnedIssue(PINNED[mode]);
  const date = new Date().toISOString().slice(0, 10);
  // The model can run no command, so the narrative's "what changed since last month" reads a month of git log here.
  const log =
    mode === "narrative"
      ? `# git log, last month\n\n${run("git", ["log", "--since=1 month ago", "--no-merges", "--date=short", "--format=%h %ad %s"]).stdout}`
      : null;
  let text;
  try {
    text = report(`${label} ${date}`, askGemini(promptName, log, { kind: "repo" }));
  } catch (err) {
    text = skipped(err);
  }
  post("issue", n, text);
}

if (import.meta.main) {
  try {
    if (mode === "specs") specs();
    else if (mode === "pr" && /^\d+$/.test(numbers[0] ?? "") && (at < 0 || ASKED?.trim()))
      console.log(JSON.stringify(auditPr(Number(numbers[0]))));
    else if (mode === "prs") auditDuePrs();
    else if (mode === "weekly") repoWide("weekly-audit", "weekly");
    else if (mode === "narrative") repoWide("narrative", "how the code is organised,");
    else throw new Error(USAGE);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}
