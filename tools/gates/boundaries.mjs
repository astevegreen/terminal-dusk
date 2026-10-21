// `pnpm boundaries`: enforces hard rules 1 and 2 of CLAUDE.md and the package table in docs/architecture.md.
// 1. packages/engine imports nothing outside itself, and its code never uses Date, Math.random, timers,
//    the DOM or the network. Its test and config files may import test tools (boundary-rules.mjs).
// 2. Only engine and host code mention the GameState type.
// 3. Each package imports only the workspace packages the table allows, and never reaches into
//    another package's folder by a relative path.
// The rules themselves are data in boundary-rules.mjs. Silent when everything passes; otherwise prints
// one line per problem (file:line) and exits 1.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import ts from "typescript";
import {
  ENGINE_FORBIDDEN_GLOBALS,
  ENGINE_FORBIDDEN_PROPERTIES,
  ENGINE_TOOLING_IMPORTS,
  GAME_STATE_PACKAGES,
  MAY_IMPORT,
  isToolingFile,
} from "./boundary-rules.mjs";

const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", "build"]);
const posix = (p) => p.replaceAll("\\", "/");
const has = (obj, key) => Object.hasOwn(obj, key);

// Workspace packages: packages/<name> -> key <name>; every shells/<name> -> key "shells".
function workspaces(root) {
  return ["packages", "shells"].flatMap((group) => {
    const abs = path.join(root, group);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(path.join(abs, d.name, "package.json")))
      .map((d) => {
        const dir = path.join(abs, d.name);
        const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
        return { dir, rel: `${group}/${d.name}`, key: group === "shells" ? "shells" : d.name, name: pkg.name, pkg };
      });
  });
}

function codeFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const abs = path.join(dir, d.name);
    if (d.isDirectory()) return SKIP_DIRS.has(d.name) || d.name.startsWith(".") ? [] : codeFiles(abs);
    return CODE.test(d.name) ? [abs] : [];
  });
}

const scriptKind = (file) =>
  /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

