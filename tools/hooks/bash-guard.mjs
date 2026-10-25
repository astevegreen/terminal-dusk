// PreToolUse (Bash): catch disguised versions of denied commands anywhere in a command line.
// Permission rules only match prefixes; this checks every part of a chained command.
// With --read-only (the reviewer), only a short list of inspection commands may run.
// With --unattended (the night shift), owner-only gh commands and skipping git's hooks are blocked.
// By day, gh auth and gh secret are `ask` rules, and this hook lets gh api reads and gh repo view
// through but asks the owner about anything else under gh api or gh repo, and before git's hooks
// are skipped in any spelling the `ask` rules' prefixes miss (git commit -anm, --no-verif).
import path from "node:path";
import { readInput, lockedEntry, deny, decide, git, repoRootFor, canonical } from "./shared.mjs";
import { segments } from "./shell-words.mjs";

const READ_ONLY = process.argv.includes("--read-only");
const UNATTENDED = process.argv.includes("--unattended");
const OWNER_ONLY_GH = new Set(["api", "repo", "auth", "secret"]);
const input = await readInput();
const command = String(input.tool_input?.command ?? "");
const cwd = input.cwd ?? process.cwd();

const NETWORK = new Set([
  "curl", "wget", "invoke-webrequest", "iwr", "invoke-restmethod", "irm", "start-bitstransfer",
]);
const READERS = new Set(["cat", "type", "get-content", "gc", "head", "tail", "less", "more", "bat"]);
const REMOVERS = new Set(["rm", "rmdir", "del", "erase", "rd", "remove-item", "ri"]);
const WRITERS = new Set(["out-file", "set-content", "add-content", "sc", "ac"]);
const COPIERS = new Set(["cp", "mv", "copy-item", "move-item", "copy", "move", "cpi", "mi"]);
const READ_ONLY_ALLOWED = [
  ["git", "diff"], ["git", "log"], ["git", "show"], ["git", "status"], ["git", "fetch"], ["git", "grep"],
  ["gh", "issue", "view"], ["gh", "pr", "view"], ["gh", "pr", "diff"], ["gh", "pr", "list"], ["gh", "pr", "checks"],
  ["head"], ["tail"], ["grep"], ["wc"], ["cat"],
];
const READ_ONLY_LIST = "git diff/log/show/status/fetch/grep, gh issue view, gh pr view/diff/list/checks, head, tail, grep, wc or cat";

// Words bash reads before the command itself: assignments, wrappers with their options (`time -p`, `env -i`), the
// reserved words that start one, and the name in `function f {` or `coproc NAME {`.
const WRAPPERS = new Set(["env", "command", "exec", "sudo", "nohup", "time", "coproc"]);
const LEAD = new Set(["&", "!", "{", "if", "then", "else", "elif", "do", "while", "until"]);

function commandName(words) {
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || LEAD.has(w)) i++;
    else if (WRAPPERS.has(w)) {
      i++;
      while (words[i]?.startsWith("-")) i++;
      if (w === "coproc" && words[i + 1] === "{") i += 2;
    } else if (w === "function") i += words[i + 2] === "{" ? 3 : 2;
    else break;
  }
  const name = (words[i] ?? "").split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, "");
  return { name, args: words.slice(i + 1) };
}

// git's subcommand after global options such as -C <dir>, -c k=v, --no-pager.
function gitSub(args) {
  let i = 0;
  const globals = [];
  while (i < args.length && args[i].startsWith("-")) {
    globals.push(args[i]);
    if (["-C", "-c", "--git-dir", "--work-tree", "--namespace"].includes(args[i])) globals.push(args[++i]);
    i++;
  }
  return { sub: (args[i] ?? "").toLowerCase(), rest: args.slice(i + 1), globals };
}

// gh's subcommand, skipping -R/--repo <owner/repo>.
function ghSub(args) {
  const i = args.findIndex((a, j) => !a.startsWith("-") && !["-R", "--repo"].includes(args[j - 1]));
  return { sub: i < 0 ? undefined : args[i], rest: i < 0 ? [] : args.slice(i + 1) };
}

