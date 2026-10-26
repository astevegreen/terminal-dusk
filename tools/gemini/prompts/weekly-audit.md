Audit the whole repository as it is on disk now. Follow GEMINI.md.
Start from docs/repo-map.md if it exists, then docs/architecture.md and CLAUDE.md.

Look for:

- drift from the architecture decisions: code that has quietly stopped following one of them
- duplicated logic: the same rule or calculation written in two places
- dead code: exports nothing imports, unreachable branches, unused files
- test gaps: rules, cards or server paths with no test that exercises them
- files over 350 lines

Answer with the findings in the GEMINI.md format. You may use up to 15 findings for this audit.
