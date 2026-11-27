// `pnpm content:check [files...]`: validates content JSON against the schemas in packages/content/schema/.
// Content files are the JSON files in packages/content/<folder>/ (cards/, scenarios/ and so on), checked by
// schemas[<folder>], and the few listed in EXTRA_CONTENT. Given file paths, it checks only those and ignores any that
// are not content files (the edit-time quick check passes every packages/content JSON file); given none, it checks all.
// Silent when everything passes; otherwise prints one line per problem (file:line) and exits 1.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const CONTENT = "packages/content";
const NOT_CONTENT = new Set(["schema", "src", "node_modules", "dist", "coverage", "test", "tests"]);
const posix = (p) => p.replaceAll("\\", "/");
// Content that lives outside packages/content, by exact path, with the name of the schema that checks it.
const EXTRA_CONTENT = new Map([["packages/app/public/sounds/manifest.json", "soundManifest"]]);

// "packages/content/cards/early/c1.json" -> "cards"; null for anything that is not a content file.
export function contentFolderOf(relPath) {
  const extra = EXTRA_CONTENT.get(posix(relPath));
  if (extra) return extra;
  const parts = posix(relPath).split("/");
  if (parts.length < 4 || `${parts[0]}/${parts[1]}` !== CONTENT || !parts.at(-1).endsWith(".json")) return null;
  return NOT_CONTENT.has(parts[2]) ? null : parts[2];
}

export function listContentFiles(root) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
  const base = path.join(root, CONTENT);
  const walked = existsSync(base) ? walk(base).map((f) => posix(path.relative(root, f))) : [];
  const extra = [...EXTRA_CONTENT.keys()].filter((f) => existsSync(path.join(root, f)));
  return [...walked.filter((f) => contentFolderOf(f) && !f.includes("/node_modules/")), ...extra].sort();
}

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

// Best-effort line of a JSON path such as ["effect", 0, "amount"]: each key's first match after the one before.
function lineOfPath(text, keys) {
  let pos = 0;
  for (const key of keys) {
    if (typeof key !== "string") continue;
    const at = text.indexOf(JSON.stringify(key), pos);
    if (at !== -1) pos = at;
  }
  return lineAt(text, pos);
}

// `files` are repository-relative paths; `schemas` maps a content folder to its schema.
export function checkContent(root, files, schemas) {
  const problems = [];
  for (const file of files.map(posix)) {
    const folder = contentFolderOf(file);
    if (!folder) continue;
    const abs = path.join(root, file);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, "utf8");
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      const pos = /position (\d+)/.exec(err.message);
      problems.push(`${file}:${pos ? lineAt(text, Number(pos[1])) : 1} is not valid JSON: ${err.message}`);
      continue;
    }
    const schema = Object.prototype.hasOwnProperty.call(schemas, folder) ? schemas[folder] : null;
    if (!schema) {
      problems.push(`${file}:1 has no schema: add schemas.${folder} to ${CONTENT}/schema/index.ts before adding ${folder} content.`);
      continue;
    }
    const result = schema.safeParse(data);
    if (result.success) continue;
    for (const issue of result.error.issues) {
      const where = issue.path.length ? issue.path.map(String).join(".") : "(whole file)";
      problems.push(`${file}:${lineOfPath(text, issue.path)} ${where}: ${issue.message}`);
    }
  }
  return problems;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const files = args.length ? args.map((a) => posix(path.relative(ROOT, path.resolve(a)))) : listContentFiles(ROOT);
  const { schemas } = await import(pathToFileURL(path.join(ROOT, CONTENT, "schema", "index.ts")).href);
  const problems = checkContent(ROOT, files, schemas);
  if (problems.length) {
    process.stdout.write(problems.join("\n") + "\n");
    process.exit(1);
  }
}
