// ESLint for the whole repository: each package's `lint` script and the edit-time quick check use it.
// Hard rules 1-2 are enforced by `pnpm boundaries`; the engine section repeats rule 1 so a forbidden
// global or import is reported the moment the file is saved.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";
import { ENGINE_FORBIDDEN_GLOBALS, ENGINE_FORBIDDEN_PROPERTIES, TOOLING_GLOBS } from "./tools/gates/boundary-rules.mjs";

export default defineConfig(
  globalIgnores(["**/node_modules/", "**/dist/", "**/coverage/"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  // SonarCloud's rules, run locally. Findings that already existed on 28 Nov 2026 are recorded in the root
  // eslint-suppressions.json (ESLint bulk suppressions; paths are relative to the repo root, so each package's
  // `lint` script runs from the root, like the edit-time check). Lint fails on any new finding and on a
  // suppression that no longer matches, so the file can only shrink. Prune it with
  // `pnpm exec eslint . --prune-suppressions`; never run --suppress-all again to silence new findings.
  sonarjs.configs.recommended,
  {
    rules: {
      // Off, three rules that misfire here (the other sonarjs rules stay on):
      // - no-empty-test-file: the generated card tests and the store contract suites register their
      //   cases through helpers the rule cannot see, so it reports every one of them.
      // - assertions-in-tests: engine tests assert by throwing (playEasy, replay checks) rather than
      //   through expect().
      // - no-redundant-optional: `x?: T | undefined` is meaningful under exactOptionalPropertyTypes
      //   (tsconfig.base.json), so the "redundant" fix would change the type.
      "sonarjs/no-empty-test-file": "off",
      "sonarjs/assertions-in-tests": "off",
      "sonarjs/no-redundant-optional": "off",
    },
  },
  {
    rules: {
      // `catch {}` is this repo's idiom for "ignore this failure".
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["packages/app/**", "shells/**"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["packages/engine/**"],
    ignores: TOOLING_GLOBS,
    rules: {
      "no-restricted-globals": [
        "error",
        ...Object.entries(ENGINE_FORBIDDEN_GLOBALS).map(([name, why]) => ({
          name,
          message: `Hard rule 1: ${why}.`,
        })),
      ],
      "no-restricted-properties": [
        "error",
        ...ENGINE_FORBIDDEN_PROPERTIES.map(([object, property, why]) => ({
          object,
          property,
          message: `Hard rule 1: ${why}.`,
        })),
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: String.raw`^(?!\.\.?/)`,
              message: "The engine imports nothing outside itself (hard rule 1). Use a relative import.",
            },
          ],
        },
      ],
    },
  },
);
