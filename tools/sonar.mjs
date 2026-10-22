// `node tools/sonar.mjs <pr>`: SonarCloud's findings on a pull request, read through GitHub.
// The SonarCloud project is private, so its own API needs a sign-in; its GitHub check carries the
// quality gate and every finding (file, line, message) instead. This only reads: each gh call is a GET.
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const USAGE = "usage: node tools/sonar.mjs <pull request number>";

function runGh(args) {
  const r = spawnSync("gh", args, { cwd: ROOT, encoding: "utf8", windowsHide: true }); // NOSONAR (javascript:S4036)
  if (r.error) throw new Error(`could not start gh: ${r.error.message}`);
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim());
  return r.stdout;
}

// The check summary's counts are the text of its markdown links, less the "see details" link.
// Link text holds no "[" either, so a run of stray brackets can't make the match retry from each one.
function counts(summary) {
  return [...String(summary ?? "").matchAll(/\[([^[\]]+)\]\(/g)]
    .map((m) => m[1].trim())
    .filter((t) => t && !/^See analysis details/i.test(t));
}

// One block per message, in the order SonarCloud first gave it, listing every place it was found.
function grouped(findings) {
  const byMessage = new Map();
  for (const f of findings) {
    const where = f.start_line > 0 ? `${f.path}:${f.start_line}` : f.path;
    const key = /[?&]issues=([\w-]+)/.exec(f.message ?? "")?.[1];
    const title = (f.title ?? "").trim() || "(no message)";
    if (!byMessage.has(title)) byMessage.set(title, []);
    byMessage.get(title).push(key ? `${where}  (issue ${key})` : where);
  }
  return [...byMessage].flatMap(([title, places]) => [`${places.length} × ${title}`, ...places.map((p) => `  ${p}`)]);
}

export function report(arg, { gh = runGh } = {}) {
  const pr = String(arg ?? "").replace(/^#/, "");
  if (!/^\d+$/.test(pr)) return { code: 1, out: USAGE };
  try {
    const { headRefOid: sha } = JSON.parse(gh(["pr", "view", pr, "--json", "number,headRefOid"]));
    const short = sha.slice(0, 7);
    const { check_runs: runs } = JSON.parse(gh(["api", `repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`]));
    const run = runs
      .filter((r) => /sonar/i.test(`${r.name} ${r.app?.slug ?? ""}`))
      .reduce((a, b) => (a && a.id > b.id ? a : b), null);
    if (!run) return { code: 1, out: `No SonarCloud check on PR #${pr}'s latest commit ${short} yet.` };
    if (run.status !== "completed")
      return { code: 1, out: `SonarCloud is still running on PR #${pr} (${run.status}). Try again in a few minutes.` };

    const lines = gh([
      "api",
      "--paginate",
      `repos/{owner}/{repo}/check-runs/${run.id}/annotations?per_page=100`,
      "--jq",
      ".[]",
    ]);
    const findings = lines
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
    const summary = counts(run.output?.summary);
    const out = [
      `SonarCloud on PR #${pr} (commit ${short}): ${run.output?.title ?? run.conclusion}`,
      summary.join(" · "),
      "",
      ...(findings.length ? grouped(findings) : ["No findings."]),
    ];
    // SonarCloud sends GitHub only so many findings; say so rather than let a short list pass as whole.
    const total = Number(summary.map((t) => /^(\d+) New issues?$/i.exec(t)?.[1]).find(Boolean));
    if (total > findings.length)
      out.push(
        "",
        `GitHub has ${findings.length} of SonarCloud's ${total} new issues. The rest are only on sonarcloud.io, which needs the owner's sign-in.`,
      );
    return { code: 0, out: out.join("\n") };
  } catch (err) {
    return { code: 1, out: `sonar: ${err.message}` };
  }
}

if (import.meta.main) {
  const r = report(process.argv[2]);
  process.stdout.write(`${r.out}\n`);
  process.exit(r.code);
}
