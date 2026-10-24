// Reads what the sprint queue needs from docs/sprint.md: the window, the lanes, each lane's backlog IDs
// and the sprint log issue. docs/sprint.md stays the one place these live; nothing here copies them.

// `20261021T0000` (UTC) as a Date.
export function parseStamp(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})$/.exec(String(s ?? ""));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : null;
}

// One backlog line can name several IDs (`- **R1** #130, **R2** #131`).
const idsIn = (line) => [...line.matchAll(/\*\*([A-Z]+\d+)\*\*/g)].map((m) => m[1]);

export function readSprintDoc(text) {
  const window = /\*\*Window \(UTC\):\*\*\s*`(\d{8}T\d{4})`\s*to\s*`(\d{8}T\d{4})`/.exec(text);
  const lanes = [...text.matchAll(/^\|\s*`([a-z]+)`\s*\|\s*`(lane:[a-z]+)`\s*\|/gm)].map((m) => m[1]);

  const backlog = {};
  const start = text.search(/^## Backlog\b/m);
  const end = start < 0 ? -1 : text.slice(start + 1).search(/^## /m);
  const section = start < 0 ? "" : text.slice(start, end < 0 ? undefined : start + 1 + end);
  let lane = null;
  for (const line of section.split(/\r?\n/)) {
    const heading = /^### ([a-z]+)\b/.exec(line);
    if (heading) {
      lane = heading[1];
      backlog[lane] = [];
    } else if (lane && /^- /.test(line)) backlog[lane].push(...idsIn(line));
  }

  const log = /sprint log, issue `#(\d+)`/.exec(text);
  return {
    window: window ? { start: parseStamp(window[1]), end: parseStamp(window[2]) } : null,
    lanes,
    backlog,
    logIssue: log ? Number(log[1]) : null,
  };
}

// The task ID a title carries: `[task] R12b: ...` gives { id: "R12b", base: "R12", part: "b" }.
export function taskId(title) {
  const m = /^\[task\] ([A-Z]+\d+)([a-z]?):/.exec(String(title ?? ""));
  return m ? { id: m[1] + m[2], base: m[1], part: m[2] } : null;
}

export const inWindow = (doc, now) =>
  Boolean(doc.window?.start && doc.window?.end) && now >= doc.window.start && now < doc.window.end;
