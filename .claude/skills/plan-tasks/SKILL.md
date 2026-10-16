---
name: plan-tasks
description: Turn a promoted design decision into night-shift-ready GitHub issues. Run as /plan-tasks.
disable-model-invocation: true
argument-hint: "[design file or topic]"
model: opus
---
1. Read the design file(s) for $ARGUMENTS, the related decisions in docs/architecture.md, and docs/repo-map.md.
2. Propose the task list in chat first: title, size (S or M), model label, depends-on. Wait for the owner
   to confirm or edit it before creating anything.
3. Size each task for one fresh session: about 300 changed lines at most, one package where possible.
   Split anything bigger. Every task must be provable by its own acceptance criteria.
4. Create each issue with the task form fields: Goal, Read first (exact paths and doc sections),
   Acceptance criteria (testable statements), Out of scope, Size, Model, Depends on. Label it `spec-review`.
5. Run `node tools/gemini-audit.mjs specs <issue numbers>`. If it fails, say so and continue.
6. Report the issues with links, and every assumption you made.
