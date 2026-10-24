// `node tools/eval/reviewer-eval.mjs [--case <id>]... [--runs 2] [--cap 3000000] [--claude <path>]`: scores the
// `reviewer` agent on merged pull requests from October whose change later needed a fix, and on clean ones
// (tools/eval/reviewer-cases.json). Run it from PowerShell, where `claude` is on PATH.
// Each case runs in a throwaway worktree at the change's parent commit, with today's .claude/, CLAUDE.md and
// tools/hooks/ copied in and the session hooks left out, so the reviewer reads the code as it stood then and
// judges it with today's rules. The diff is the merged change itself: branch eval/<id> at the squash commit,
// Base its parent. The spec and summary go in the prompt; the reviewer reads no issue or pull request comments,
// where the later fix is discussed.
// Each answer and its tokens go to tools/eval/results/ (gitignored), with summary.md. The first run's tokens
// are checked against --cap before any other run starts.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const RESULTS = path.join(import.meta.dirname, "results");
const CASES = path.join(import.meta.dirname, "reviewer-cases.json");
const DENIED = "Edit,Write,NotebookEdit,WebFetch,WebSearch,mcp__plugin_github_github";

export function buildPrompt(c, { sha, spec, summary }) {
  return [
    'Use the reviewer agent (subagent_type "reviewer") on the change below, then reply with its answer only, exactly as it gave it.',
    "",
    "Prompt for the reviewer:",
    `"Issue ${c.issue}, branch eval/${c.id}, Base: ${sha}^. The spec and the pull request summary are below, as they`,
    "stood when the change was made: read them here, not with gh. This folder holds the code just before the change.",
    "",
    `Spec (issue #${c.issue}):`,
    spec.trim(),
    "",
    `Pull request summary (#${c.pr}):`,
    summary.trim(),
    '"',
  ].join("\n");
}

// All tokens a run used, across the coordinating session and the reviewer, and the reviewer's (Opus) share.
export function tokensOf(modelUsage = {}) {
  const sum = (u) =>
    (u.inputTokens ?? 0) + (u.outputTokens ?? 0) + (u.cacheReadInputTokens ?? 0) + (u.cacheCreationInputTokens ?? 0);
  const entries = Object.entries(modelUsage);
  return {
    total: entries.reduce((n, [, u]) => n + sum(u), 0),
    reviewer: entries.filter(([m]) => /opus/.test(m)).reduce((n, [, u]) => n + sum(u), 0),
  };
}

export function verdictOf(answer) {
  const text = String(answer ?? "");
  const blockers = (text.match(/\[blocker\]/gi) ?? []).length;
  const minors = (text.match(/\[minor\]/gi) ?? []).length;
  const verdict = /^\s*PASS\b/.test(text) ? "PASS" : /^\s*CONCERNS\b/.test(text) ? "CONCERNS" : "unclear";
  return { verdict, blockers, minors };
}

// A hint for the person scoring: whether a bad case's answer mentions what later broke. Scoring stays by hand.
export const hint = (c, answer) => (c.lookFor ? new RegExp(c.lookFor, "i").test(String(answer)) : null);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  }); // NOSONAR (javascript:S4036)
  if (r.error) throw new Error(`could not start ${cmd}: ${r.error.message}`);
  if (r.status !== 0)
    throw new Error(`${cmd} ${args.slice(0, 3).join(" ")}: ${(r.stderr || r.stdout).trim().slice(0, 500)}`);
  return r.stdout;
}

// A worktree at the change's parent, with today's agent rules and hooks but no session hooks.
function prepare(c, sha) {
  run("git", ["branch", "-f", `eval/${c.id}`, sha]);
  const dir = path.join(os.tmpdir(), "td-reviewer-eval", c.id);
  if (existsSync(dir)) run("git", ["worktree", "remove", "--force", dir]);
  run("git", ["worktree", "add", "--detach", dir, `${sha}^`]);
  cpSync(path.join(ROOT, ".claude"), path.join(dir, ".claude"), {
    recursive: true,
    filter: (src) => !/[\\/](settings\.local\.json|worktrees)$/.test(src),
  });
  const { model, env, permissions } = JSON.parse(readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  writeFileSync(path.join(dir, ".claude", "settings.json"), JSON.stringify({ model, env, permissions }, null, 2));
  cpSync(path.join(ROOT, "CLAUDE.md"), path.join(dir, "CLAUDE.md"));
  cpSync(path.join(ROOT, "tools", "hooks"), path.join(dir, "tools", "hooks"), { recursive: true });
  return dir;
}

function reviewOnce(dir, prompt, claude) {
  const started = Date.now();
  const out = run(claude, ["-p", "--output-format", "json", "--disallowedTools", DENIED], {
    cwd: dir,
    input: prompt,
    timeout: 30 * 60 * 1000,
  });
  const json = JSON.parse(out);
  return {
    answer: json.result,
    tokens: tokensOf(json.modelUsage),
    costUsd: json.total_cost_usd,
    minutes: Math.round((Date.now() - started) / 6000) / 10,
    isError: json.is_error,
  };
}

function summarize(rows) {
  const lines = [
    "| Case | Kind | Run | Verdict | Blockers | Minors | Mentions what broke | Tokens (all) | Tokens (reviewer) |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows)
    lines.push(
      `| ${r.id} (#${r.pr}) | ${r.kind} | ${r.run} | ${r.verdict} | ${r.blockers} | ${r.minors} | ${r.hint === null ? "n/a" : r.hint ? "yes" : "no"} | ${r.tokens.total} | ${r.tokens.reviewer} |`,
    );
  return lines.join("\n") + "\n";
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const only = args.flatMap((a, i) => (a === "--case" ? [args[i + 1]] : []));
  const runs = Number(opt("--runs", 2));
  const cap = Number(opt("--cap", 3_000_000));
  const claude = opt("--claude", "claude");
  const cases = JSON.parse(readFileSync(CASES, "utf8")).filter((c) => !only.length || only.includes(c.id));
  mkdirSync(RESULTS, { recursive: true });
  const rows = [];
  for (const c of cases) {
    const sha = JSON.parse(run("gh", ["pr", "view", String(c.pr), "--json", "mergeCommit"])).mergeCommit.oid;
    const spec = JSON.parse(run("gh", ["issue", "view", String(c.issue), "--json", "body"])).body;
    const summary = JSON.parse(run("gh", ["pr", "view", String(c.pr), "--json", "body"])).body;
    const dir = prepare(c, sha);
    try {
      for (let k = 1; k <= runs; k++) {
        const r = reviewOnce(dir, buildPrompt(c, { sha, spec, summary }), claude);
        const row = { ...c, run: k, sha, ...verdictOf(r.answer), hint: hint(c, r.answer), ...r };
        rows.push(row);
        writeFileSync(path.join(RESULTS, `${c.id}-run${k}.json`), JSON.stringify(row, null, 2));
        writeFileSync(path.join(RESULTS, "summary.md"), summarize(rows));
        process.stdout.write(`${c.id} run ${k}: ${row.verdict}, ${row.tokens.total} tokens\n`);
        if (rows.length === 1 && row.tokens.total > cap) {
          process.stdout.write(`Stopped: the first run used ${row.tokens.total} tokens, over the ${cap} cap.\n`);
          process.exitCode = 3;
          break;
        }
      }
    } finally {
      run("git", ["worktree", "remove", "--force", dir]);
      rmSync(dir, { recursive: true, force: true });
    }
    if (process.exitCode === 3) break;
  }
}
