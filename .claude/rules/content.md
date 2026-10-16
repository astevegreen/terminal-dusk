---
paths:
  - "packages/content/**"
  - "docs/design/cards/**"
---
# Content rules
- Cards, map, scenarios and the tutorial are JSON checked by the Zod schemas in `schema/`. Run `pnpm content:check`.
- Build cards only from an approved spec in `docs/design/cards/`. Never invent text, numbers or effects.
- Use existing step types. If none fits, stop: a new step type or builtin is an engine task.
- A builtin is named after its card (`builtin:<card-id>`) and is used by that card only.
- Rules text must describe exactly what the effect does. History notes: 1-3 neutral, factual sentences.
- Post-2026 events name roles ("the U.S. President"), never people.
- Platform variants change wording or art only, never rules.
- Every card has a test that plays it from a scenario fixture, one assertion per branch of its effect.
