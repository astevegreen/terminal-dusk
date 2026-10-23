// `node tools/sonar-mirror.mjs`, run by .github/workflows/sonar-findings.yml each time SonarCloud finishes a
// commit: copies SonarCloud's findings into a GitHub check named "Sonar findings", which `node tools/sonar.mjs`
// reads. SonarCloud's own check carries only some findings, none for duplicated code, and its API needs a token
// agents never see. This reads SonarCloud and writes only that one check.
// Env: SONAR_TOKEN, GH_TOKEN, GITHUB_REPOSITORY, HEAD_SHA, DETAILS_URL (the SonarCloud check's details link).

export const MIRROR = "Sonar findings";
const SONAR = "https://sonarcloud.io";
const GITHUB = "https://api.github.com";
const MAX_FINDINGS = 1000;
const PER_REQUEST = 50; // GitHub takes at most 50 annotations per request
const DUPLICATION_LIMIT = 3; // percent of new lines, the quality gate's condition

// Which analysis a SonarCloud check describes, from its details link:
// https://sonarcloud.io/dashboard?id=<project>&pullRequest=<n>, or &branch=<name> for a branch.
export function target(detailsUrl) {
  const q = new URL(detailsUrl).searchParams;
  const project = q.get("id");
  if (!project) throw new Error(`no SonarCloud project in ${detailsUrl}`);
  const pr = q.get("pullRequest");
  return { project, scope: pr ? { pullRequest: pr } : { branch: q.get("branch") || "main" } };
}

const pathOf = (project, component) => (component.startsWith(`${project}:`) ? component.slice(project.length + 1) : "");
const scopeQuery = (scope) => new URLSearchParams(scope).toString();
const LEVEL = { BLOCKER: "failure", CRITICAL: "failure", MAJOR: "warning" };

function issueAnnotations(project, scope, issues) {
  return issues
    .map((i) => {
      const path = pathOf(project, i.component);
      if (!path) return null;
      const start = i.textRange?.startLine ?? i.line ?? 1;
      const link = `${SONAR}/project/issues?id=${project}&issues=${i.key}&open=${i.key}&${scopeQuery(scope)}`;
      return {
        path,
        start_line: start,
        end_line: Math.max(start, i.textRange?.endLine ?? start),
        annotation_level: LEVEL[i.severity] ?? "notice",
        title: i.message,
        message: `${i.rule} (${String(i.type).toLowerCase()}, ${String(i.severity).toLowerCase()})\nSee more on ${link}`,
      };
    })
    .filter(Boolean);
}

// duplications/show lists blocks per duplication; `_ref` names a file in `files`. The block in this file is the
// annotation; the others say where the copy is.
function duplicationAnnotations(project, path, shown) {
  const fileOf = (ref) => pathOf(project, shown.files?.[ref]?.key ?? "") || shown.files?.[ref]?.name || "?";
  return (shown.duplications ?? []).flatMap(({ blocks = [] }) => {
    const here = blocks.find((b) => fileOf(b._ref) === path);
    if (!here) return [];
    const copies = blocks.filter((b) => b !== here).map((b) => `${fileOf(b._ref)}:${b.from}-${b.from + b.size - 1}`);
    return [
      {
        path,
        start_line: here.from,
        end_line: here.from + here.size - 1,
        annotation_level: "warning",
        title: "Duplicated lines",
        message: `Also in ${copies.join(", ") || "this file"}.`,
      },
    ];
  });
}

const valueOf = (m) => Number(m?.value ?? m?.period?.value ?? m?.periods?.[0]?.value ?? 0);

