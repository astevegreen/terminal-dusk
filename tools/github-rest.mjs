// Pull request and issue reads and writes through GitHub's REST API (`gh api`). The `gh pr` and `gh issue` commands
// they stand in for use GitHub's GraphQL API, which cloud sessions can't reach (HTTP 403, "use the REST API"); REST
// works everywhere gh is signed in. gh is (args) => stdout. Each read returns the shape the GraphQL command gave, so
// the callers' rules (tools/github-trust.mjs, tools/gemini/rails.mjs) read it unchanged.
import { trustedComment } from "./github-trust.mjs";

// GitHub refused the request: what a cloud session gets from a `gh` command that needs GraphQL.
export const is403 = (err) => /HTTP 403|403 Forbidden/.test(err.message);

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

// Every item of a paged list. `tojson` prints each one on its own line even where gh would pretty-print
// (GH_FORCE_TTY).
function everyItem(gh, page) {
  const out = gh(["api", "--paginate", page, "--jq", ".[] | tojson"]);
  return out
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

// Every comment on an issue or pull request, oldest first, as { author: { login }, authorAssociation, body }.
export function comments(gh, n) {
  return everyItem(gh, `repos/{owner}/{repo}/issues/${n}/comments?per_page=100`).map((c) => ({
    author: { login: c.user?.login ?? "" },
    authorAssociation: c.author_association,
    body: c.body ?? "",
  }));
}

// Every open pull request, as { number, isCrossRepository }.
export function openPullRequests(gh) {
  return everyItem(gh, "repos/{owner}/{repo}/pulls?state=open&per_page=100").map((p) => ({
    number: p.number,
    isCrossRepository: crossRepository(p),
  }));
}

// Every open issue, as { number, title, author: { login } }. GitHub lists pull requests as issues too: not here.
export function openIssues(gh) {
  return everyItem(gh, "repos/{owner}/{repo}/issues?state=open&per_page=100")
    .filter((i) => !i.pull_request)
    .map((i) => ({ number: i.number, title: i.title ?? "", author: { login: i.user?.login ?? "" } }));
}

// How a comment that settles part of a task opens: an architect or owner Decision (the architect's answer on #672
// lists the forms). "Owner's yes" and any other "Decision (…)", a builder's or reviewer's own, change nothing in a spec.
const DECISION_OPENINGS = [
  /^Decision \((?:architect|owner)(?:,[^)]*)?\)(?:,[^:]*)?:/,
  /^Owner(?:['’]s)? (?:design )?(?:decision|answer)s?\b/,
  /^Owner answered\b/,
  /^Owner, \d{1,2} [A-Z][a-z]{2}\b/,
];

// Only the first line that says something counts, read without its heading marker, bold or italics. Who wrote the
// comment is the caller's check (trustedComment).
export function isDecisionComment(body) {
  const first = body
    .trimStart()
    .split("\n")[0]
    .replace(/^#{1,6} /, "")
    .replaceAll(/[*_]/g, "");
  return DECISION_OPENINGS.some((opening) => opening.test(first));
}

// An issue's number, title and body (a pull request's too: GitHub serves both as issues), and in `decisions` the text
// of its Decision comments, oldest first: only the owner's and collaborators', as the repository is public.
export function issue(gh, n) {
  const i = JSON.parse(gh(["api", `repos/{owner}/{repo}/issues/${n}`]));
  const decisions = comments(gh, n)
    .filter((c) => trustedComment(c) && isDecisionComment(c.body))
    .map((c) => c.body);
  return { number: i.number, title: i.title ?? "", body: i.body ?? "", decisions };
}

// Posts the text in `file` as a comment on issue or pull request n.
export function comment(gh, n, file) {
  gh(["api", "--method", "POST", `repos/{owner}/{repo}/issues/${n}/comments`, "-F", `body=@${file}`]);
}

// The writes below pass each value with -f, which keeps it as text: -F would read a value starting with @ as a file.
const write = (method, path, fields = []) => [
  "api",
  "--method",
  method,
  `repos/{owner}/{repo}/${path}`,
  ...fields.flatMap((f) => ["-f", f]),
];

// Opens an issue and returns its number.
export function createIssue(gh, title, body) {
  return JSON.parse(gh(write("POST", "issues", [`title=${title}`, `body=${body}`]))).number;
}

// The `gh api` arguments for a change to issue or pull request n, for a caller that plans commands before running
// them (tools/sprint/moves.mjs).
export const addLabelsArgs = (n, labels) =>
  write(
    "POST",
    `issues/${n}/labels`,
    labels.map((l) => `labels[]=${l}`),
  );
export const removeLabelArgs = (n, label) => write("DELETE", `issues/${n}/labels/${encodeURIComponent(label)}`);
export const commentArgs = (n, body) => write("POST", `issues/${n}/comments`, [`body=${body}`]);
export const titleArgs = (n, title) => write("PATCH", `issues/${n}`, [`title=${title}`]);
export const reviewRequestArgs = (n, login) =>
  write("POST", `pulls/${n}/requested_reviewers`, [`reviewers[]=${login}`]);
