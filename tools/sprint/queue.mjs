// `node tools/sprint/queue.mjs <command>`: the sprint's queue rules, asked by the supervisor, the lanes and
// the night shift instead of each applying its own prose copy. Prints one line of JSON:
//   has-work "<session title>" [--started <k>]   {"start": bool, "reason": "…"}; k sessions this run already started
//   next <lane|night> [--fixes-done <k>]   the next job, or null
//   move <n> <state> [--note "…"] [--conflict] [--dry-run]   {"moved": n, "to": state, "ran": [...]}, or {"error", "do"}
//   backlog <lane>                 {"ready": n, "target": n, "todo": [backlog IDs with no issue yet]}, for sprint-plan
//   status [--need "…"]... [--write]   {"body": "…", "needsYou": [...], "newNeeds": [...]}; --write puts the body on the sprint log issue
//   env                            {"environment_id": "env_…"}, the computer sessions start on, recorded by
//                                  window start --environment (or a docs/sprint.md **Environment:** line)
//   window [start [hours] [--environment <env_…>] [--dry-run] | ids [--supervisor|--archiver|--wake <id>] | stop | archived]
//                                  {"state", "start", …, "stoppedBy"}; stop records stoppedBy "sprint-stop"
//   wake [--resets-at <epoch s>]   {"wake", "arm", "runOnceAt", "reason"}: where the supervisor's wake goes (wake.mjs)
//   started "<session title>" <trigger id>    records a trigger the supervisor created; sessions [--all] reads them
//   night-shift                    {"active", "building", "reason"}: night-shift tasks still in flight
//   resume - --last-event <ISO>   the end of a run's log on stdin; {"start", "after", "restartAt", "reason"}
// The rules are in rules.mjs (and moves.mjs, cue.mjs, usage-limit.mjs); this file loads GitHub's state and runs
// the planned gh commands. docs/sprint.md is read as origin/main has it; the window is this computer's own
// (local-state.mjs), which /sprint-start sets.
// `--fixture <file.jsonl> --at <ISO time> [--free-mb <n>]` answers from a recorded sprint instead of GitHub.
// `--doc <file>` reads that sprint document instead, and the window from it alone.
// Any failure prints {"error", "do"} and exits 2: the caller stops and reports, and never falls back to prose.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { report } from "../sonar.mjs";
import { cueCommand, nightShiftWork, withLocalWindow } from "./cue.mjs";
import { stateDir } from "./local-state.mjs";
import { OWNER, SONAR_CHECK, backlog, hasWork, next, nextNight } from "./rules.mjs";
import { status } from "./status.mjs";
import { planMove } from "./moves.mjs";
import { readFixture, snapshotAt } from "./replay.mjs";
import { readSprintDoc } from "./sprint-doc.mjs";
import { resumeAfter } from "./usage-limit.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const STOP = "Stop and report this error to the owner; don't fall back to the prose rules.";
const USAGE =
  'usage: queue.mjs has-work "<title>" [--started <k>] | next <lane|night> [--fixes-done <k>] | move <n> <state> [--note "…"] [--conflict] [--dry-run] | backlog <lane> | status [--need "…"] [--write] | env | window [start [hours] [--environment <env_…>] | ids [--supervisor|--archiver|--wake <trig_…>] | stop | archived] | wake [--resets-at <epoch s>] | started "<title>" <trigger id> | sessions [--all] | night-shift | resume - --last-event <ISO> (the log on stdin)';
const SESSION_MB = 1536; // what one new session is counted as using before it shows in free memory

