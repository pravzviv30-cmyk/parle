# Supabase Isolation Probe

> 19 nodes · cohesion 0.14

## Key Concepts

- **runSupabaseVerification()** (25 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **PostgrestTable** (6 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **blockedReport()** (3 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **.update()** (3 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **signal()** (3 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **summarise()** (3 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **SupabaseClientLike** (3 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **expect()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **main()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **newEmail()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **newPassword()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **PostgrestFilter** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **.eq()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **.delete()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **.insert()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **.select()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **.upsert()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **.from()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`
- **.rpc()** (2 connections) — `services/token-server/src/verify/supabaseLive.ts`

## Relationships

- [Supabase Live Checks](Supabase_Live_Checks.md) (20 shared connections)
- [Audio Recorder Double](Audio_Recorder_Double.md) (1 shared connections)
- [Entitlement Store](Entitlement_Store.md) (1 shared connections)

## Source Files

- `services/token-server/src/verify/supabaseLive.ts`

## Audit Trail

- EXTRACTED: 46 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*