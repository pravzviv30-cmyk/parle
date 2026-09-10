# Rate Limiting

> 38 nodes · cohesion 0.07

## Key Concepts

- **rateLimit.ts** (23 connections) — `services/token-server/src/rateLimit.ts`
- **rateLimit.test.ts** (15 connections) — `services/token-server/src/rateLimit.test.ts`
- **MemorySessionLeaseStore** (7 connections) — `services/token-server/src/rateLimit.ts`
- **sessionAbandon.test.ts** (6 connections) — `services/token-server/src/sessionAbandon.test.ts`
- **MemoryRateLimiter** (5 connections) — `services/token-server/src/rateLimit.ts`
- **RATE_LIMITS** (5 connections) — `services/token-server/src/rateLimit.ts`
- **SessionLeaseStore** (5 connections) — `services/token-server/src/rateLimit.ts`
- **UpstashRateLimiter** (5 connections) — `services/token-server/src/rateLimit.ts`
- **clientIp()** (4 connections) — `services/token-server/src/rateLimit.ts`
- **RateLimiter** (4 connections) — `services/token-server/src/rateLimit.ts`
- **RateLimitRule** (3 connections) — `services/token-server/src/rateLimit.ts`
- **ipCheck()** (3 connections) — `services/token-server/src/server.ts`
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
- *... and 13 more nodes in this community*

## Relationships

- [Upstash Session Lease](Upstash_Session_Lease.md) (10 shared connections)
- [Account Deletion and Export](Account_Deletion_and_Export.md) (9 shared connections)

## Source Files

- `services/token-server/src/rateLimit.test.ts`
- `services/token-server/src/rateLimit.ts`
- `services/token-server/src/server.ts`
- `services/token-server/src/sessionAbandon.test.ts`

## Audit Trail

- EXTRACTED: 66 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*