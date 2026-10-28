// Hands Gemini (agy, headless) read-only material and posts its answer to GitHub itself.
// Gemini never gets GitHub access or write permission; a failed run posts one "skipped" line.
// Usage: node tools/gemini-audit.mjs specs <issue numbers...> | pr <n> | prs | weekly | narrative [--dry-run]
// `pr <n>` is the merge gate (tools/gemini/rails.mjs): it audits one pull request, adds the rail audit when the
// diff touches a rail, posts both, and prints one line of JSON with the verdict (merge, fix, hold or retry).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEEP_PATHS,
  ORDER,
  TIMEOUT,
  askFirstAvailable,
  buildPrompt,
  byLine,
  diffStats,
  parseReply,
  pickDepth,
} from "./gemini/agy.mjs";
import { decide, railHits, readVerdict, verdictMarker } from "./gemini/rails.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const MARKER = "<!-- gemini-audit -->";
const MAX_DIFF = 200_000;
const USAGE = "usage: node tools/gemini-audit.mjs specs <n...> | pr <n> | prs | weekly | narrative [--dry-run]";
const PINNED = { weekly: "Gemini weekly audit", narrative: "How the code is organised" };

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const [mode, ...numbers] = argv.filter((a) => a !== "--dry-run");
const tmp = mkdtempSync(path.join(os.tmpdir(), "gemini-audit-"));

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

// what: what is reviewed, for pickDepth; deepPaths: extra path prefixes that make it a deep review. Returns
// { model, response, passed, depth, why }, so the comment can say which model answered and why it was chosen.
function askGemini(promptName, material, what, deepPaths = DEEP_PATHS) {
  const text = readFileSync(path.join(ROOT, "tools", "gemini", "prompts", `${promptName}.md`), "utf8");
  let file;
  if (material) {
    file = path.join(tmp, "material.md");
    writeFileSync(file, material);
  }
  const prompt = buildPrompt(text, file);
  const pick = pickDepth(what, deepPaths);
  const answer = askFirstAvailable(ORDER[pick.depth], (model) =>
    parseReply(
      run("agy", [
        "-p",
        prompt,
        "--output-format",
        "json",
        "--model",
        model,
        "--print-timeout",
        TIMEOUT,
        "--add-dir",
        tmp,
      ]),
    ),
  );
  return { ...answer, ...pick };
}

function post(kind, number, text) {
  const body = `${MARKER}\n${text}\n`;
  if (DRY) return console.log(`--- would comment on ${kind} #${number} ---\n${body}`);
  const file = path.join(tmp, `comment-${kind}-${number}.md`);
  writeFileSync(file, body);
  gh(kind, "comment", String(number), "--body-file", file);
}

// The answering model may be a Claude model when a Gemini model ahead of it in the order could not answer;
// the by-line names it.
const report = (label, answer) => `**Gemini audit: ${label}**\n_${byLine(answer)}_\n\n${answer.response}`;
const skipped = (err) => `Gemini audit skipped: ${err.message}`;

function issueText(n) {
  const i = JSON.parse(gh("issue", "view", String(n), "--json", "number,title,body"));
  return `# #${i.number} ${i.title}\n\n${i.body}\n`;
}

function pinnedIssue(title) {
  const found = JSON.parse(
    gh("issue", "list", "--state", "open", "--search", `"${title}" in:title`, "--json", "number,title"),
  ).find((i) => i.title === title);
  if (found) return found.number;
  if (DRY) return 0;
  const url = gh(
    "issue",
    "create",
    "--title",
    title,
    "--body",
    "One comment per run from tools/gemini-audit.mjs.",
  ).trim();
  const n = Number(url.split("/").pop());
  gh("issue", "pin", String(n));
  return n;
}

function specs() {
  if (!numbers.length) throw new Error("specs needs at least one issue number");
  const material = numbers.map(issueText).join("\n---\n\n");
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
function prMaterial(pr, diff) {
  const linked = /\b(?:closes|fixes|resolves)\s+#(\d+)/i.exec(pr.body ?? "")?.[1];
  const spec = linked ? issueText(linked) : 'No linked task spec (no "Closes #n" in the pull request).\n';
  const cut =
    diff.length > MAX_DIFF ? `${diff.slice(0, MAX_DIFF)}\n... (diff truncated; read the rest from disk)\n` : diff;
  return `# Task spec\n\n${spec}\n# Pull request #${pr.number}\n\n${pr.body ?? ""}\n\n# Diff\n\n\`\`\`diff\n${cut}\`\`\`\n`;
}

// The merge gate for one pull request: agy's review, plus the deep rail audit when the diff touches a rail. A
// verdict already posted for the same commit is reused, unless it was a retry.
function auditPr(number) {
  const pr = JSON.parse(gh("pr", "view", String(number), "--json", "number,body,headRefOid,comments"));
  const old = pr.comments
    .map((c) => readVerdict(c.body))
    .filter((v) => v?.sha === pr.headRefOid)
    .at(-1);
  if (old && old.verdict !== "retry") return { pr: pr.number, ...old, reused: true };
  const diff = gh("pr", "diff", String(number));
  const what = { kind: "change", ...diffStats(diff) };
  const hits = railHits(diff);
  const material = prMaterial(pr, diff);
  const ask = (prompt, deepPaths) => {
    try {
      return { ok: true, ...askGemini(prompt, material, what, deepPaths) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };
  const review = ask("pr-audit");
  const rail = hits.length
    ? ask(
        "rail-audit",
        hits.map((h) => h.file),
      )
    : null;
  const verdict = { sha: pr.headRefOid, ...decide({ review, rail, hits }) };
  const parts = [verdictMarker(verdict), review.ok ? report("pull request", review) : skipped(new Error(review.error))];
  if (rail) {
    const label = `rail audit (${hits.map((h) => h.file).join(", ")})`;
    parts.push(rail.ok ? report(label, rail) : `Gemini ${label} skipped: ${rail.error}`);
  }
  parts.push(`**Verdict: ${verdict.verdict}**: ${verdict.why}.`);
  post("pr", pr.number, parts.join("\n\n"));
  return { pr: pr.number, ...verdict, rails: hits.map((h) => h.file) };
}

// Every open pull request without an audit yet, one JSON line each.
function prs() {
  const open = JSON.parse(gh("pr", "list", "--state", "open", "--json", "number,comments"));
  for (const pr of open.filter((p) => !p.comments.some((c) => c.body.includes(MARKER)))) {
    try {
      console.log(JSON.stringify(auditPr(pr.number)));
    } catch (err) {
      post("pr", pr.number, skipped(err));
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

try {
  if (mode === "specs") specs();
  else if (mode === "pr" && /^\d+$/.test(numbers[0] ?? "")) console.log(JSON.stringify(auditPr(Number(numbers[0]))));
  else if (mode === "prs") prs();
  else if (mode === "weekly") repoWide("weekly-audit", "weekly");
  else if (mode === "narrative") repoWide("narrative", "how the code is organised,");
  else throw new Error(USAGE);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
