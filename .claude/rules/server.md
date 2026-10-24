---
paths:
  - "packages/server/**"
---
# Server rules
- `submit` is the only code that writes match state. It calls MatchHost and saves in one transaction.
- Every update is guarded by `where seq = expectedSeq`.
- `match_secret` has no read policies at all. Never add one, and never select from it in client-facing code.
- Never log state, seeds, hands or tokens. Log match IDs and seq numbers only.
- Scheduled jobs must be safe to run twice (idempotent).
- Online play checks the entitlement for the caller's platform before creating a match or joining a ranked one.
  A player without one may join a private game they were invited to by a player who has one
  (docs/architecture.md, Decision 5).
- Every migration has a test that applies it to an empty database.