// gh api flags that take a value: short ones may be bundled (-iXPOST) or joined (-Ftitle=x).
const API_SHORT_VALUE = "HXfFqtp";
const API_LONG_VALUE = new Set(["--header", "--method", "--field", "--raw-field", "--input", "--jq", "--template", "--preview", "--hostname", "--cache"]);
const API_METHOD = new Set(["-X", "--method"]);
const API_BODY = new Set(["-f", "-F", "--field", "--raw-field", "--input"]);

// A gh api call only reads when its method is GET or HEAD and it sends nothing from this PC elsewhere.
// Fields without a method mean POST, GraphQL can hold a mutation, `-F key=@file` and --input send a
// local file, --hostname or a full URL reach another host, and a $ or backtick could expand into anything.
function apiReads(args) {
  if (args.some((a) => /[$`]/.test(a))) return false;
  const methods = [];
  const endpoints = [];
  let body = false;
  let sends = false;
  const take = (flag, value) => {
    const v = String(value ?? "").replace(/^=/, "");
    if (API_METHOD.has(flag)) methods.push(v.toUpperCase());
    if (API_BODY.has(flag)) body = true;
    if (["--input", "--hostname"].includes(flag) || (["-F", "--field"].includes(flag) && /^[^=]*=@/.test(v))) sends = true;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const flag = eq < 0 ? a : a.slice(0, eq);
      if (API_LONG_VALUE.has(flag)) take(flag, eq < 0 ? args[++i] : a.slice(eq + 1));
    } else if (a.startsWith("-") && a.length > 1) {
      const j = [...a.slice(1)].findIndex((c) => API_SHORT_VALUE.includes(c)) + 1;
      if (j > 0) take(`-${a[j]}`, j + 1 < a.length ? a.slice(j + 1) : args[++i]);
    } else endpoints.push(a);
  }
  if (sends || endpoints.some((e) => e === "graphql" || e.includes("://"))) return false;
  if (body && !methods.length) return false;
  return methods.every((m) => m === "GET" || m === "HEAD");
}

// By day: "read" for gh api reads and gh repo view, "write" for any other gh api or gh repo call, else null.
// A call bash might read differently from this hook (quotes glued to text, backslashes, a prefix such
// as GH_HOST=, a path to some other gh, or a $ or backtick that could run a command) counts as a write.
function ghKind(seg) {
  const { name, args } = commandName(seg.words);
  if (name !== "gh") return null;
  const { sub, rest } = ghSub(args);
  if (sub !== "api" && sub !== "repo") return null;
  const exact = seg.plain && /^gh(\.exe)?$/i.test(seg.words[0]) && !seg.words.some((w) => /[$`]/.test(w));
  const reads = exact && (sub === "api" ? apiReads(rest) : rest.find((a) => !a.startsWith("-")) === "view");
  if (!reads) return "write";
  return seg.redirects.length ? null : "read";
}

const isEnvFile = (p) => /^\.env(\..*)?$/i.test(path.basename(p ?? ""));
const worktreeRoot = () => repoRootFor(cwd, cwd);
const outside = (target) => {
  if (process.platform !== "win32" && /^[A-Za-z]:[\\/]/.test(target)) return true; // a Windows absolute path
  const root = worktreeRoot();
  const abs = canonical(path.resolve(cwd, target.replace(/^~(?=$|[\\/])/, process.env.HOME ?? process.env.USERPROFILE ?? "~")));
  const rel = path.relative(root, abs);
  return rel === "" || rel.startsWith("..") || path.isAbsolute(rel);
};

function checkGit(sub, rest) {
  if (sub === "push") {
    if (rest.some((a) => /^(--force(-with-lease|-if-includes)?(=.*)?|-[a-zA-Z]*f[a-zA-Z]*|--mirror)$/.test(a) || /^\+/.test(a)))
      return "force pushes are not allowed. Push a new branch instead.";
    const refs = rest.filter((a) => !a.startsWith("-"));
    if (refs.slice(1).some((r) => /(^|:)(refs\/heads\/)?main$/i.test(r)))
      return "pushing to main is not allowed. Push task/<n> and open a pull request.";
    if (refs.length <= 1 && git(["rev-parse", "--abbrev-ref", "HEAD"], cwd) === "main")
      return "this push would go to main. Switch to a task/<n> branch first.";
  }
  if (sub === "reset" && rest.includes("--hard")) return "git reset --hard can destroy work and is not allowed.";
  if (["clean", "rebase", "filter-branch", "filter-repo"].includes(sub))
    return `git ${sub} rewrites history or deletes files and is not allowed.`;
  return null;
}

// git takes any unambiguous start of a long option, so --no-veri and --no-verif skip hooks too.
const isNoVerify = (a) => a.length >= "--no-veri".length && "--no-verify".startsWith(a);
const COMMIT_LONG_VALUE = /^--(message|file|reuse-message|reedit-message|template|author|date|cleanup|fixup|squash|trailer|pathspec-from-file)$/;

// True when a git commit's options include -n, alone or in a group such as -anm. A group ends at the
// first option that takes a value (-m, -F, -C, -c, -t; -S and -u take theirs attached): -mn is the message "n".
function commitSkipsHooks(rest) {
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--") break;
    if (isNoVerify(a)) return true;
    if (COMMIT_LONG_VALUE.test(a)) i++;
    else if (/^-[^-]/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        if (a[j] === "n") return true;
        if ("mFCct".includes(a[j])) {
          if (j === a.length - 1) i++;
          break;
        }
        if ("Su".includes(a[j])) break;
      }
    }
  }
  return false;
}

