// gh, agy, the audit comment and the signed-in login stood in for, so auditPr's tests (gemini-audit*.test.mjs) run
// without GitHub or a model.
export const SHA = "abc123";
export const ME = "astevegreen";
// A diff of `lines` changed lines (40 by default: past the size under which agy is skipped, agy.mjs SMALL).
export const diffOf = (file, lines = 40) =>
  `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n${"-a\n+b\n".repeat(lines / 2)}`;

// GitHub's REST answers for pull request 7 and its comments, as `gh api` prints them (the comments one per line).
export const REPO = { full_name: "astevegreen/terminal-dusk" };
const restPr = ({ fork, body = "" }) => ({
  number: 7,
  body,
  head: { sha: SHA, repo: fork ? { full_name: "stranger/terminal-dusk" } : REPO },
  base: { repo: REPO },
});
export const restComments = (comments) =>
  comments
    .map((c) => JSON.stringify({ user: c.author, author_association: c.authorAssociation ?? "OWNER", body: c.body }))
    .join("\n");

// compare: { "<from>": { status, merges, diff } }, the REST compare of that commit with the head, as gh answers it:
// its shape for the --jq read, its diff for the other. undefined when args are not such a read.
function compareAnswer(compare, args) {
  const cmp = /^repos\/\{owner\}\/\{repo\}\/compare\/(\w+)\.\.\.(\w+)$/.exec(args[1] ?? "");
  const c = args[0] === "api" && cmp?.[2] === SHA ? compare[cmp[1]] : undefined;
  if (!c) return undefined;
  return args[2] === "--jq" ? JSON.stringify({ status: c.status ?? "ahead", merges: c.merges ?? 0 }) : c.diff;
}

// answers: the reply to each prompt, or an Error when agy can't answer it. issues: the REST answer for each issue,
// its comments in `said`.
export function fake({
  comments = [],
  diff = diffOf("packages/app/src/x.ts"),
  answers = {},
  fork = false,
  body,
  issues = {},
  author = "astevegreen",
  ledger = [],
  compare = {},
} = {}) {
  const calls = { ask: [], post: [], me: 0, gh: [], ledger };
  const io = {
    // The quota ledger, in memory: what this PC recorded.
    ledger: { read: () => ledger, append: (line) => ledger.push(line) },
    gh: (...args) => {
      calls.gh.push(args);
      // Every read is REST: `gh pr view` and `gh issue view` need GraphQL, which cloud sessions can't reach.
      if (args[0] === "pr" && args[1] === "view") throw new Error("HTTP 403: GitHub GraphQL is not available");
      if (args[0] === "api" && args[1] === "repos/{owner}/{repo}/pulls/7")
        return JSON.stringify({ ...restPr({ fork, body }), user: { login: author } });
      const compared = compareAnswer(compare, args);
      if (compared !== undefined) return compared;
      if (args[0] === "api" && args[2] === "repos/{owner}/{repo}/issues/7/comments?per_page=100")
        return restComments(comments);
      const issue = /^repos\/\{owner\}\/\{repo\}\/issues\/(\d+)$/.exec(args[1] ?? "")?.[1];
      if (args[0] === "api" && issues[issue]) return JSON.stringify(issues[issue]);
      const of = /^repos\/\{owner\}\/\{repo\}\/issues\/(\d+)\/comments\?per_page=100$/.exec(args[2] ?? "")?.[1];
      if (args[0] === "api" && issues[of]) return restComments(issues[of].said ?? []);
      if (args[0] === "pr" && args[1] === "diff") return diff;
      throw new Error(`unexpected gh ${args.join(" ")}`);
    },
    ask: (prompt, material, what, opts = {}) => {
      calls.ask.push({ prompt, opts, material });
      const a = answers[prompt] ?? "No findings.";
      if (a instanceof Error) throw a;
      return { model: "m", response: a, passed: [], depth: "deep", why: "x" };
    },
    post: (kind, n, body) => calls.post.push({ kind, n, body }),
    me: () => {
      calls.me++;
      return ME;
    },
  };
  return { io, calls };
}
