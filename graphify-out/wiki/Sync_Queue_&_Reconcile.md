# Sync Queue & Reconcile

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

- [Sync Engine Core](Sync_Engine_Core.md) (10 shared connections)
- [Bookmarks Store & Envelope](Bookmarks_Store_&_Envelope.md) (7 shared connections)
- [Review Engine Tests](Review_Engine_Tests.md) (2 shared connections)
- [Sync Engine Live Checks](Sync_Engine_Live_Checks.md) (2 shared connections)
- [Account Sync & Audio Sweep](Account_Sync_&_Audio_Sweep.md) (1 shared connections)
- [Retry Backoff Logic](Retry_Backoff_Logic.md) (1 shared connections)
- [App Bootstrap & Gate](App_Bootstrap_&_Gate.md) (1 shared connections)
- [Fresh Device Startup](Fresh_Device_Startup.md) (1 shared connections)
- [Persistence Acknowledgement](Persistence_Acknowledgement.md) (1 shared connections)

## Source Files

- `apps/mobile/src/sync/engine.ts`

## Audit Trail

- EXTRACTED: 57 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*