// Every module a file refers to: static, re-export, require, dynamic import() and import("x") types.
// `values` names the value exports taken from it ("*" for the whole module); type-only names are left out.
function importsOf(sf) {
  const found = [];
  const add = (node, spec, typeOnly, values) => found.push({ line: lineOf(sf, node), spec, typeOnly, values });
  const allTypes = (elements) => elements.length > 0 && elements.every((e) => e.isTypeOnly);
  const valueNames = (elements) => elements.filter((e) => !e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text);
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const c = node.importClause;
      const named = c?.namedBindings && ts.isNamedImports(c.namedBindings) ? c.namedBindings.elements : null;
      const values = !c || c.isTypeOnly ? [] : [
        ...(c.name ? ["default"] : []),
        ...(c.namedBindings && !named ? ["*"] : valueNames(named ?? [])),
      ];
      add(node, node.moduleSpecifier.text, Boolean(c && (c.isTypeOnly || (!c.name && named && allTypes(named)))), values);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const named = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : null;
      let values = ["*"];
      if (node.isTypeOnly) values = [];
      else if (named) values = valueNames(named);
      add(node, node.moduleSpecifier.text, node.isTypeOnly || Boolean(named && allTypes(named)), values);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const e = node.moduleReference.expression;
      if (ts.isStringLiteral(e)) add(node, e.text, node.isTypeOnly, node.isTypeOnly ? [] : ["*"]);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      if (ts.isStringLiteral(node.argument.literal)) add(node, node.argument.literal.text, true, []);
    } else if (ts.isCallExpression(node)) {
      const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const required = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (dynamic || required) {
        const arg = node.arguments[0];
        add(node, arg && ts.isStringLiteralLike(arg) ? arg.text : null, false, ["*"]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

const packageOf = (spec) => spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");

// Whether a package.json's "exports" map lists `subpath` ("./schema"). Without a map only the package itself is open.
function exportsSubpath(pkg, subpath) {
  const map = pkg.exports;
  if (!map || typeof map !== "object" || Array.isArray(map)) return false;
  return Object.keys(map).some((key) => {
    if (!key.startsWith("./")) return false;
    const [before, after] = key.split("*");
    return after === undefined ? key === subpath : subpath.startsWith(before) && subpath.endsWith(after);
  });
}

function importProblem(ws, file, imp, byName) {
  const tooling = isToolingFile(posix(path.relative(ws.dir, file)));
  const engineCode = ws.key === "engine" && !tooling;
  if (imp.spec === null) return "this import's path is computed, so the boundary check can't see it. Use a string literal.";
  if (imp.spec.startsWith(".") || path.isAbsolute(imp.spec)) {
    const rel = path.relative(ws.dir, path.resolve(path.dirname(file), imp.spec));
    if (rel.startsWith("..") || path.isAbsolute(rel))
      return `"${imp.spec}" reaches outside ${ws.rel} by a relative path. Import the other package by name.`;
    return null;
  }
  if (imp.spec.startsWith("node:") || isBuiltin(imp.spec)) {
    return engineCode ? `"${imp.spec}": the engine imports nothing outside itself (hard rule 1).` : null;
  }
  const target = byName.get(packageOf(imp.spec));
  if (target) {
    if (target === ws) return null;
    if (!has(MAY_IMPORT, ws.key))
      return `${ws.rel} is not in the package table (docs/architecture.md, Guardrails), so it may import no workspace package.`;
    const allowed = MAY_IMPORT[ws.key][target.key];
    if (!allowed) return `${ws.rel} may not import ${target.rel} (docs/architecture.md, Guardrails, "May import").`;
    const subpath = imp.spec.slice(target.name.length);
    if (subpath && !exportsSubpath(target.pkg, `.${subpath}`))
      return `"${imp.spec}" reaches past the entry point of ${target.rel}. Import "${target.name}", or a subpath its package.json "exports" lists.`;
    if (allowed === "types" && !imp.typeOnly && !tooling)
      return `${ws.rel} may import only types from ${target.rel} outside its tests. Use \`import type\`.`;
    const refused = allowed.values && !tooling ? imp.values.filter((v) => !allowed.values.includes(v)) : [];
    if (refused.length) {
      const what = refused.map((v) => (v === "*" ? "the whole module" : `"${v}"`)).join(", ");
      return `${ws.rel} may import from ${target.rel} only types and ${allowed.values.join(", ")} outside its tests, not ${what} ` +
        `(docs/architecture.md, Guardrails, "May import"). Use \`import type\`, or list the helper in tools/gates/boundary-rules.mjs.`;
    }
    return null;
  }
  if (ws.key !== "engine") return null;
  if (!engineCode && ENGINE_TOOLING_IMPORTS.includes(packageOf(imp.spec))) return null;
  return `"${imp.spec}": the engine imports nothing outside itself (hard rule 1).`;
}

// Identifiers that only name something (a property, a label) rather than refer to a variable.
function isNameOnly(node) {
  const p = node.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === node) return true;
  if (ts.isQualifiedName(p) && p.right === node) return true;
  if ((ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) && p.propertyName && p.name === node) return true;
  if (ts.isBindingElement(p) && p.propertyName === node) return true;
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return true;
  const named = [
    ts.isPropertyAssignment, ts.isPropertyDeclaration, ts.isPropertySignature, ts.isMethodDeclaration,
    ts.isMethodSignature, ts.isGetAccessorDeclaration, ts.isSetAccessorDeclaration, ts.isEnumMember,
    ts.isJsxAttribute,
  ];
  return named.some((is) => is(p)) && p.name === node;
}

// Hard rule 1, globals: uses of a forbidden global that engine code does not itself declare.
function engineGlobalProblems(ws, files) {
  const configPath = path.join(ws.dir, "tsconfig.json");
  const parsed = existsSync(configPath)
    ? ts.getParsedCommandLineOfConfigFile(configPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} })
    : null;
  const program = ts.createProgram(files, { ...(parsed?.options ?? {}), allowJs: true, noEmit: true });
  const checker = program.getTypeChecker();
  // On Windows a file on another drive (TypeScript's own lib files, say) has no relative path: it comes back absolute.
  const inEngine = (sf) => {
    const rel = path.relative(ws.dir, sf.fileName);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  };
  const declaredByEngine = (sym) => Boolean(sym?.declarations?.some((d) => inEngine(d.getSourceFile())));
  // `Math`, also inside brackets, a cast or a `!`: `(Math)`, `Math as X`, `<X>Math`, `Math satisfies X`.
  const forbiddenObject = (node, object) => {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) ||
      ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node))) node = node.expression;
    return Boolean(node) && ts.isIdentifier(node) && node.text === object && !declaredByEngine(checker.getSymbolAtLocation(node));
  };
  // The property a destructuring takes: `random` in `{ random }`, `{ random: r }` and `{ ["random"]: r }`.
  const keyText = (key) => {
    if (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) return key.text;
    return ts.isComputedPropertyName(key) && ts.isStringLiteralLike(key.expression) ? key.expression.text : null;
  };
  const boundProperty = (element) => {
    if (ts.isBindingElement(element)) return keyText(element.propertyName ?? element.name);
    if (ts.isPropertyAssignment(element) || ts.isShorthandPropertyAssignment(element)) return keyText(element.name);
    return null;
  };
  // The properties a destructuring takes and the value it takes them from, or null when `node` is none.
  const destructuring = (node) => {
    if (ts.isObjectBindingPattern(node) && node.parent.initializer) return { elements: node.elements, value: node.parent.initializer };
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isObjectLiteralExpression(node.left))
      return { elements: node.left.properties, value: node.right };
    return null;
  };
  const problems = [];

  for (const file of files) {
    if (isToolingFile(posix(path.relative(ws.dir, file)))) continue;
    const sf = program.getSourceFile(file);
    if (!sf) continue;
    const report = (node, what, why) =>
      problems.push({ file, line: lineOf(sf, node), message: `${what}: ${why} (hard rule 1).` });
    const visit = (node) => {
      if (ts.isIdentifier(node) && has(ENGINE_FORBIDDEN_GLOBALS, node.text) && !isNameOnly(node)) {
        const sym = ts.isShorthandPropertyAssignment(node.parent)
          ? checker.getShorthandAssignmentValueSymbol(node.parent)
          : checker.getSymbolAtLocation(node);
        if (!declaredByEngine(sym)) report(node, node.text, ENGINE_FORBIDDEN_GLOBALS[node.text]);
      }
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const prop = ts.isPropertyAccessExpression(node)
          ? node.name.text
          : ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
        for (const [object, property, why] of ENGINE_FORBIDDEN_PROPERTIES) {
          if (prop === property && forbiddenObject(node.expression, object)) report(node, `${object}.${property}`, why);
        }
      }
      // `const { random } = Math` and `({ random } = Math)`: destructuring whose value is the forbidden object.
      const pattern = destructuring(node);
      if (pattern) {
        for (const [object, property, why] of ENGINE_FORBIDDEN_PROPERTIES) {
          if (!forbiddenObject(pattern.value, object)) continue;
          for (const element of pattern.elements)
            if (boundProperty(element) === property) report(element, `${object}.${property}`, why);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return problems;
}

export function checkBoundaries(root) {
  const all = workspaces(root);
  const byName = new Map(all.filter((w) => w.name).map((w) => [w.name, w]));
  const problems = [];

  for (const ws of all) {
    const files = codeFiles(ws.dir);
    if (ws.key === "engine") {
      for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
        if (Object.keys(ws.pkg[field] ?? {}).length)
          problems.push({ file: path.join(ws.dir, "package.json"), line: 1, message: `the engine may not have ${field}: it imports nothing outside itself (hard rule 1).` });
      }
      problems.push(...engineGlobalProblems(ws, files));
    }
    for (const file of files) {
      const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, scriptKind(file));
      for (const imp of importsOf(sf)) {
        const message = importProblem(ws, file, imp, byName);
        if (message) problems.push({ file, line: imp.line, message });
      }
      if (!GAME_STATE_PACKAGES.includes(ws.key)) {
        const lines = new Set();
        const visit = (node) => {
          if (ts.isIdentifier(node) && node.text === "GameState") lines.add(lineOf(sf, node));
          ts.forEachChild(node, visit);
        };
        visit(sf);
        for (const line of lines)
          problems.push({ file, line, message: "GameState is used outside engine and host (hard rule 2). UI code works from frames; AI code from views and reconstruct()." });
      }
    }
  }
  return problems
    .map((p) => ({ ...p, file: posix(path.relative(root, p.file)) }))
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

if (import.meta.main) {
  const problems = checkBoundaries(path.resolve(import.meta.dirname, "..", ".."));
  if (problems.length) {
    process.stdout.write(problems.map((p) => `${p.file}:${p.line} ${p.message}`).join("\n") + "\n");
    process.exit(1);
  }
}