function summary({ project, scope, gate, total, annotations, duplicated }) {
  const where = scope.pullRequest ? `pullRequest=${scope.pullRequest}` : `branch=${scope.branch}`;
  const failed = (gate.conditions ?? []).filter((c) => c.status === "ERROR");
  return [
    `Quality Gate ${gate.status === "OK" ? "passed" : "failed"} on SonarCloud.`,
    ...failed.map((c) => `- ${c.metricKey} is ${c.actualValue}; the limit is ${c.errorThreshold}`),
    "",
    `[${total} New issues](${SONAR}/project/issues?id=${project}&${where}&resolved=false)`,
    `[${duplicated.length} files over ${DUPLICATION_LIMIT}% duplicated lines](${SONAR}/component_measures?id=${project}&${where}&metric=new_duplicated_lines_density)`,
    "",
    `${annotations.length} findings are annotations on this check: \`node tools/sonar.mjs\` lists them.`,
  ].join("\n");
}

export async function mirror({ env = process.env, fetchFn = fetch } = {}) {
  if (!env.SONAR_TOKEN) return "SONAR_TOKEN is not set, so nothing was copied (the owner adds it once).";
  const { project, scope } = target(env.DETAILS_URL);
  const sonar = async (endpoint, params) => {
    const r = await fetchFn(`${SONAR}/api/${endpoint}?${new URLSearchParams({ ...params, ...scope })}`, {
      headers: { Authorization: `Bearer ${env.SONAR_TOKEN}` },
    });
    if (!r.ok) throw new Error(`SonarCloud ${endpoint}: HTTP ${r.status}`);
    return r.json();
  };
  const github = async (method, url, body) => {
    const r = await fetchFn(`${GITHUB}/repos/${env.GITHUB_REPOSITORY}/${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`GitHub ${method} ${url}: HTTP ${r.status}`);
    return r.json();
  };

  const { projectStatus: gate } = await sonar("qualitygates/project_status", { projectKey: project });
  // On a branch, the new-code period is what the gate judges; a pull request is all new code.
  const newCode = scope.branch ? { inNewCodePeriod: "true" } : {};
  const issues = [];
  let total = 0;
  for (let p = 1; issues.length < MAX_FINDINGS; p++) {
    const page = await sonar("issues/search", {
      componentKeys: project,
      resolved: "false",
      ...newCode,
      ps: "500",
      p: String(p),
    });
    issues.push(...page.issues);
    total = page.paging?.total ?? issues.length;
    if (!page.issues.length || issues.length >= total) break;
  }
  const tree = await sonar("measures/component_tree", {
    component: project,
    metricKeys: "new_duplicated_lines_density",
    qualifiers: "FIL",
    ps: "500",
  });
  const duplicated = (tree.components ?? []).filter((c) => valueOf(c.measures?.[0]) > DUPLICATION_LIMIT);
  const annotations = issueAnnotations(project, scope, issues);
  for (const file of duplicated.slice(0, 20)) {
    const shown = await sonar("duplications/show", { key: file.key });
    annotations.push(...duplicationAnnotations(project, pathOf(project, file.key), shown));
  }
  const kept = annotations.slice(0, MAX_FINDINGS);

  const failed = (gate.conditions ?? []).filter((c) => c.status === "ERROR").map((c) => c.metricKey);
  const output = {
    title: gate.status === "OK" ? "Quality Gate passed" : `Quality Gate failed: ${failed.join(", ") || gate.status}`,
    summary: summary({ project, scope, gate, total, annotations: kept, duplicated }),
  };
  const run = await github("POST", "check-runs", {
    name: MIRROR,
    head_sha: env.HEAD_SHA,
    status: "completed",
    conclusion: "neutral",
    output: { ...output, annotations: kept.slice(0, PER_REQUEST) },
  });
  for (let i = PER_REQUEST; i < kept.length; i += PER_REQUEST) {
    await github("PATCH", `check-runs/${run.id}`, {
      output: { ...output, annotations: kept.slice(i, i + PER_REQUEST) },
    });
  }
  return `${MIRROR}: ${total} issues, ${duplicated.length} duplicated files, ${kept.length} annotations on ${String(env.HEAD_SHA).slice(0, 7)}.`;
}

if (import.meta.main) {
  mirror().then(
    (line) => process.stdout.write(`${line}\n`),
    (err) => {
      process.stderr.write(`sonar-mirror: ${err.message}\n`);
      process.exit(1);
    },
  );
}
