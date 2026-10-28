// Whose words count in the sprint queue's comments: the agents' own, the owner's, and the owner's answers on the
// Decisions issue (owner's policy of 28 Oct 2026, P5). Split from rules.mjs, which reads them.

export const ms = (s) => new Date(s).getTime();
// The standing issue that batches design questions for the owner, at most one digest a day (P5, decisions.mjs).
export const DECISIONS = "Decisions for the owner";

const isAudit = (c) => c.body.startsWith("<!-- gemini-audit -->");
// A sprint or night-shift comment: anything the agents' account wrote except a Gemini audit or Sonar's own.
export const isSprint = (c, owner) => c.author !== owner && !isAudit(c) && !/sonar/i.test(c.author);
export const newest = (comments, keep) =>
  comments.filter(keep).reduce((a, c) => (!a || ms(c.createdAt) >= ms(a.createdAt) ? c : a), null);
// The newest comment the sprint or night shift wrote on an issue or pull request.
export const newestSprint = (item, owner) => newest(item.comments, (c) => isSprint(c, owner));

// The owner's own comment, newer than the last sprint comment. An answer the agents relayed doesn't count:
// only the owner's GitHub account speaks for the owner.
export function ownerReply(item, owner) {
  const o = newest(item.comments, (c) => c.author === owner);
  const s = newest(item.comments, (c) => isSprint(c, owner));
  return o && (!s || ms(o.createdAt) > ms(s.createdAt)) ? o : null;
}

// The Decisions digest starts every comment with this (decisions.mjs). gh may be signed in as the owner, so a
// digest can carry the owner's name: it is never an answer, whoever posted it.
export const DIGEST = "<!-- decisions-digest -->";
export const isDigest = (c) => c.body.startsWith(DIGEST);

// A line that answers #<n> starts with #<n>, maybe after spaces or a list marker ("- ", "* ", "1. "). A mention
// later in a line answers nothing: "#6 no. I need to think more about #5." answers #6 only.
const LEAD = String.raw`^[ \t]*(?:[-*+][ \t]+|\d+[.)][ \t]+)?#`;
const answers = (n) => new RegExp(String.raw`${LEAD}${n}(?!\d)`, "m");
const leadingNumber = (line) => new RegExp(String.raw`${LEAD}(\d+)`).exec(line)?.[1];
// An owner comment on the Decisions issue, newer than the question, with a line starting #<n>. One comment may
// answer several issues: each gets the lines from the one starting with its number to the next line that starts
// with another issue number.
export function decisionsAnswer(issue, ask, S) {
  const d = S.issues.find((i) => i.state === "OPEN" && i.title === DECISIONS);
  const n = issue.number;
  const c =
    d &&
    newest(
      d.comments,
      (x) => x.author === S.owner && !isDigest(x) && ms(x.createdAt) > ms(ask.createdAt) && answers(n).test(x.body),
    );
  if (!c) return null;
  const lines = c.body.split(/\r?\n/);
  const from = lines.findIndex((l) => answers(n).test(l));
  const next = lines.findIndex((l, k) => k > from && leadingNumber(l) && Number(leadingNumber(l)) !== n);
  return {
    ...c,
    body: lines
      .slice(from, next < 0 ? lines.length : next)
      .join("\n")
      .trim(),
  };
}
