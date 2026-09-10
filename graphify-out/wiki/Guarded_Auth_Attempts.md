# Guarded Auth Attempts

> 11 nodes · cohesion 0.29

## Key Concepts

- **attempt.ts** (12 connections) — `apps/mobile/src/auth/attempt.ts`
- **attempt.test.ts** (12 connections) — `apps/mobile/src/auth/attempt.test.ts`
- **attempt()** (5 connections) — `apps/mobile/src/auth/attempt.ts`
- **guardAdapter()** (4 connections) — `apps/mobile/src/auth/attempt.ts`
- **toFailure()** (3 connections) — `apps/mobile/src/auth/attempt.ts`
- **GENERIC_FAILURE** (3 connections) — `apps/mobile/src/auth/friendly.ts`
- **GUARDED_METHODS** (2 connections) — `apps/mobile/src/auth/attempt.ts`
- **ProviderFailure** (2 connections) — `apps/mobile/src/auth/friendly.ts`
- **getAccessToken()** (1 connections) — `apps/mobile/src/auth/attempt.test.ts`
- **signInWithPassword()** (1 connections) — `apps/mobile/src/auth/attempt.test.ts`
- **signOut()** (1 connections) — `apps/mobile/src/auth/attempt.test.ts`

## Relationships

- [Apple Sign-In](Apple_Sign-In.md) (7 shared connections)
- [OAuth Sign-In Adapters](OAuth_Sign-In_Adapters.md) (3 shared connections)
- [Auth Adapter Interface](Auth_Adapter_Interface.md) (2 shared connections)
- [Auth Mode Selection](Auth_Mode_Selection.md) (2 shared connections)

## Source Files

- `apps/mobile/src/auth/attempt.test.ts`
- `apps/mobile/src/auth/attempt.ts`
- `apps/mobile/src/auth/friendly.ts`

## Audit Trail

- EXTRACTED: 30 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*