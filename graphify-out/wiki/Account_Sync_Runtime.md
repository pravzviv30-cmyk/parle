# Account Sync Runtime

> 18 nodes · cohesion 0.24

## Key Concepts

- **startSync()** (26 connections) — `apps/mobile/src/sync/engine.ts`
- **reconcile()** (18 connections) — `apps/mobile/src/sync/engine.ts`
- **pull()** (7 connections) — `apps/mobile/src/sync/engine.ts`
- **send()** (5 connections) — `apps/mobile/src/sync/engine.ts`
- **parseJson()** (5 connections) — `apps/mobile/src/sync/envelope.ts`
- **dirtyNamespaces()** (5 connections) — `apps/mobile/src/sync/registry.ts`
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
- **.getItem()** (2 connections) — `apps/mobile/src/sync/engine.ts`

## Relationships

- [Sync Engine Types](Sync_Engine_Types.md) (15 shared connections)
- [Sync Envelope Sealing](Sync_Envelope_Sealing.md) (5 shared connections)
- [Sync Engine Tests](Sync_Engine_Tests.md) (3 shared connections)
- [Sync Engine Lifecycle](Sync_Engine_Lifecycle.md) (3 shared connections)
- [App Root Bootstrap](App_Root_Bootstrap.md) (2 shared connections)
- [Retry Backoff](Retry_Backoff.md) (1 shared connections)
- [Fresh Device Adoption](Fresh_Device_Adoption.md) (1 shared connections)

## Source Files

- `apps/mobile/src/sync/engine.ts`
- `apps/mobile/src/sync/envelope.ts`
- `apps/mobile/src/sync/registry.ts`

## Audit Trail

- EXTRACTED: 65 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*