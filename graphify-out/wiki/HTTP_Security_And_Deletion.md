# HTTP Security And Deletion

> 38 nodes · cohesion 0.10

## Key Concepts

- **server.ts** (56 connections) — `services/token-server/src/server.ts`
- **server** (19 connections) — `services/token-server/src/server.ts`
- **httpSecurity.ts** (9 connections) — `services/token-server/src/httpSecurity.ts`
- **privateSignal()** (9 connections) — `services/token-server/src/rateLimit.ts`
- **accountDeletion.ts** (5 connections) — `services/token-server/src/accountDeletion.ts`
- **deleteSupabaseUser()** (5 connections) — `services/token-server/src/accountDeletion.ts`
- **signedInRecently()** (5 connections) — `services/token-server/src/accountDeletion.ts`
- **applyHttpSecurity()** (5 connections) — `services/token-server/src/httpSecurity.ts`
- **agentDebitAllowed()** (4 connections) — `services/token-server/src/agentAuth.ts`
- **agentAuth.test.ts** (4 connections) — `services/token-server/src/agentAuth.test.ts`
- **createOriginPolicy()** (4 connections) — `services/token-server/src/httpSecurity.ts`
- **httpSecurity.test.ts** (4 connections) — `services/token-server/src/httpSecurity.test.ts`
- **clientIp()** (4 connections) — `services/token-server/src/rateLimit.ts`
- **installationSignal()** (4 connections) — `services/token-server/src/rateLimit.ts`
- **withinLimits()** (4 connections) — `services/token-server/src/server.ts`
- **adminHeaders()** (3 connections) — `services/token-server/src/accountDeletion.ts`
- **accountDeletion.test.ts** (3 connections) — `services/token-server/src/accountDeletion.test.ts`
- **agentAuth.ts** (3 connections) — `services/token-server/src/agentAuth.ts`
- **originAllowed()** (3 connections) — `services/token-server/src/httpSecurity.ts`
- **parseAllowedOrigins()** (3 connections) — `services/token-server/src/httpSecurity.ts`
- **installationChecks()** (3 connections) — `services/token-server/src/server.ts`
- **ipCheck()** (3 connections) — `services/token-server/src/server.ts`
- **json()** (3 connections) — `services/token-server/src/server.ts`
- **requestOrigin()** (2 connections) — `services/token-server/src/httpSecurity.ts`
- **readAudio()** (2 connections) — `services/token-server/src/server.ts`
- *... and 13 more nodes in this community*

## Relationships

- [Rate Limiting And Leases](Rate_Limiting_And_Leases.md) (10 shared connections)
- [Entitlement Store](Entitlement_Store.md) (8 shared connections)
- [LiveKit Session Token Grants](LiveKit_Session_Token_Grants.md) (5 shared connections)
- [Product Event Analytics](Product_Event_Analytics.md) (5 shared connections)
- [Upstash Live Checks](Upstash_Live_Checks.md) (4 shared connections)
- [Session Metering And Plans](Session_Metering_And_Plans.md) (3 shared connections)
- [Speechace Pronunciation Scoring](Speechace_Pronunciation_Scoring.md) (3 shared connections)
- [Pronunciation Drill Bank](Pronunciation_Drill_Bank.md) (2 shared connections)
- [Server User Resolver Auth](Server_User_Resolver_Auth.md) (2 shared connections)
- [Server Config Validation](Server_Config_Validation.md) (2 shared connections)
- [Drill Merge And Scene Controls](Drill_Merge_And_Scene_Controls.md) (1 shared connections)

## Source Files

- `services/token-server/src/accountDeletion.test.ts`
- `services/token-server/src/accountDeletion.ts`
- `services/token-server/src/agentAuth.test.ts`
- `services/token-server/src/agentAuth.ts`
- `services/token-server/src/httpSecurity.test.ts`
- `services/token-server/src/httpSecurity.ts`
- `services/token-server/src/rateLimit.ts`
- `services/token-server/src/server.ts`

## Audit Trail

- EXTRACTED: 114 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*