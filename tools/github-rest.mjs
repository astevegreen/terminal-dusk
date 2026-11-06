// Pull request and issue reads and comments through GitHub's REST API (`gh api`). `gh pr view`, `gh issue view` and
// `gh pr comment` use GitHub's GraphQL API, which cloud sessions can't reach (HTTP 403, "use the REST API"); REST
// works everywhere gh is signed in. gh is (args) => stdout. Each function returns the shape the GraphQL commands gave,
// so the callers' rules (tools/github-trust.mjs, tools/gemini/rails.mjs) read it unchanged.

// The fields auditPr asked `gh pr view --json number,body,headRefOid,isCrossRepository` for.
export function pullRequest(gh, n) {
  const p = JSON.parse(gh(["api", `repos/{owner}/{repo}/pulls/${n}`]));
  return { number: p.number, body: p.body ?? "", headRefOid: p.head?.sha, isCrossRepository: crossRepository(p) };
}

// A branch in another repository than the base's. A deleted fork has no head repository: that fails closed, as a fork.
function crossRepository(p) {
  const head = p.head?.repo?.full_name;
  return !head || head !== p.base?.repo?.full_name;
}

// Every comment on an issue or pull request, oldest first, as { author: { login }, authorAssociation, body }.
export function comments(gh, n) {
  const out = gh(["api", "--paginate", `repos/{owner}/{repo}/issues/${n}/comments?per_page=100`, "--jq", ".[]"]);
  return out
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
    .map((c) => ({
      author: { login: c.user?.login ?? "" },
      authorAssociation: c.author_association,
      body: c.body ?? "",
    }));
}

// An issue's number, title and body (a pull request's too: GitHub serves both as issues).
export function issue(gh, n) {
  const i = JSON.parse(gh(["api", `repos/{owner}/{repo}/issues/${n}`]));
  return { number: i.number, title: i.title ?? "", body: i.body ?? "" };
}

// Posts the text in `file` as a comment on issue or pull request n.
export function comment(gh, n, file) {
  gh(["api", "--method", "POST", `repos/{owner}/{repo}/issues/${n}/comments`, "-F", `body=@${file}`]);
}
