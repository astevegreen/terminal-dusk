// SessionStart (startup): check this machine is set up the way the project expects.
// Problems are shown to the owner (systemMessage), never added to Claude's context.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

function run(cmd) {
  return new Promise((resolve) => {
    const p = spawn(cmd, { shell: true, windowsHide: true, stdio: "ignore" });
    const timer = setTimeout(() => { p.kill(); resolve(false); }, 10_000);
    p.on("error", () => { clearTimeout(timer); resolve(false); });
    p.on("exit", (code) => { clearTimeout(timer); resolve(code === 0); });
  });
}

const problems = [];

if (process.env.ANTHROPIC_API_KEY) {
  problems.push("ANTHROPIC_API_KEY is set, so Claude Code bills the API instead of your plan. Remove it from your environment variables.");
}

if (process.platform === "win32") {
  const candidates = [
    process.env.CLAUDE_CODE_GIT_BASH_PATH,
    "C:\\Program Files\\Git\\bin\\bash.exe",
    `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
  ];
  if (!candidates.some((c) => c && existsSync(c))) problems.push("Git Bash was not found. Install Git for Windows (it includes Git Bash).");
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 24) problems.push(`Node ${process.versions.node} is too old; install Node 24 or newer.`);

const [pnpm, gh, ghAuth] = await Promise.all([run("pnpm --version"), run("gh --version"), run("gh auth status")]);
if (!pnpm) problems.push("pnpm was not found. Install it, then restart the Claude app so it sees the new PATH.");
if (!gh) problems.push("The GitHub CLI (gh) was not found. Install it from cli.github.com.");
else if (!ghAuth) problems.push("The GitHub CLI isn't signed in. Run: gh auth login");

if (problems.length) {
  process.stdout.write(JSON.stringify({ systemMessage: `Terminal Dusk setup:\n- ${problems.join("\n- ")}` }));
}
