# Account Deletion And Product Events

> 36 nodes · cohesion 0.10

## Key Concepts

- **server.ts** (56 connections) — `services/token-server/src/server.ts`
- **server** (19 connections) — `services/token-server/src/server.ts`
- **productEvents.ts** (8 connections) — `services/token-server/src/productEvents.ts`
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
- **readJson()** (2 connections) — `services/token-server/src/server.ts`
- *... and 11 more nodes in this community*

## Relationships

- [Rate Limiting And Session Leases](Rate_Limiting_And_Session_Leases.md) (11 shared connections)
- [Entitlement Plan Store](Entitlement_Plan_Store.md) (8 shared connections)
- [Session Token Grants](Session_Token_Grants.md) (5 shared connections)
- [HTTP Origin & Security Headers](HTTP_Origin_&_Security_Headers.md) (4 shared connections)
- [Session Metering And Plans](Session_Metering_And_Plans.md) (3 shared connections)
- [Pronunciation Scoring & IPA](Pronunciation_Scoring_&_IPA.md) (3 shared connections)
- [Pronunciation Drill Bank](Pronunciation_Drill_Bank.md) (2 shared connections)
- [Server User Resolution](Server_User_Resolution.md) (2 shared connections)
- [Server Config Validation](Server_Config_Validation.md) (2 shared connections)
- [Status Line & Tutor Name](Status_Line_&_Tutor_Name.md) (1 shared connections)

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

- EXTRACTED: 105 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*