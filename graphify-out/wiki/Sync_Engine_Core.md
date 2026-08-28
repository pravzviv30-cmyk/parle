# Sync Engine Core

> 57 nodes · cohesion 0.07

## Key Concepts

- **engine.ts** (48 connections) — `apps/mobile/src/sync/engine.ts`
- **registry.ts** (40 connections) — `apps/mobile/src/sync/registry.ts`
- **registry.test.ts** (27 connections) — `apps/mobile/src/sync/registry.test.ts`
- **startSync()** (26 connections) — `apps/mobile/src/sync/engine.ts`
- **reconcile()** (18 connections) — `apps/mobile/src/sync/engine.ts`
- **pull()** (7 connections) — `apps/mobile/src/sync/engine.ts`
- **attachDirtyStore()** (7 connections) — `apps/mobile/src/sync/registry.ts`
- **clearDirty()** (6 connections) — `apps/mobile/src/sync/registry.ts`
- **send()** (5 connections) — `apps/mobile/src/sync/engine.ts`
- **SyncPolicy** (5 connections) — `apps/mobile/src/sync/engine.ts`
- **parseJson()** (5 connections) — `apps/mobile/src/sync/envelope.ts`
- **adopterFor()** (5 connections) — `apps/mobile/src/sync/registry.ts`
- **dirtyNamespaces()** (5 connections) — `apps/mobile/src/sync/registry.ts`
- **DirtyStorage** (5 connections) — `apps/mobile/src/sync/registry.ts`
- **persist()** (5 connections) — `apps/mobile/src/sync/registry.ts`
- **flushDirty()** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **queue()** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **readLocal()** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **run()** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **SyncFetch** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **SyncHttpResponse** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **SyncStorage** (4 connections) — `apps/mobile/src/sync/engine.ts`
- **onDirty()** (4 connections) — `apps/mobile/src/sync/registry.ts`
- **SYNC_STATE_SUFFIX** (4 connections) — `apps/mobile/src/sync/registry.ts`
- **clearIfRunning()** (3 connections) — `apps/mobile/src/sync/engine.ts`
- *... and 32 more nodes in this community*

## Relationships

- [Review Engine Tests](Review_Engine_Tests.md) (26 shared connections)
- [Drill Store](Drill_Store.md) (9 shared connections)
- [Sync Policy and Live Checks](Sync_Policy_and_Live_Checks.md) (9 shared connections)
- [Topics Store](Topics_Store.md) (7 shared connections)
- [Activity Log Store](Activity_Log_Store.md) (5 shared connections)
- [Fresh Device Adoption](Fresh_Device_Adoption.md) (5 shared connections)
- [Retry Backoff Policy](Retry_Backoff_Policy.md) (4 shared connections)
- [App Root Wiring](App_Root_Wiring.md) (4 shared connections)
- [Namespace Merge Policy](Namespace_Merge_Policy.md) (4 shared connections)
- [Sync Diagnostics](Sync_Diagnostics.md) (3 shared connections)
- [Store Binding Tests](Store_Binding_Tests.md) (3 shared connections)
- [Sync Retention Policy](Sync_Retention_Policy.md) (2 shared connections)

## Source Files

- `apps/mobile/src/sync/engine.ts`
- `apps/mobile/src/sync/envelope.ts`
- `apps/mobile/src/sync/registry.test.ts`
- `apps/mobile/src/sync/registry.ts`

## Audit Trail

- EXTRACTED: 196 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*