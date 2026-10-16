// `pnpm repo-map`: writes docs/repo-map.md, a one-line-per-file index of the repository.
// Each line comes from the file itself: a code file's first comment, a Markdown file's description or
// first heading, a package's description, plus the names a TypeScript file exports.
// `--check` only reports whether the map is out of date. `--staged` maps the files in the git index
// instead of the working tree; the pre-commit hook uses it.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAP = "docs/repo-map.md";
const MAX_DESCRIPTION = 160;
const MAX_EXPORTS = 12;

const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TYPESCRIPT = /\.(ts|tsx|mts|cts)$/;

const clip = (s) => (s.length > MAX_DESCRIPTION ? `${s.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : s);

// "First sentence. Second sentence." -> "First sentence." (a dot must be followed by a space or the end).
const firstSentence = (s) => /^(.*?[.!?])(?=\s|$)/.exec(s)?.[1] ?? s;

const MARKERS = { "//": /^\/\/+\s?/, "#": /^#+\s?/, "--": /^--+\s?/ };

// The first sentence of the first run of `marker` comment lines (`//`, `#` or `--`). The run must open
// the file (after blank lines, a shebang or `---`) unless `anywhere` is set. A blank comment line ends it.
function leadingComment(text, marker, { anywhere = false } = {}) {
  const lines = text.split(/\r?\n/);
  const isComment = (l) => MARKERS[marker].test(l.trim()) && !l.trim().startsWith("#!");
  let i = 0;
  while (i < lines.length && (["", "---"].includes(lines[i].trim()) || (i === 0 && lines[i].startsWith("#!")))) i++;
  if (anywhere) while (i < lines.length && !isComment(lines[i])) i++;
  const run = [];
  for (; i < lines.length && isComment(lines[i]); i++) {
    const t = lines[i].trim().replace(MARKERS[marker], "").trim();
    if (!t) break;
    run.push(t);
  }
  return firstSentence(run.join(" "));
}

// The first sentence of a `/* ... */` or `/** ... */` block that opens a code file.
function blockComment(text) {
  const m = /^\s*(?:#!.*\n\s*)?\/\*+([\s\S]*?)\*\//.exec(text);
  if (!m) return "";
  const lines = m[1].split(/\r?\n/).map((l) => l.replace(/^\s*\*?\s?/, "").trim());
  return firstSentence(lines.filter(Boolean).join(" "));
}

// A Markdown file's `description:` front matter, or else its first heading.
function markdownSummary(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const description = front && /^description:\s*(.+)$/m.exec(front[1]);
  if (description) return description[1].trim().replace(/^(["'])(.*)\1$/, "$2");
  const heading = /^#{1,6}\s+(.+)$/m.exec(front ? text.slice(front[0].length) : text);
  return heading ? heading[1].trim() : "";
}

export function describeFile(file, text) {
  const base = path.posix.basename(file);
  if (file.endsWith(".json")) {
    // A "description" field, or else the first // comment (tsconfig files allow comments).
    let d = null;
    try {
      d = JSON.parse(text).description;
    } catch {}
    return clip(typeof d === "string" ? d : leadingComment(text, "//", { anywhere: true }));
  }
  if (file.endsWith(".md")) return clip(markdownSummary(text));
  if (CODE.test(file)) return clip(leadingComment(text, "//") || blockComment(text));
  if (file.endsWith(".sql")) return clip(leadingComment(text, "--"));
  if (/\.(ya?ml|toml|sh)$/.test(file) || /^[^.]+$/.test(base) || base.startsWith("."))
    return clip(leadingComment(text, "#"));
  return "";
}

// Names a TypeScript file exports, in source order.
export function exportsOf(text) {
  const names = [];
  const declared =
    /^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
  const listed = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;
  const found = [];
  for (const m of text.matchAll(declared)) found.push([m.index, [m[1]]]);
  for (const m of text.matchAll(listed)) {
    const list = m[1]
      .split(",")
      .map((s) =>
        s
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)
          .pop(),
      )
      .filter(Boolean);
    found.push([m.index, list]);
  }
  for (const m of text.matchAll(/^export\s+default\s+(?!(?:async\s+)?(?:function|class)\s+[A-Za-z_$])/gm))
    found.push([m.index, ["default"]]);
  for (const m of text.matchAll(/^export\s+\*\s+(?:as\s+(\w+)\s+)?from\s+["']([^"']+)["']/gm))
    found.push([m.index, [m[1] ?? `* from ${m[2]}`]]);
  for (const [, list] of found.sort((a, b) => a[0] - b[0])) for (const n of list) if (!names.includes(n)) names.push(n);
  return names;
}

// Sections, in order: root files, packages, shells, tests, tools, docs, then the rest alphabetically.
function sectionOf(file) {
  const parts = file.split("/");
  if (parts.length === 1) return "Root files";
  if ((parts[0] === "packages" || parts[0] === "shells") && parts.length > 2) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}
const ORDER = ["Root files", "packages/", "shells/", "tests", "tools", "docs"];
const rank = (s) => {
  const i = ORDER.findIndex((o) => (o.endsWith("/") ? s.startsWith(o) : s === o));
  return i === -1 ? ORDER.length : i;
};

// `files` is a sorted list of { path, text } (text null when unreadable).
export function renderMap(files) {
  const sections = new Map();
  for (const f of files) {
    const s = sectionOf(f.path);
    if (!sections.has(s)) sections.set(s, []);
    sections.get(s).push(f);
  }
  const names = [...sections.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const out = [
    "# Repository map",
    "",
    "Generated by `pnpm repo-map` (tools/repo-map.mjs); the pre-commit hook keeps it current. Don't edit it by hand:",
    "each line comes from the file's first comment, its Markdown heading or description, or its package description.",
  ];
  for (const name of names) {
    const manifest = files.find((f) => f.path === `${name}/package.json`);
    const about = manifest?.text ? describeFile(manifest.path, manifest.text) : "";
    out.push("", `## ${name}${about ? ` - ${about}` : ""}`, "");
    for (const f of sections.get(name)) {
      // A package's description already heads its section.
      const description = f.text === null || f === manifest ? "" : describeFile(f.path, f.text);
      const exported =
        f.text !== null && TYPESCRIPT.test(f.path) && !/\.test\.tsx?$/.test(f.path) ? exportsOf(f.text) : [];
      const shown = exported.length > MAX_EXPORTS ? [...exported.slice(0, MAX_EXPORTS), "…"] : exported;
      const parts = [description, shown.length ? `Exports: ${shown.join(", ")}.` : ""].filter(Boolean);
      out.push(`- \`${f.path}\`${parts.length ? ` - ${parts.join(" ")}` : ""}`);
    }
  }
  return out.join("\n") + "\n";
}

function listFiles(root, staged) {
  const args = staged ? ["ls-files", "--cached"] : ["ls-files", "--cached", "--others", "--exclude-standard"];
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  return [...new Set(r.stdout.split(/\r?\n/).filter(Boolean))]
    .filter((f) => f !== MAP && !f.endsWith("/.gitkeep") && existsSync(path.join(root, f)))
    .sort();
}

export function buildMap(root, { staged = false } = {}) {
  const files = listFiles(root, staged).map((p) => {
    try {
      return { path: p, text: readFileSync(path.join(root, p), "utf8") };
    } catch {
      return { path: p, text: null };
    }
  });
  return renderMap(files);
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const map = buildMap(ROOT, { staged: process.argv.includes("--staged") });
  const target = path.join(ROOT, MAP);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (check) {
    if (current !== map) {
      process.stdout.write(`${MAP} is out of date. Run: pnpm repo-map\n`);
      process.exit(1);
    }
  } else if (current !== map) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, map);
  }
}
