# Session Metering & Plans

> 82 nodes · cohesion 0.05

## Key Concepts

- **server.ts** (28 connections) — `services/token-server/src/server.ts`
- **metering/index.ts** (20 connections) — `packages/core/src/metering/index.ts`
- **meter.ts** (20 connections) — `packages/core/src/metering/meter.ts`
- **Entitlement** (17 connections) — `packages/core/src/metering/meter.ts`
- **tokens.ts** (14 connections) — `services/token-server/src/tokens.ts`
- **meter.test.ts** (12 connections) — `packages/core/src/metering/meter.test.ts`
- **FileEntitlementStore** (12 connections) — `services/token-server/src/store.ts`
- **src/store.ts** (11 connections) — `services/token-server/src/store.ts`
- **tokens.test.ts** (11 connections) — `services/token-server/src/tokens.test.ts`
- **server** (10 connections) — `services/token-server/src/server.ts`
- **InMemoryEntitlementStore** (9 connections) — `services/token-server/src/store.ts`
- **grantSession()** (9 connections) — `services/token-server/src/tokens.ts`
- **canStartSession()** (8 connections) — `packages/core/src/metering/meter.ts`
- **secondsRemaining()** (8 connections) — `packages/core/src/metering/meter.ts`
- **Plan** (7 connections) — `packages/core/src/metering/meter.ts`
- **PLANS** (7 connections) — `packages/core/src/metering/meter.ts`
- **auth.ts** (7 connections) — `services/token-server/src/auth.ts`
- **EntitlementStore** (7 connections) — `services/token-server/src/store.ts`
- **rollPeriod()** (6 connections) — `packages/core/src/metering/meter.ts`
- **.get()** (6 connections) — `services/token-server/src/store.ts`
- **DEFAULT_COST_MODEL** (5 connections) — `packages/core/src/metering/meter.ts`
- **estimateSessionCost()** (5 connections) — `packages/core/src/metering/meter.ts`
- **planMargin()** (5 connections) — `packages/core/src/metering/meter.ts`
- **Metered minutes enforced from v1** (5 connections) — `PRODUCT.md`
- **.save()** (5 connections) — `services/token-server/src/store.ts`
- *... and 57 more nodes in this community*

## Relationships

- [Navigation & Live Context](Navigation_&_Live_Context.md) (5 shared connections)
- [Drill Bank & Phonemes](Drill_Bank_&_Phonemes.md) (2 shared connections)
- [Difficulty Ladder](Difficulty_Ladder.md) (2 shared connections)
- [Speechace Phoneme Mapping](Speechace_Phoneme_Mapping.md) (1 shared connections)

## Source Files

- `PRODUCT.md`
- `README.md`
- `packages/core/src/metering/index.ts`
- `packages/core/src/metering/meter.test.ts`
- `packages/core/src/metering/meter.ts`
- `services/token-server/src/agentAuth.test.ts`
- `services/token-server/src/agentAuth.ts`
- `services/token-server/src/auth.test.ts`
- `services/token-server/src/auth.ts`
- `services/token-server/src/server.ts`
- `services/token-server/src/store.ts`
- `services/token-server/src/tokens.test.ts`
- `services/token-server/src/tokens.ts`

## Audit Trail

- EXTRACTED: 183 (96%)
- INFERRED: 8 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*