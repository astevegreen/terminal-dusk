// Hands Gemini (agy, headless) read-only material and posts its answer to GitHub itself.
// Gemini never gets GitHub access or write permission; a failed run posts one "skipped" line.
// Usage: node tools/gemini-audit.mjs specs <issue numbers...> | prs | weekly | narrative [--dry-run]
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const MODEL = "gemini-4-argon-high"; // pinned on purpose; change it deliberately, not by default
const TIMEOUT = "10m";
const ROOT = path.resolve(import.meta.dirname, "..");
const MARKER = "<!-- gemini-audit -->";
const MAX_DIFF = 200_000;
const PINNED = { weekly: "Gemini weekly audit", narrative: "How the code is organised" };

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const [mode, ...numbers] = argv.filter((a) => a !== "--dry-run");
const tmp = mkdtempSync(path.join(os.tmpdir(), "gemini-audit-"));

function run(cmd, args) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 11 * 60_000 });
}
function gh(...args) {
  const r = run("gh", args);
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(" ")} failed: ${(r.stderr || r.error?.message || "").trim().split("\n")[0]}`);
  return r.stdout;
}

function askGemini(promptName, material) {
  let prompt = readFileSync(path.join(ROOT, "tools", "gemini", "prompts", `${promptName}.md`), "utf8");
  if (material) {
    const file = path.join(tmp, "material.md");
    writeFileSync(file, material);
    prompt += `\nThe material is in ${file}. Read all of it before answering.\n`;
  }
  const r = run("agy", ["-p", prompt, "--output-format", "json", "--model", MODEL, "--print-timeout", TIMEOUT, "--add-dir", tmp]);
  if (r.error) throw new Error(r.error.code === "ENOENT" ? "agy is not installed" : r.error.message);
  let out;
  try { out = JSON.parse(r.stdout); } catch { throw new Error(`agy exited ${r.status}: ${(r.stderr || r.stdout || "").trim().split("\n")[0]}`); }
  if (out.status !== "SUCCESS" || !out.response) throw new Error(out.error || `agy status ${out.status}`);
  return out.response.trim();
}

function post(kind, number, text) {
  const body = `${MARKER}\n${text}\n`;
  if (DRY) return console.log(`--- would comment on ${kind} #${number} ---\n${body}`);
  const file = path.join(tmp, `comment-${kind}-${number}.md`);
  writeFileSync(file, body);
  gh(kind, "comment", String(number), "--body-file", file);
}

const report = (label, response) => `**Gemini audit: ${label}** (${MODEL})\n\n${response}`;
const skipped = (err) => `Gemini audit skipped: ${err.message}`;

function issueText(n) {
  const i = JSON.parse(gh("issue", "view", String(n), "--json", "number,title,body"));
  return `# #${i.number} ${i.title}\n\n${i.body}\n`;
}

function pinnedIssue(title) {
  const found = JSON.parse(gh("issue", "list", "--state", "open", "--search", `"${title}" in:title`, "--json", "number,title"))
    .find((i) => i.title === title);
  if (found) return found.number;
  if (DRY) return 0;
  const url = gh("issue", "create", "--title", title, "--body", "One comment per run from tools/gemini-audit.mjs.").trim();
  const n = Number(url.split("/").pop());
  gh("issue", "pin", String(n));
  return n;
}

function specs() {
  if (!numbers.length) throw new Error("specs needs at least one issue number");
  const material = numbers.map(issueText).join("\n---\n\n");
  let response;
  try { response = askGemini("spec-audit", material); } catch (err) {
    for (const n of numbers) post("issue", n, skipped(err));
    return;
  }
  // The prompt asks for one "## #<n>" section per issue; post each issue its own section.
  for (const n of numbers) {
    const section = new RegExp(`^## #${n}\\b[\\s\\S]*?(?=^## #\\d+|(?![\\s\\S]))`, "m").exec(response)?.[0];
    post("issue", n, report("spec", section ?? response));
  }
}

function prs() {
  const open = JSON.parse(gh("pr", "list", "--state", "open", "--json", "number,body,comments"));
  for (const pr of open.filter((p) => !p.comments.some((c) => c.body.includes(MARKER)))) {
    try {
      const linked = /\b(?:closes|fixes|resolves)\s+#(\d+)/i.exec(pr.body ?? "")?.[1];
      let diff = gh("pr", "diff", String(pr.number));
      if (diff.length > MAX_DIFF) diff = `${diff.slice(0, MAX_DIFF)}\n... (diff truncated; read the rest from disk)\n`;
      const spec = linked ? issueText(linked) : "No linked task spec (no \"Closes #n\" in the pull request).\n";
      const material = `# Task spec\n\n${spec}\n# Pull request #${pr.number}\n\n${pr.body ?? ""}\n\n# Diff\n\n\`\`\`diff\n${diff}\`\`\`\n`;
      post("pr", pr.number, report("pull request", askGemini("pr-audit", material)));
    } catch (err) {
      post("pr", pr.number, skipped(err));
    }
  }
}

function repoWide(promptName, label) {
  const n = pinnedIssue(PINNED[mode]);
  const date = new Date().toISOString().slice(0, 10);
  let text;
  try { text = report(`${label} ${date}`, askGemini(promptName)); } catch (err) { text = skipped(err); }
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
