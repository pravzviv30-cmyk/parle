# Retry Backoff Policy

> 17 nodes · cohesion 0.16

## Key Concepts

- **backoff.ts** (9 connections) — `apps/mobile/src/sync/backoff.ts`
- **Backoff** (9 connections) — `apps/mobile/src/sync/backoff.ts`
- **backoff.test.ts** (7 connections) — `apps/mobile/src/sync/backoff.test.ts`
- **createBackoff()** (4 connections) — `apps/mobile/src/sync/backoff.ts`
- **backoffCeiling()** (3 connections) — `apps/mobile/src/sync/backoff.ts`
- **backoffDelay()** (3 connections) — `apps/mobile/src/sync/backoff.ts`
- **BACKOFF_BASE_MS** (2 connections) — `apps/mobile/src/sync/backoff.ts`
- **BACKOFF_CAP_MS** (2 connections) — `apps/mobile/src/sync/backoff.ts`
- **.backoff()** (2 connections) — `apps/mobile/src/sync/engine.ts`
- **.attempts()** (1 connections) — `apps/mobile/src/sync/backoff.ts`
- **.failed()** (1 connections) — `apps/mobile/src/sync/backoff.ts`
- **.ready()** (1 connections) — `apps/mobile/src/sync/backoff.ts`
- **.readyAt()** (1 connections) — `apps/mobile/src/sync/backoff.ts`
- **.resumed()** (1 connections) — `apps/mobile/src/sync/backoff.ts`
- **.succeeded()** (1 connections) — `apps/mobile/src/sync/backoff.ts`
- **BackoffOptions** (1 connections) — `apps/mobile/src/sync/backoff.ts`
- **draws()** (1 connections) — `apps/mobile/src/sync/backoff.test.ts`

## Relationships

- [Sync Engine Core](Sync_Engine_Core.md) (4 shared connections)
- [Sync Policy and Live Checks](Sync_Policy_and_Live_Checks.md) (1 shared connections)

## Source Files

- `apps/mobile/src/sync/backoff.test.ts`
- `apps/mobile/src/sync/backoff.ts`
- `apps/mobile/src/sync/engine.ts`

## Audit Trail

- EXTRACTED: 27 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*