// Skipping git's hooks: --no-verify on commit or push, commit's -n, or core.hooksPath set from the command line.
function skipsHooks(seg) {
  const { name, args } = commandName(seg.words);
  if (name !== "git") return false;
  const { sub, rest, globals } = gitSub(args);
  // -c core.hooksPath=x, a bare -c core.hooksPath (git reads it as "true", a folder with no hooks), or
  // --config-env core.hooksPath=VAR (which gitSub reads as the subcommand).
  const setsHooksPath = (a) => /^(--config-env=)?core\.hookspath(=|$)/i.test(a);
  if (globals.some(setsHooksPath) || setsHooksPath(sub)) return true;
  if (sub === "config") return rest.some((a) => /^core\.hookspath$/i.test(a));
  if (sub === "push") return rest.some(isNoVerify);
  return sub === "commit" && commitSkipsHooks(rest);
}

function check(seg) {
  const { name, args } = commandName(seg.words);
  const all = [...args, ...seg.redirects];
  if (seg.inputs.some(isEnvFile)) return ".env files hold secrets and must not be read.";

  if (READ_ONLY) {
    if (seg.redirects.length) return "the reviewer is read-only: output redirects are not allowed.";
    const ok = READ_ONLY_ALLOWED.some((p) => p[0] === name && p.slice(1).every((w, i) => args[i] === w));
    if (!ok) return `the reviewer is read-only: \`${seg.words.join(" ")}\` is not one of ${READ_ONLY_LIST}.`;
    // Words before the command, such as GIT_EXTERNAL_DIFF=x, env or command, could run something else.
    const lead = seg.words.slice(0, seg.words.length - args.length - 1);
    if (lead.some((w) => w !== "MSYS_NO_PATHCONV=1"))
      return "the reviewer is read-only: nothing may come before the command except MSYS_NO_PATHCONV=1.";
    if (args.some(isEnvFile)) return "the reviewer is read-only: .env files hold secrets and must not be read.";
    if (name === "grep" && args.some((a) => /^-[a-zA-Z]*[rRd]/.test(a) || /^--(recursive|dereference-recursive|directories)/.test(a)))
      return "the reviewer is read-only: search files with the Grep tool, not a recursive grep.";
    if (name === "git" && gitSub(args).sub === "fetch" && args.some((a) => a.includes(":")))
      return "the reviewer is read-only: git fetch may update origin's branches, not write a local one.";
    if (name === "git" && (args.some((a) => /^--output(=|$)/.test(a)) || gitSub(args).globals.includes("-c")))
      return "the reviewer is read-only: git --output and -c are not allowed.";
    return null;
  }

  if (name === "git") {
    const { sub, rest } = gitSub(args);
    const why = checkGit(sub, rest);
    if (why) return why;
  }
  if (UNATTENDED && name === "gh") {
    const { sub } = ghSub(args);
    if (OWNER_ONLY_GH.has(sub)) return `gh ${sub} is owner-only and can't run unattended. Ask the owner on the issue instead.`;
  }
  if (UNATTENDED && skipsHooks(seg))
    return "skipping git's hooks (--no-verify, -n or core.hooksPath) needs the owner's OK and can't run unattended. Fix what the hook reports instead.";
  if (NETWORK.has(name) || /\bnet\.webclient\b/i.test(seg.words.join(" ")))
    return `${name} reaches the network, which agents may not do from the shell.`;
  if (READERS.has(name) && args.some(isEnvFile)) return ".env files hold secrets and must not be read.";
  if (REMOVERS.has(name)) {
    const recursive = args.some((a) => /^-[a-zA-Z]*[rR]/.test(a) || /^--recursive$/i.test(a) || /^-recurse$/i.test(a) || /^\/s$/i.test(a));
    const targets = args.filter((a) => !a.startsWith("-") && !/^\/[a-z]$/i.test(a));
    if (recursive && targets.some(outside)) return "recursive delete outside the current worktree is not allowed.";
    const locked = targets.map((t) => lockedEntry(t, cwd)).find(Boolean);
    if (locked) return `${locked} is Locked; deleting it is not allowed.`;
  }
  const writeTargets = [...seg.redirects];
  if (name === "tee") writeTargets.push(...args.filter((a) => !a.startsWith("-")));
  if (WRITERS.has(name)) writeTargets.push(...args.filter((a) => !a.startsWith("-")));
  if (COPIERS.has(name)) writeTargets.push(...args.filter((a) => !a.startsWith("-")).slice(-1));
  if (name === "sed" && args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith("--in-place")))
    writeTargets.push(...args.filter((a) => !a.startsWith("-")).slice(1));
  const locked = writeTargets.filter((t) => t && !/^(\/dev\/null|nul|\$null)$/i.test(t)).map((t) => lockedEntry(t, cwd)).find(Boolean);
  if (locked) return `${locked} is Locked; writing to it from the shell is not allowed.`;
  if (all.some((a) => isEnvFile(a)) && seg.redirects.some(isEnvFile)) return ".env files hold secrets and must not be touched.";
  return null;
}

const { list: segs, complete, unsure } = segments(command);
for (const seg of segs) {
  const why = check(seg);
  if (why) deny(`Blocked by bash-guard: ${why}`);
}
// The reader may have misread the rest of such a line, so nobody can vouch for what it runs (shell-words.mjs).
if (unsure) {
  const why = "it can't be sure what this line runs: the word case inside $(…) or <(…) may start a statement that hides a command.";
  if (READ_ONLY || UNATTENDED) deny(`Blocked by bash-guard: ${why} Write it with if, or in a script file.`);
  decide("ask", `bash-guard: ${why} Check the whole line before it runs.`);
}

if (!READ_ONLY && !UNATTENDED) {
  if (segs.some(skipsHooks))
    decide("ask", "bash-guard: skipping git's hooks (--no-verify, -n or core.hooksPath) needs the owner's OK.");
  const kinds = segs.map(ghKind);
  if (kinds.includes("write"))
    decide("ask", "bash-guard: gh api calls that can change GitHub, and gh repo commands other than view, need the owner's OK.");
  if (complete && kinds.length && kinds.every((k) => k === "read"))
    decide("allow", "bash-guard: read-only gh api or gh repo view call.");
}
