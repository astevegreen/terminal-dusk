import { test } from "node:test";
import assert from "node:assert/strict";
import { mirror, target, MIRROR } from "./sonar-mirror.mjs";

const PROJECT = "astevegreen_terminal-dusk";
const env = (over = {}) => ({
  SONAR_TOKEN: "sonar-secret",
  GH_TOKEN: "gh-token",
  GITHUB_REPOSITORY: "astevegreen/terminal-dusk",
  HEAD_SHA: "71883034921adc52a93a073e2986ba22aa773a9d",
  DETAILS_URL: `https://sonarcloud.io/dashboard?id=${PROJECT}&pullRequest=246`,
  ...over,
});
const issue = (key, path, line, over = {}) => ({
  key,
  rule: "typescript:S1234",
  severity: "MAJOR",
  type: "CODE_SMELL",
  component: path ? `${PROJECT}:${path}` : PROJECT,
  message: `Fix ${key}.`,
  ...(line ? { line, textRange: { startLine: line, endLine: line + 1 } } : {}),
  ...over,
});

// A stand-in for fetch: answers SonarCloud's four endpoints and GitHub's check-runs, and records each call.
function fakeFetch({ issues = [], gate = { status: "OK", conditions: [] }, files = [], dups = {}, status = 200 } = {}) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({
      url: u,
      method: init.method ?? "GET",
      headers: init.headers,
      body: init.body && JSON.parse(init.body),
    });
    const json = (body) => ({ ok: status < 400, status, json: async () => body });
    if (u.pathname.endsWith("/qualitygates/project_status")) return json({ projectStatus: gate });
    if (u.pathname.endsWith("/issues/search")) {
      const p = Number(u.searchParams.get("p"));
      const ps = Number(u.searchParams.get("ps"));
      return json({ issues: issues.slice((p - 1) * ps, p * ps), paging: { total: issues.length } });
    }
    if (u.pathname.endsWith("/measures/component_tree")) return json({ components: files });
    if (u.pathname.endsWith("/duplications/show")) return json(dups[u.searchParams.get("key")] ?? {});
    if (u.pathname.endsWith("/check-runs")) return json({ id: 77 });
    return json({});
  };
  return { fetchFn, calls };
}

test("target reads the project and the pull request or branch from SonarCloud's details link", () => {
  assert.deepEqual(target(`https://sonarcloud.io/dashboard?id=${PROJECT}&pullRequest=246`), {
    project: PROJECT,
    scope: { pullRequest: "246" },
  });
  assert.deepEqual(target(`https://sonarcloud.io/dashboard?id=${PROJECT}&branch=main`), {
    project: PROJECT,
    scope: { branch: "main" },
  });
  assert.throws(() => target("https://sonarcloud.io/dashboard?branch=main"), /no SonarCloud project/);
});

