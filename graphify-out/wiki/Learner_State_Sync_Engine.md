# Learner State Sync Engine

> 15 nodes · cohesion 0.30

## Key Concepts

- **startSync()** (26 connections) — `apps/mobile/src/sync/engine.ts`
- **reconcile()** (18 connections) — `apps/mobile/src/sync/engine.ts`
- **pull()** (7 connections) — `apps/mobile/src/sync/engine.ts`
- **send()** (5 connections) — `apps/mobile/src/sync/engine.ts`
- **flushDirty()** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **queue()** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **readLocal()** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **run()** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **clearIfRunning()** (3 connections) — `apps/mobile/src/sync/engine.ts`
- **headers()** (3 connections) — `apps/mobile/src/sync/engine.ts`
- **readRow()** (3 connections) — `apps/mobile/src/sync/engine.ts`
- **scope()** (3 connections) — `apps/mobile/src/sync/engine.ts`
- **event()** (2 connections) — `apps/mobile/src/sync/engine.ts`
- **outcome()** (2 connections) — `apps/mobile/src/sync/engine.ts`
- **reconcileAll()** (2 connections) — `apps/mobile/src/sync/engine.ts`

## Relationships

- [Sync Engine Types](Sync_Engine_Types.md) (11 shared connections)
- [Spaced Repetition Engine Tests](Spaced_Repetition_Engine_Tests.md) (8 shared connections)
- [Sync Engine Reconciliation](Sync_Engine_Reconciliation.md) (2 shared connections)
- [Sync Diagnostics And Alarms](Sync_Diagnostics_And_Alarms.md) (1 shared connections)
- [Retry Backoff Policy](Retry_Backoff_Policy.md) (1 shared connections)
- [Mobile App Shell And Auth Flow](Mobile_App_Shell_And_Auth_Flow.md) (1 shared connections)
- [Fresh Device Startup](Fresh_Device_Startup.md) (1 shared connections)
- [Acknowledged Persistence Stores](Acknowledged_Persistence_Stores.md) (1 shared connections)

## Source Files

- `apps/mobile/src/sync/engine.ts`

## Audit Trail

- EXTRACTED: 57 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*