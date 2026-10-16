---
paths:
  - "packages/engine/**"
---
# Engine rules
- Exports: createGame, apply, pendingFor, viewFor, hiddenPart, reconstruct, legalAnswers and pure helpers. Nothing else is public.
- No I/O, no clock, no Math.random. All randomness comes from the PRNG in `src/rng.ts`, whose algorithm never changes.
- Integers only. Ordering is always explicit: arrays or sorted keys, never object key order.
- New effect behaviour = a resolution-stack step. Anything waiting for a player = a pending Decision.
- Simultaneous choices use a decision group; the first answer stays in `secret` until all are in.
- Every event carries its visibility (public, side A, side B). Never emit hidden card IDs in public events.
- Respect the step budget; a trigger that can retrigger must have a finite bound.
- Tests: a property test for each new invariant, plus a golden replay when behaviour changes on purpose.
- Keep `apply` fast; the AI simulates thousands of games. The engine benchmark must not regress.
