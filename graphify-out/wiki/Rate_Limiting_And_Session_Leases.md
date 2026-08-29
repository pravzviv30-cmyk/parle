# Rate Limiting And Session Leases

> 34 nodes · cohesion 0.08

## Key Concepts

- **rateLimit.ts** (23 connections) — `services/token-server/src/rateLimit.ts`
- **rateLimit.test.ts** (15 connections) — `services/token-server/src/rateLimit.test.ts`
- **privateSignal()** (9 connections) — `services/token-server/src/rateLimit.ts`
- **MemorySessionLeaseStore** (7 connections) — `services/token-server/src/rateLimit.ts`
- **sessionAbandon.test.ts** (6 connections) — `services/token-server/src/sessionAbandon.test.ts`
- **MemoryRateLimiter** (5 connections) — `services/token-server/src/rateLimit.ts`
- **RATE_LIMITS** (5 connections) — `services/token-server/src/rateLimit.ts`
- **UpstashRateLimiter** (5 connections) — `services/token-server/src/rateLimit.ts`
- **RateLimiter** (4 connections) — `services/token-server/src/rateLimit.ts`
- **RateLimitRule** (3 connections) — `services/token-server/src/rateLimit.ts`
- **createRateLimiter()** (2 connections) — `services/token-server/src/rateLimit.ts`
- **createSessionLeaseStore()** (2 connections) — `services/token-server/src/rateLimit.ts`
- **CONSUME_SCRIPT** (1 connections) — `services/token-server/src/rateLimit.ts`
- **Counter** (1 connections) — `services/token-server/src/rateLimit.ts`
- **FetchLike** (1 connections) — `services/token-server/src/rateLimit.ts`
- **.constructor()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **.consume()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **.acquire()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **.constructor()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **.release()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **RateLimitDecision** (1 connections) — `services/token-server/src/rateLimit.ts`
- **.consume()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **RELEASE_LEASE_SCRIPT** (1 connections) — `services/token-server/src/rateLimit.ts`
- **callArguments()** (1 connections) — `services/token-server/src/rateLimit.test.ts`
- **isHashedAtSource()** (1 connections) — `services/token-server/src/rateLimit.test.ts`
- *... and 9 more nodes in this community*

## Relationships

- [Account Deletion And Product Events](Account_Deletion_And_Product_Events.md) (11 shared connections)
- [Upstash Live Checks](Upstash_Live_Checks.md) (7 shared connections)
- [Session Lease Store](Session_Lease_Store.md) (4 shared connections)

## Source Files

- `services/token-server/src/rateLimit.test.ts`
- `services/token-server/src/rateLimit.ts`
- `services/token-server/src/sessionAbandon.test.ts`

## Audit Trail

- EXTRACTED: 65 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*