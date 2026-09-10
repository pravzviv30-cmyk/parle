# Session Metering Plans

> 30 nodes · cohesion 0.15

## Key Concepts

- **meter.ts** (23 connections) — `packages/core/src/metering/meter.ts`
- **metering/index.ts** (21 connections) — `packages/core/src/metering/index.ts`
- **PLANS** (14 connections) — `packages/core/src/metering/meter.ts`
- **meter.test.ts** (14 connections) — `packages/core/src/metering/meter.test.ts`
- **canStartSession()** (10 connections) — `packages/core/src/metering/meter.ts`
- **secondsRemaining()** (8 connections) — `packages/core/src/metering/meter.ts`
- **rollPeriod()** (7 connections) — `packages/core/src/metering/meter.ts`
- **DEFAULT_COST_MODEL** (6 connections) — `packages/core/src/metering/meter.ts`
- **estimateSessionCost()** (6 connections) — `packages/core/src/metering/meter.ts`
- **MIN_VIABLE_SESSION_SEC** (6 connections) — `packages/core/src/metering/meter.ts`
- **lapsedEntitlement()** (5 connections) — `packages/core/src/metering/meter.ts`
- **planMargin()** (5 connections) — `packages/core/src/metering/meter.ts`
- **Metered minutes enforced from v1** (5 connections) — `PRODUCT.md`
- **recordUsage()** (4 connections) — `packages/core/src/metering/meter.ts`
- **Cascaded STT to LLM to TTS voice pipeline** (4 connections) — `PRODUCT.md`
- **PlanSpec** (3 connections) — `packages/core/src/metering/meter.ts`
- **StartRefusal** (3 connections) — `packages/core/src/metering/meter.ts`
- **Metering enforced at token issuance** (3 connections) — `README.md`
- **Risk 2: cost per session** (3 connections) — `README.md`
- **LAPSE_GRACE_SEC** (2 connections) — `packages/core/src/metering/meter.ts`
- **Margin** (2 connections) — `packages/core/src/metering/meter.ts`
- **SessionCost** (2 connections) — `packages/core/src/metering/meter.ts`
- **SessionUsage** (2 connections) — `packages/core/src/metering/meter.ts`
- **StartDecision** (2 connections) — `packages/core/src/metering/meter.ts`
- **STORE_FEE_RATES** (2 connections) — `packages/core/src/metering/meter.ts`
- *... and 5 more nodes in this community*

## Relationships

- [Entitlement Store](Entitlement_Store.md) (9 shared connections)
- [Voice Lifecycle Checks](Voice_Lifecycle_Checks.md) (6 shared connections)
- [LiveKit Session Tokens](LiveKit_Session_Tokens.md) (6 shared connections)
- [RevenueCat Billing](RevenueCat_Billing.md) (4 shared connections)
- [Out Of Minutes Handling](Out_Of_Minutes_Handling.md) (3 shared connections)
- [LiveKit Session Globals](LiveKit_Session_Globals.md) (3 shared connections)
- [Account Deletion Agent Auth](Account_Deletion_Agent_Auth.md) (3 shared connections)
- [Delivery Roadmap Tests](Delivery_Roadmap_Tests.md) (2 shared connections)
- [Mission Tint Acoustic Model](Mission_Tint_Acoustic_Model.md) (1 shared connections)
- [Database Contract Tests](Database_Contract_Tests.md) (1 shared connections)

## Source Files

- `PRODUCT.md`
- `README.md`
- `packages/core/src/metering/index.ts`
- `packages/core/src/metering/meter.test.ts`
- `packages/core/src/metering/meter.ts`

## Audit Trail

- EXTRACTED: 95 (92%)
- INFERRED: 8 (8%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*