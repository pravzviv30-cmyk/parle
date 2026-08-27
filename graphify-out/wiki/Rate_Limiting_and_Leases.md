# Rate Limiting And Leases

> 31 nodes · cohesion 0.08

## Key Concepts

- **rateLimit.ts** (22 connections) — `services/token-server/src/rateLimit.ts`
- **rateLimit.test.ts** (15 connections) — `services/token-server/src/rateLimit.test.ts`
- **MemorySessionLeaseStore** (6 connections) — `services/token-server/src/rateLimit.ts`
- **MemoryRateLimiter** (5 connections) — `services/token-server/src/rateLimit.ts`
- **SessionLeaseStore** (5 connections) — `services/token-server/src/rateLimit.ts`
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
- **.acquire()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **.release()** (1 connections) — `services/token-server/src/rateLimit.ts`
- **callArguments()** (1 connections) — `services/token-server/src/rateLimit.test.ts`
- **isHashedAtSource()** (1 connections) — `services/token-server/src/rateLimit.test.ts`
- *... and 6 more nodes in this community*

## Relationships

- [Server Auth And Account Deletion](Server_Auth_And_Account_Deletion.md) (9 shared connections)
- [Upstash Lease And Rate Limits](Upstash_Lease_And_Rate_Limits.md) (7 shared connections)

## Source Files

- `services/token-server/src/rateLimit.test.ts`
- `services/token-server/src/rateLimit.ts`

## Audit Trail

- EXTRACTED: 53 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*