test("it posts one finished, neutral check with every finding as an annotation sonar.mjs can read", async () => {
  const { fetchFn, calls } = fakeFetch({
    issues: [issue("A1", "src/a.ts", 12, { severity: "CRITICAL" }), issue("B1", "src/b.test.ts", 0), issue("P1", "")],
    gate: {
      status: "ERROR",
      conditions: [{ status: "ERROR", metricKey: "new_reliability_rating", actualValue: "4", errorThreshold: "1" }],
    },
  });
  const line = await mirror({ env: env(), fetchFn });
  const post = calls.find((c) => c.method === "POST");
  assert.equal(post.url.href, "https://api.github.com/repos/astevegreen/terminal-dusk/check-runs");
  assert.equal(post.headers.Authorization, "Bearer gh-token");
  assert.equal(post.body.name, MIRROR);
  assert.equal(post.body.head_sha, env().HEAD_SHA);
  assert.equal(post.body.conclusion, "neutral");
  assert.equal(post.body.output.title, "Quality Gate failed: new_reliability_rating");
  assert.match(post.body.output.summary, /\[3 New issues\]\(/);
  assert.match(post.body.output.summary, /- new_reliability_rating is 4; the limit is 1/);
  const [a, b] = post.body.output.annotations;
  assert.deepEqual(
    { path: a.path, start_line: a.start_line, end_line: a.end_line, level: a.annotation_level, title: a.title },
    { path: "src/a.ts", start_line: 12, end_line: 13, level: "failure", title: "Fix A1." },
  );
  assert.match(a.message, /[?&]issues=A1&/);
  assert.equal(b.start_line, 1, "a finding on the whole file sits on line 1");
  assert.equal(post.body.output.annotations.length, 2, "a finding on the whole project has no file to sit on");
  assert.match(line, /3 issues, 0 duplicated files, 2 annotations on 7188303/);
});

test("it asks SonarCloud with the token about this pull request only, and for new code on a branch", async () => {
  const pr = fakeFetch();
  await mirror({ env: env(), fetchFn: pr.fetchFn });
  for (const c of pr.calls.filter((x) => x.url.host === "sonarcloud.io")) {
    assert.equal(c.headers.Authorization, "Bearer sonar-secret");
    assert.equal(c.url.searchParams.get("pullRequest"), "246", c.url.pathname);
    assert.equal(c.method, "GET");
  }
  const main = fakeFetch();
  await mirror({
    env: env({ DETAILS_URL: `https://sonarcloud.io/dashboard?id=${PROJECT}&branch=main` }),
    fetchFn: main.fetchFn,
  });
  const search = main.calls.find((c) => c.url.pathname.endsWith("/issues/search"));
  assert.equal(search.url.searchParams.get("branch"), "main");
  assert.equal(search.url.searchParams.get("inNewCodePeriod"), "true");
  assert.ok(main.calls.every((c) => c.url.host !== "api.github.com" || /check-runs/.test(c.url.pathname)));
});

test("a file over 3% duplicated lines gets an annotation naming where the copy is", async () => {
  const fileKey = `${PROJECT}:src/x.ts`;
  const { fetchFn, calls } = fakeFetch({
    files: [
      { key: fileKey, measures: [{ metric: "new_duplicated_lines_density", period: { value: "12.5" } }] },
      { key: `${PROJECT}:src/ok.ts`, measures: [{ metric: "new_duplicated_lines_density", value: "1.0" }] },
    ],
    dups: {
      [fileKey]: {
        duplications: [
          {
            blocks: [
              { from: 10, size: 5, _ref: "1" },
              { from: 40, size: 5, _ref: "2" },
            ],
          },
        ],
        files: { 1: { key: fileKey }, 2: { key: `${PROJECT}:src/y.ts` } },
      },
    },
  });
  await mirror({ env: env(), fetchFn });
  assert.equal(calls.filter((c) => c.url.pathname.endsWith("/duplications/show")).length, 1);
  const [dup] = calls.find((c) => c.method === "POST").body.output.annotations;
  assert.deepEqual(
    { path: dup.path, start_line: dup.start_line, end_line: dup.end_line, title: dup.title, message: dup.message },
    { path: "src/x.ts", start_line: 10, end_line: 14, title: "Duplicated lines", message: "Also in src/y.ts:40-44." },
  );
});

test("more than 50 annotations go in batches of 50: one POST, then PATCHes to the same check", async () => {
  const many = Array.from({ length: 120 }, (_, i) => issue(`K${i}`, `src/f${i}.ts`, i + 1));
  const { fetchFn, calls } = fakeFetch({ issues: many });
  await mirror({ env: env(), fetchFn });
  const writes = calls.filter((c) => c.method !== "GET");
  assert.deepEqual(
    writes.map((c) => `${c.method} ${c.url.pathname}`),
    [
      "POST /repos/astevegreen/terminal-dusk/check-runs",
      "PATCH /repos/astevegreen/terminal-dusk/check-runs/77",
      "PATCH /repos/astevegreen/terminal-dusk/check-runs/77",
    ],
  );
  assert.deepEqual(
    writes.map((c) => c.body.output.annotations.length),
    [50, 50, 20],
  );
});

test("without SONAR_TOKEN it copies nothing and calls nothing", async () => {
  const { fetchFn, calls } = fakeFetch();
  const line = await mirror({ env: env({ SONAR_TOKEN: "" }), fetchFn });
  assert.match(line, /SONAR_TOKEN is not set/);
  assert.equal(calls.length, 0);
});

test("a SonarCloud error stops it with the endpoint's name, before anything is written", async () => {
  const { fetchFn, calls } = fakeFetch({ status: 401 });
  await assert.rejects(mirror({ env: env(), fetchFn }), /SonarCloud qualitygates\/project_status: HTTP 401/);
  assert.ok(calls.every((c) => c.method === "GET"));
});
