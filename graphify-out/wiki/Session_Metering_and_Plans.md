# Session Metering and Plans

> 29 nodes · cohesion 0.15

## Key Concepts

- **metering/index.ts** (20 connections) — `packages/core/src/metering/index.ts`
- **meter.ts** (20 connections) — `packages/core/src/metering/meter.ts`
- **meter.test.ts** (12 connections) — `packages/core/src/metering/meter.test.ts`
- **PLANS** (9 connections) — `packages/core/src/metering/meter.ts`
- **canStartSession()** (8 connections) — `packages/core/src/metering/meter.ts`
- **secondsRemaining()** (8 connections) — `packages/core/src/metering/meter.ts`
- **DEFAULT_COST_MODEL** (6 connections) — `packages/core/src/metering/meter.ts`
- **MIN_VIABLE_SESSION_SEC** (6 connections) — `packages/core/src/metering/meter.ts`
- **rollPeriod()** (6 connections) — `packages/core/src/metering/meter.ts`
- **estimateSessionCost()** (5 connections) — `packages/core/src/metering/meter.ts`
- **planMargin()** (5 connections) — `packages/core/src/metering/meter.ts`
- **Metered minutes enforced from v1** (5 connections) — `PRODUCT.md`
- **CostModel** (4 connections) — `packages/core/src/metering/meter.ts`
- **recordUsage()** (4 connections) — `packages/core/src/metering/meter.ts`
- **Cascaded STT to LLM to TTS voice pipeline** (4 connections) — `PRODUCT.md`
- **Metering enforced at token issuance** (3 connections) — `README.md`
- **Risk 2: cost per session** (3 connections) — `README.md`
- **Margin** (2 connections) — `packages/core/src/metering/meter.ts`
- **PlanSpec** (2 connections) — `packages/core/src/metering/meter.ts`
- **SessionCost** (2 connections) — `packages/core/src/metering/meter.ts`
- **SessionUsage** (2 connections) — `packages/core/src/metering/meter.ts`
- **StartDecision** (2 connections) — `packages/core/src/metering/meter.ts`
- **StartRefusal** (2 connections) — `packages/core/src/metering/meter.ts`
- **Learner-accented French breaks ordinary STT** (2 connections) — `PRODUCT.md`
- **SpendInput** (2 connections) — `services/tutor-agent/src/verify/voiceLifecycle.ts`
- *... and 4 more nodes in this community*

## Relationships

- [Entitlement Store](Entitlement_Store.md) (9 shared connections)
- [Session Token Grants](Session_Token_Grants.md) (6 shared connections)
- [Voice Lifecycle Checks](Voice_Lifecycle_Checks.md) (6 shared connections)
- [Account Deletion and Events](Account_Deletion_and_Events.md) (3 shared connections)
- [Path Node Status Line](Path_Node_Status_Line.md) (1 shared connections)
- [Database Contract Tests](Database_Contract_Tests.md) (1 shared connections)

## Source Files

- `PRODUCT.md`
- `README.md`
- `packages/core/src/metering/index.ts`
- `packages/core/src/metering/meter.test.ts`
- `packages/core/src/metering/meter.ts`
- `services/tutor-agent/src/verify/voiceLifecycle.ts`

## Audit Trail

- EXTRACTED: 79 (91%)
- INFERRED: 8 (9%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*