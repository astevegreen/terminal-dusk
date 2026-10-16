// ESLint for the whole repository: each package's `lint` script and the edit-time quick check use it.
// Hard rules 1-2 are enforced by `pnpm boundaries`; the engine section repeats rule 1 so a forbidden
// global or import is reported the moment the file is saved.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import { ENGINE_FORBIDDEN_GLOBALS, ENGINE_FORBIDDEN_PROPERTIES, TOOLING_GLOBS } from "./tools/gates/boundary-rules.mjs";

export default defineConfig(
  globalIgnores(["**/node_modules/", "**/dist/", "**/coverage/"]),
  js.configs.recommended,
  tseslint.configs.recommended,
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
              regex: "^(?!\\.\\.?/)",
              message: "The engine imports nothing outside itself (hard rule 1). Use a relative import.",
            },
          ],
        },
      ],
    },
  },
);
