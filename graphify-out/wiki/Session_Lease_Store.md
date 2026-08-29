# Session Lease Store

> 8 nodes · cohesion 0.32

## Key Concepts

- **UpstashSessionLeaseStore** (8 connections) — `services/token-server/src/rateLimit.ts`
- **SessionLeaseStore** (5 connections) — `services/token-server/src/rateLimit.ts`
- **.acquire()** (3 connections) — `services/token-server/src/rateLimit.ts`
- **.#command()** (3 connections) — `services/token-server/src/rateLimit.ts`
- **.release()** (3 connections) — `services/token-server/src/rateLimit.ts`
- **.acquire()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **.release()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **.constructor()** (1 connections) — `services/token-server/src/rateLimit.ts`

## Relationships

- [Rate Limiting And Session Leases](Rate_Limiting_And_Session_Leases.md) (4 shared connections)
- [Upstash Live Checks](Upstash_Live_Checks.md) (3 shared connections)

## Source Files

- `services/token-server/src/rateLimit.ts`

## Audit Trail

- EXTRACTED: 14 (88%)
- INFERRED: 2 (12%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*