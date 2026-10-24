// Hands Gemini (agy, headless) read-only material and posts its answer to GitHub itself.
// Gemini never gets GitHub access or write permission; a failed run posts one "skipped" line.
// Usage: node tools/gemini-audit.mjs specs <issue numbers...> | prs | weekly | narrative [--dry-run]
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ORDER,
  TIMEOUT,
  askFirstAvailable,
  buildPrompt,
  byLine,
  diffStats,
  parseReply,
  pickDepth,
} from "./gemini/agy.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const MARKER = "<!-- gemini-audit -->";
const MAX_DIFF = 200_000;
const PINNED = { weekly: "Gemini weekly audit", narrative: "How the code is organised" };
// Where a mistake costs most: the rules, the host and server that keep hidden information hidden, the architecture
// decisions, and the checks themselves. A pull request touching one gets the deep review.
const DEEP_PATHS = [
  "packages/engine/",
  "packages/host/",
  "packages/server/",
  "docs/architecture.md",
  "tools/gates/",
  "tools/hooks/",
];

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

// what: what is reviewed, for pickDepth. Returns { model, response, passed, depth, why }, so the comment can say
// which model answered and why it was chosen.
function askGemini(promptName, material, what) {
  const text = readFileSync(path.join(ROOT, "tools", "gemini", "prompts", `${promptName}.md`), "utf8");
  let file;
  if (material) {
    file = path.join(tmp, "material.md");
    writeFileSync(file, material);
  }
  const prompt = buildPrompt(text, file);
  const pick = pickDepth(what, DEEP_PATHS);
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

// The answering model may be a Claude model when both Gemini models are out of usage; the by-line names it.
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

function prs() {
  const open = JSON.parse(gh("pr", "list", "--state", "open", "--json", "number,body,comments"));
  for (const pr of open.filter((p) => !p.comments.some((c) => c.body.includes(MARKER)))) {
    try {
      const linked = /\b(?:closes|fixes|resolves)\s+#(\d+)/i.exec(pr.body ?? "")?.[1];
      let diff = gh("pr", "diff", String(pr.number));
      const what = { kind: "change", ...diffStats(diff) };
      if (diff.length > MAX_DIFF) diff = `${diff.slice(0, MAX_DIFF)}\n... (diff truncated; read the rest from disk)\n`;
      const spec = linked ? issueText(linked) : 'No linked task spec (no "Closes #n" in the pull request).\n';
      const material = `# Task spec\n\n${spec}\n# Pull request #${pr.number}\n\n${pr.body ?? ""}\n\n# Diff\n\n\`\`\`diff\n${diff}\`\`\`\n`;
      post("pr", pr.number, report("pull request", askGemini("pr-audit", material, what)));
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
  else if (mode === "prs") prs();
  else if (mode === "weekly") repoWide("weekly-audit", "weekly");
  else if (mode === "narrative") repoWide("narrative", "how the code is organised,");
  else throw new Error("usage: node tools/gemini-audit.mjs specs <n...> | prs | weekly | narrative [--dry-run]");
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
