// The sprint log's status block (`queue.mjs status`): counts per lane, the last merge, free memory, and what
// needs the owner. Split from rules.mjs, whose queue rules it reads.
import { byNumber, has, holdKind, laneOf, openWith, ownerAnswer, prJob, taskPr } from "./rules.mjs";

// A lane issue with one of these is on some lane's path; one with none of them waits for the owner (fix 14).
const STAGED = ["sprint-ready", "blocked", "in-progress", "spec-review"];

// The status block: counts per lane, the last merge, free memory and what needs the owner.
export function status(S, doc, { merged = [], lastMain = null, need = [], oldBody = "" } = {}) {
  const lines = [`Updated ${new Date(S.now).toISOString().slice(0, 16)}Z`, ""];
  for (const lane of doc.lanes) {
    const L = `lane:${lane}`;
    const count = (...labels) => openWith(S, L, ...labels).length;
    const held = S.prs.filter((p) => p.state === "OPEN" && has(p, L) && has(p, "held")).length;
    const landed = merged.filter((p) => has(p, L)).length;
    lines.push(
      `- ${lane}: ${openWith(S, L, "sprint-ready").filter((i) => !has(i, "blocked")).length} ready, ${count("in-progress")} building, ${held} held, ${count("blocked")} blocked, ${landed} merged since the window opened`,
    );
  }
  if (lastMain)
    lines.push(
      "",
      `Last merge to main: #${lastMain.number} ${lastMain.title} (${lastMain.mergedAt}); CI: ${lastMain.ci ?? "unknown"}`,
    );
  lines.push(`Free memory: ${S.freeMb} MB`);
  // Questions reach the owner through the daily Decisions digest (decisions.mjs), so they never ping from here.
  const questions = S.issues
    .filter((i) => i.state === "OPEN" && laneOf(i) && has(i, "blocked") && !ownerAnswer(i, S))
    .sort(byNumber)
    .map((i) => `#${i.number} ${i.title}: blocked on a question (in the daily Decisions digest)`);
  const needs = [
    ...questions,
    ...S.issues
      .filter((i) => i.state === "OPEN" && doc.lanes.includes(laneOf(i)) && !STAGED.some((l) => has(i, l)))
      .filter((i) => !taskPr(i.number, S))
      .sort(byNumber)
      .map(
        (i) =>
          `#${i.number} ${i.title}: in lane ${laneOf(i)} with neither sprint-ready nor blocked, so no lane builds it`,
      ),
    ...S.prs
      .filter((p) => p.state === "OPEN" && p.reviewRequired)
      .sort(byNumber)
      .map((p) => `#${p.number} ${p.title}: waits for your approval`),
    ...S.prs
      .filter((p) => p.state === "OPEN" && has(p, "held") && !prJob(p, S, 1))
      .sort(byNumber)
      .map((p) =>
        holdKind(p, S) === "rail"
          ? `#${p.number} ${p.title}: held by agy's rail audit, which says it loosens a rail; its last comment says how`
          : `#${p.number} ${p.title}: held; its last comment says why`,
      ),
    ...need,
  ];
  lines.push("", "## Needs you", ...(needs.length ? needs.map((n) => `- ${n}`) : ["- nothing"]));
  const before = new Set(
    String(oldBody)
      .split(/\r?\n/)
      .map((l) => l.trim()),
  );
  const quiet = new Set(questions);
  return {
    body: lines.join("\n"),
    needsYou: needs,
    newNeeds: needs.filter((n) => !before.has(`- ${n}`) && !quiet.has(n)),
  };
}
