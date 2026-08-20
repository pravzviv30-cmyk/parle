# Session Cost Metering

> 27 nodes · cohesion 0.16

## Key Concepts

- **metering/index.ts** (20 connections) — `packages/core/src/metering/index.ts`
- **meter.ts** (20 connections) — `packages/core/src/metering/meter.ts`
- **meter.test.ts** (12 connections) — `packages/core/src/metering/meter.test.ts`
- **canStartSession()** (8 connections) — `packages/core/src/metering/meter.ts`
- **secondsRemaining()** (8 connections) — `packages/core/src/metering/meter.ts`
- **PLANS** (7 connections) — `packages/core/src/metering/meter.ts`
- **DEFAULT_COST_MODEL** (5 connections) — `packages/core/src/metering/meter.ts`
- **estimateSessionCost()** (5 connections) — `packages/core/src/metering/meter.ts`
- **planMargin()** (5 connections) — `packages/core/src/metering/meter.ts`
- **Metered minutes enforced from v1** (5 connections) — `PRODUCT.md`
- **MIN_VIABLE_SESSION_SEC** (4 connections) — `packages/core/src/metering/meter.ts`
- **recordUsage()** (4 connections) — `packages/core/src/metering/meter.ts`
- **Cascaded STT to LLM to TTS voice pipeline** (4 connections) — `PRODUCT.md`
- **Metering enforced at token issuance** (3 connections) — `README.md`
- **Risk 2: cost per session** (3 connections) — `README.md`
- **CostModel** (2 connections) — `packages/core/src/metering/meter.ts`
- **Margin** (2 connections) — `packages/core/src/metering/meter.ts`
- **PlanSpec** (2 connections) — `packages/core/src/metering/meter.ts`
- **SessionCost** (2 connections) — `packages/core/src/metering/meter.ts`
- **SessionUsage** (2 connections) — `packages/core/src/metering/meter.ts`
- **StartDecision** (2 connections) — `packages/core/src/metering/meter.ts`
- **StartRefusal** (2 connections) — `packages/core/src/metering/meter.ts`
- **Learner-accented French breaks ordinary STT** (2 connections) — `PRODUCT.md`
- **fresh()** (1 connections) — `packages/core/src/metering/meter.test.ts`
- **Risk 1: STT on real learner French** (1 connections) — `README.md`
- *... and 2 more nodes in this community*

## Relationships

- [Entitlement Store](Entitlement_Store.md) (9 shared connections)
- [LiveKit Token Minting](LiveKit_Token_Minting.md) (6 shared connections)
- [Token Server Endpoints](Token_Server_Endpoints.md) (3 shared connections)
- [Prompt and Turn Queue](Prompt_and_Turn_Queue.md) (1 shared connections)

## Source Files

- `PRODUCT.md`
- `README.md`
- `packages/core/src/metering/index.ts`
- `packages/core/src/metering/meter.test.ts`
- `packages/core/src/metering/meter.ts`

## Audit Trail

- EXTRACTED: 68 (89%)
- INFERRED: 8 (11%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*