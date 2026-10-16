---
name: card
description: Add or change a card in packages/content - data, test and history note. Use for any card work.
paths:
  - "packages/content/**"
---
1. Find the card's approved spec in docs/design/cards/<era>.md. Never invent card text or numbers.
2. Express the effect with existing step types (see packages/content/schema/steps.ts). If that's impossible,
   stop: a new step type or builtin is a separate engine task.
3. Write packages/content/cards/<era>/<id>.json: id, era, ops, affiliation, flags, effect, and text
   (name, rules, history, art reference).
4. The rules text must say exactly what the effect does. The history note is 1-3 neutral, factual sentences.
5. Write packages/content/cards/<era>/<id>.test.ts: play the card from a scenario fixture and assert the
   outcome, one test per branch of the effect.
6. Run `pnpm content:check`, then `pnpm gate`.
