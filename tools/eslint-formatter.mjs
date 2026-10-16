// ESLint output as one `file:line:col message (rule)` line per problem, with repository-relative paths,
// so the gate (which keeps lines that point at a place in the code) shows exactly what to fix.
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

export default function format(results) {
  const lines = [];
  for (const result of results) {
    const file = path.relative(ROOT, result.filePath).replace(/\\/g, "/");
    for (const m of result.messages) {
      const kind = m.severity === 2 ? "error" : "warning";
      lines.push(`${file}:${m.line ?? 0}:${m.column ?? 0} ${kind} ${m.message}${m.ruleId ? ` (${m.ruleId})` : ""}`);
    }
  }
  return lines.length ? `${lines.join("\n")}\n` : "";
}
