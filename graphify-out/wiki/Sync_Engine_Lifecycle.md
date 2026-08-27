# Sync Engine Lifecycle

> 47 nodes · cohesion 0.07

## Key Concepts

- **syncLive.ts** (43 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **runSyncVerification()** (23 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **syncLive.test.ts** (15 connections) — `apps/mobile/src/sync/verify/syncLive.test.ts`
- **SyncEngine** (10 connections) — `apps/mobile/src/sync/engine.ts`
- **sameData()** (9 connections) — `apps/mobile/src/sync/envelope.ts`
- **resetSyncRegistry()** (8 connections) — `apps/mobile/src/sync/registry.ts`
- **createSyncPolicy()** (5 connections) — `apps/mobile/src/sync/policy.ts`
- **dirtySettled()** (5 connections) — `apps/mobile/src/sync/registry.ts`
- **makeRedactor()** (4 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **missingEnvironment()** (4 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **anonKeyOf()** (3 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **blockedReport()** (3 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **main()** (3 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **readEnvFile()** (3 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **writeLocal()** (3 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **schemaMissingReport()** (3 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **summarise()** (3 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **.flushDirty()** (2 connections) — `apps/mobile/src/sync/engine.ts`
- **.reconcile()** (2 connections) — `apps/mobile/src/sync/engine.ts`
- **CheckResult** (2 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **deviceStorage()** (2 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **expect()** (2 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **Recorder** (2 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **.check()** (2 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- **REQUIRED_ENV** (2 connections) — `apps/mobile/src/sync/verify/syncLive.ts`
- *... and 22 more nodes in this community*

## Relationships

- [Sync Engine Types](Sync_Engine_Types.md) (10 shared connections)
- [App Root Bootstrap](App_Root_Bootstrap.md) (3 shared connections)
- [Account Sync Runtime](Account_Sync_Runtime.md) (3 shared connections)
- [Activity Sync Policy](Activity_Sync_Policy.md) (3 shared connections)
- [Store Binding Tests](Store_Binding_Tests.md) (3 shared connections)
- [Sync Envelope Sealing](Sync_Envelope_Sealing.md) (3 shared connections)
- [Sync Policy Constants](Sync_Policy_Constants.md) (2 shared connections)
- [Sync Engine Tests](Sync_Engine_Tests.md) (2 shared connections)
- [Topics Store](Topics_Store.md) (2 shared connections)
- [Onboarding Profile Store](Onboarding_Profile_Store.md) (2 shared connections)
- [Retry Backoff](Retry_Backoff.md) (1 shared connections)
- [Fresh Device Adoption](Fresh_Device_Adoption.md) (1 shared connections)

## Source Files

- `apps/mobile/src/sync/engine.ts`
- `apps/mobile/src/sync/envelope.ts`
- `apps/mobile/src/sync/policy.ts`
- `apps/mobile/src/sync/registry.ts`
- `apps/mobile/src/sync/verify/syncLive.test.ts`
- `apps/mobile/src/sync/verify/syncLive.ts`

## Audit Trail

- EXTRACTED: 110 (98%)
- INFERRED: 2 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*