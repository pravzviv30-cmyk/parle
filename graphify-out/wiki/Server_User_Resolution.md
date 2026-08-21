# Server User Resolution

> 9 nodes · cohesion 0.25

## Key Concepts

- **auth.ts** (7 connections) — `services/token-server/src/auth.ts`
- **createUserResolver()** (3 connections) — `services/token-server/src/auth.ts`
- **auth.test.ts** (3 connections) — `services/token-server/src/auth.test.ts`
- **UserResolver** (2 connections) — `services/token-server/src/auth.ts`
- **ResolvedUser** (1 connections) — `services/token-server/src/auth.ts`
- **SIGN_IN_REQUIRED** (1 connections) — `services/token-server/src/auth.ts`
- **hs256Token()** (1 connections) — `services/token-server/src/auth.test.ts`
- **.resolve()** (1 connections) — `services/token-server/src/auth.ts`
- **VerifierConfig** (1 connections) — `services/token-server/src/auth.ts`

## Relationships

- [Token Server Endpoints](Token_Server_Endpoints.md) (2 shared connections)

## Source Files

- `services/token-server/src/auth.test.ts`
- `services/token-server/src/auth.ts`

## Audit Trail

- EXTRACTED: 11 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*