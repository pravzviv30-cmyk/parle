# Server Auth And Account Deletion

> 37 nodes · cohesion 0.10

## Key Concepts

- **server.ts** (56 connections) — `services/token-server/src/server.ts`
- **server** (19 connections) — `services/token-server/src/server.ts`
- **productEvents.ts** (8 connections) — `services/token-server/src/productEvents.ts`
- **privateSignal()** (8 connections) — `services/token-server/src/rateLimit.ts`
- **parseProductEvent()** (7 connections) — `services/token-server/src/productEvents.ts`
- **accountDeletion.ts** (5 connections) — `services/token-server/src/accountDeletion.ts`
- **deleteSupabaseUser()** (5 connections) — `services/token-server/src/accountDeletion.ts`
- **signedInRecently()** (5 connections) — `services/token-server/src/accountDeletion.ts`
- **agentDebitAllowed()** (4 connections) — `services/token-server/src/agentAuth.ts`
- **agentAuth.test.ts** (4 connections) — `services/token-server/src/agentAuth.test.ts`
- **clientIp()** (4 connections) — `services/token-server/src/rateLimit.ts`
- **installationSignal()** (4 connections) — `services/token-server/src/rateLimit.ts`
- **withinLimits()** (4 connections) — `services/token-server/src/server.ts`
- **adminHeaders()** (3 connections) — `services/token-server/src/accountDeletion.ts`
- **accountDeletion.test.ts** (3 connections) — `services/token-server/src/accountDeletion.test.ts`
- **agentAuth.ts** (3 connections) — `services/token-server/src/agentAuth.ts`
- **insertProductEvent()** (3 connections) — `services/token-server/src/productEvents.ts`
- **installationChecks()** (3 connections) — `services/token-server/src/server.ts`
- **ipCheck()** (3 connections) — `services/token-server/src/server.ts`
- **json()** (3 connections) — `services/token-server/src/server.ts`
- **exactKeys()** (2 connections) — `services/token-server/src/productEvents.ts`
- **missionId()** (2 connections) — `services/token-server/src/productEvents.ts`
- **nonNegativeCount()** (2 connections) — `services/token-server/src/productEvents.ts`
- **productEvents.test.ts** (2 connections) — `services/token-server/src/productEvents.test.ts`
- **readAudio()** (2 connections) — `services/token-server/src/server.ts`
- *... and 12 more nodes in this community*

## Relationships

- [Entitlement Store](Entitlement_Store.md) (9 shared connections)
- [Rate Limiting And Leases](Rate_Limiting_And_Leases.md) (9 shared connections)
- [Upstash Lease And Rate Limits](Upstash_Lease_And_Rate_Limits.md) (4 shared connections)
- [LiveKit Session Tokens](LiveKit_Session_Tokens.md) (4 shared connections)
- [HTTP Security and CORS](HTTP_Security_and_CORS.md) (4 shared connections)
- [Session Cost Metering](Session_Cost_Metering.md) (3 shared connections)
- [Speechace Phoneme Scoring](Speechace_Phoneme_Scoring.md) (3 shared connections)
- [Pronunciation Drill Bank](Pronunciation_Drill_Bank.md) (2 shared connections)
- [Server User Resolution](Server_User_Resolution.md) (2 shared connections)
- [Server Environment Config](Server_Environment_Config.md) (2 shared connections)
- [Path Node Status Line](Path_Node_Status_Line.md) (1 shared connections)

## Source Files

- `services/token-server/src/accountDeletion.test.ts`
- `services/token-server/src/accountDeletion.ts`
- `services/token-server/src/agentAuth.test.ts`
- `services/token-server/src/agentAuth.ts`
- `services/token-server/src/productEvents.test.ts`
- `services/token-server/src/productEvents.ts`
- `services/token-server/src/rateLimit.ts`
- `services/token-server/src/server.ts`

## Audit Trail

- EXTRACTED: 110 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*