export function runGh(args) {
  const r = spawnSync("gh", args, { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 }); // NOSONAR (javascript:S4036)
  if (r.error) throw new Error(`could not start gh: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(" ")}: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout;
}

// statusCheckRollup holds check runs (status, conclusion) and commit statuses (state).
function checkOf(c) {
  const name = c.name ?? c.context;
  const raw = String(c.conclusion || c.state || "").toUpperCase();
  if (c.status && c.status !== "COMPLETED") return { name, state: "PENDING" };
  if (["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(raw))
    return { name, state: "FAILURE" };
  return { name, state: ["SUCCESS", "NEUTRAL", "SKIPPED"].includes(raw) ? "SUCCESS" : "PENDING" };
}
const commentsOf = (cs = []) =>
  cs.map((c) => ({ author: c.author?.login ?? "", createdAt: c.createdAt, body: c.body ?? "" }));
const depsOf = (body) => /###\s*Depends on\s*\r?\n+([\s\S]*?)(\r?\n###|$)/i.exec(body ?? "")?.[1].trim() ?? null;

// GitHub's state as a snapshot for rules.mjs: open items in full, closed ones by number and title.
export function loadSnapshot({
  gh = runGh,
  now = new Date(),
  freeMb = Math.floor(os.freemem() / 1048576),
  localMinutes = now.getHours() * 60 + now.getMinutes(),
} = {}) {
  const json = (args) => JSON.parse(gh(args));
  const openIssues = json([
    "issue",
    "list",
    "--state",
    "open",
    "--limit",
    "500",
    "--json",
    "number,title,labels,body,comments",
  ]);
  const allIssues = json(["issue", "list", "--state", "all", "--limit", "2000", "--json", "number,title,state"]);
  const openPrs = json([
    "pr",
    "list",
    "--state",
    "open",
    "--limit",
    "300",
    "--json",
    "number,title,isDraft,headRefName,baseRefName,labels,mergeable,statusCheckRollup,autoMergeRequest,closingIssuesReferences,comments,reviewRequests",
  ]);
  const allPrs = json([
    "pr",
    "list",
    "--state",
    "all",
    "--limit",
    "2000",
    "--json",
    "number,state,headRefName,baseRefName,closingIssuesReferences",
  ]);
  const awaitingOwner = new Set(
    json(["pr", "list", "--state", "open", "--search", "review:required", "--json", "number"]).map((p) => p.number),
  );
  const mainChangedAt = gh(["api", "repos/{owner}/{repo}/commits/main", "--jq", ".commit.committer.date"]).trim();

  const open = new Map(openIssues.map((i) => [i.number, i]));
  const issues = allIssues.map((i) => {
    const o = open.get(i.number);
    return {
      number: i.number,
      title: i.title,
      state: o ? "OPEN" : i.state,
      labels: (o?.labels ?? []).map((l) => l.name),
      deps: depsOf(o?.body),
      comments: commentsOf(o?.comments),
    };
  });
  const full = new Map(openPrs.map((p) => [p.number, p]));
  const prs = allPrs.map((p) => {
    const o = full.get(p.number);
    return {
      number: p.number,
      title: o?.title ?? "",
      state: o ? "OPEN" : p.state,
      isDraft: Boolean(o?.isDraft),
      head: p.headRefName,
      base: p.baseRefName,
      labels: (o?.labels ?? []).map((l) => l.name),
      mergeable: o?.mergeable ?? "UNKNOWN",
      autoMerge: Boolean(o?.autoMergeRequest),
      checks: (o?.statusCheckRollup ?? []).map(checkOf),
      closes: (p.closingIssuesReferences ?? []).map((r) => r.number),
      reviewRequired: awaitingOwner.has(p.number),
      reviewers: (o?.reviewRequests ?? []).map((r) => r.login),
      comments: commentsOf(o?.comments),
    };
  });
  // Sonar's findings only for pull requests whose Sonar check failed (tools/sonar.mjs, read through GitHub).
  const sonar = {};
  for (const p of prs.filter((x) => x.checks.some((c) => c.name === SONAR_CHECK && c.state === "FAILURE"))) {
    const r = report(String(p.number), { gh });
    if (r.code !== 0) throw new Error(r.out);
    sonar[p.number] = r.out
      .split("\n")
      .map((l) => /^\d+ × (.*)$/.exec(l)?.[1])
      .filter(Boolean);
  }
  return { now, freeMb, localMinutes, owner: OWNER, issues, prs, sonar, mainChangedAt };
}

// The extra facts the status block shows: merges since the window opened, and the last merge to main with CI.
function statusFacts(doc, gh) {
  const json = (args) => JSON.parse(gh(args));
  const since = doc.window?.start?.toISOString().slice(0, 16);
  const merged = since
    ? json([
        "pr",
        "list",
        "--state",
        "merged",
        "--search",
        `merged:>=${since}:00Z`,
        "--limit",
        "500",
        "--json",
        "number,labels",
      ]).map((p) => ({ number: p.number, labels: p.labels.map((l) => l.name) }))
    : [];
  const [last] = json([
    "pr",
    "list",
    "--state",
    "merged",
    "--base",
    "main",
    "--limit",
    "1",
    "--json",
    "number,title,mergedAt",
  ]);
  const [run] = json([
    "run",
    "list",
    "--branch",
    "main",
    "--workflow",
    "CI",
    "--limit",
    "1",
    "--json",
    "conclusion,status",
  ]);
  const oldBody = doc.logIssue ? json(["issue", "view", String(doc.logIssue), "--json", "body"]).body : "";
  return { merged, lastMain: last && { ...last, ci: run ? run.conclusion || run.status : "unknown" }, oldBody };
}

// docs/sprint.md as main has it (origin/main, as of the last fetch), so a checkout left on another branch still
// reads the sprint's lanes and backlog. The working tree's copy only when there is no origin/main.
function mainDoc() {
  const ref = "origin/main:docs/sprint.md";
  const r = spawnSync("git", ["show", ref], { cwd: ROOT, encoding: "utf8", windowsHide: true }); // NOSONAR (javascript:S4036)
  if (r.status === 0) return r.stdout;
  if (/does not exist in|exists on disk, but not in/.test(r.stderr ?? "")) return ""; // between sprints
  const file = path.join(ROOT, "docs", "sprint.md");
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

function option(args, name) {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
}
const options = (args, name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));

// Runs one command; returns { code, out } with `out` a single line of JSON.
// `dir` is the local state folder; tests pass their own, and --doc or --fixture use none. `stdin` reads `resume -`.
export function main(
  argv,
  { gh = runGh, docText, now, freeMb, localMinutes, dir, stdin = () => readFileSync(0, "utf8") } = {},
) {
  const line = (value, code = 0) => ({ code, out: JSON.stringify(value) });
  try {
    // Between sprints docs/sprint.md may be gone: then there is no window and no lane, and the night shift runs.
    const docFile = option(argv, "--doc");
    const fixture = option(argv, "--fixture");
    const alone = docText !== undefined || docFile || fixture;
    let text = docText;
    if (text === undefined && docFile) text = existsSync(docFile) ? readFileSync(docFile, "utf8") : "";
    text ??= mainDoc();
    let local = dir;
    if (local === undefined) local = alone ? null : stateDir(ROOT);
    const doc = withLocalWindow(readSprintDoc(text), local);
    const clock = now ?? new Date();
    if (argv[0] === "env") {
      if (!doc.environment)
        throw new Error(
          "no environment is on record: /sprint-start records it with `window start --environment <env_…>`, so a new session has nowhere to run",
        );
      return line({ environment_id: doc.environment });
    }
    const cue = cueCommand(argv, { doc, dir: local, now: clock, option });
    if (cue) return line(cue.value, cue.code);
    if (argv[0] === "resume") {
      if (argv[1] !== "-") throw new Error(USAGE);
      return line(resumeAfter(stdin(), { lastEventAt: option(argv, "--last-event"), now: clock }));
    }
    const freeOpt = option(argv, "--free-mb");
    const S = fixture
      ? snapshotAt(readFixture(readFileSync(fixture, "utf8")), option(argv, "--at") ?? now ?? new Date(), {
          freeMb: Number(freeOpt ?? freeMb ?? 16000),
        })
      : loadSnapshot({
          gh,
          ...(now && { now }),
          ...(freeMb !== undefined && { freeMb }),
          ...(localMinutes !== undefined && { localMinutes }),
        });
    const [cmd, a1, a2] = argv;
    if (cmd === "has-work" && a1) {
      const started = Number(option(argv, "--started") ?? 0);
      const r = hasWork({ ...S, freeMb: S.freeMb - SESSION_MB * started }, doc, a1);
      return line(
        started && /MB free/.test(r.reason)
          ? {
              ...r,
              reason: `${r.reason}, counting ${SESSION_MB} MB for each of the ${started} sessions started this run`,
            }
          : r,
      );
    }
    if (cmd === "night-shift") return line(nightShiftWork(S));
    if (cmd === "next" && a1) {
      const fixesDone = Number(option(argv, "--fixes-done") ?? 0);
      if (a1 === "night") return line(nextNight(S, doc, { fixesDone }));
      if (!doc.lanes.includes(a1))
        throw new Error(`unknown lane "${a1}"; docs/sprint.md has ${doc.lanes.join(", ") || "no lanes"}`);
      return line(next(S, doc, a1, { fixesDone }));
    }
    if (cmd === "backlog" && a1) {
      if (!doc.lanes.includes(a1))
        throw new Error(`unknown lane "${a1}"; docs/sprint.md has ${doc.lanes.join(", ") || "no lanes"}`);
      return line(backlog(S, doc, a1));
    }
    if (cmd === "status") {
      const facts = fixture ? {} : statusFacts(doc, gh);
      const block = status(S, doc, { ...facts, need: options(argv, "--need") });
      if (argv.includes("--write")) {
        if (!doc.logIssue)
          throw new Error("docs/sprint.md names no sprint log issue (Machinery), so there is no status block to write");
        if (!fixture) gh(["issue", "edit", String(doc.logIssue), "--body", block.body]);
      }
      return line(block);
    }
    if (cmd === "move" && a1 && a2) {
      const plan = planMove(S, a1, a2, { note: option(argv, "--note"), conflict: argv.includes("--conflict") });
      if (plan.error) return line(plan, 1);
      const ran = plan.steps.map((s) => ["gh", ...s]);
      if (!fixture && !argv.includes("--dry-run")) for (const s of plan.steps) gh(s);
      return line({
        moved: Number(a1),
        to: a2,
        ran,
        ...(fixture || argv.includes("--dry-run") ? { dryRun: true } : {}),
      });
    }
    throw new Error(USAGE);
  } catch (err) {
    return line({ error: err.message, do: STOP }, 2);
  }
}

if (import.meta.main) {
  const r = main(process.argv.slice(2));
  process.stdout.write(`${r.out}\n`);
  process.exit(r.code);
}
