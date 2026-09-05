# Account Deletion & Agent Auth

> 47 nodes · cohesion 0.09

## Key Concepts

- **server.ts** (69 connections) — `services/token-server/src/server.ts`
- **server** (27 connections) — `services/token-server/src/server.ts`
- **token-server/src/conversationPacks.ts** (12 connections) — `services/token-server/src/conversationPacks.ts`
- **token-server/src/conversationPacks.test.ts** (9 connections) — `services/token-server/src/conversationPacks.test.ts`
- **productEvents.ts** (8 connections) — `services/token-server/src/productEvents.ts`
- **listConversationPacks()** (7 connections) — `services/token-server/src/conversationPacks.ts`
- **parseProductEvent()** (7 connections) — `services/token-server/src/productEvents.ts`
- **deleteAllConversationPacks()** (6 connections) — `services/token-server/src/conversationPacks.ts`
- **deleteConversationPack()** (6 connections) — `services/token-server/src/conversationPacks.ts`
- **saveConversationPack()** (6 connections) — `services/token-server/src/conversationPacks.ts`
- **validConversationPackFor()** (6 connections) — `services/token-server/src/conversationPacks.ts`
- **accountDeletion.ts** (5 connections) — `services/token-server/src/accountDeletion.ts`
- **deleteSupabaseUser()** (5 connections) — `services/token-server/src/accountDeletion.ts`
- **signedInRecently()** (5 connections) — `services/token-server/src/accountDeletion.ts`
- **headers()** (5 connections) — `services/token-server/src/conversationPacks.ts`
- **root()** (5 connections) — `services/token-server/src/conversationPacks.ts`
- **agentDebitAllowed()** (4 connections) — `services/token-server/src/agentAuth.ts`
- **agentAuth.test.ts** (4 connections) — `services/token-server/src/agentAuth.test.ts`
- **clientIp()** (4 connections) — `services/token-server/src/rateLimit.ts`
- **installationSignal()** (4 connections) — `services/token-server/src/rateLimit.ts`
- **withinLimits()** (4 connections) — `services/token-server/src/server.ts`
- **adminHeaders()** (3 connections) — `services/token-server/src/accountDeletion.ts`
- **accountDeletion.test.ts** (3 connections) — `services/token-server/src/accountDeletion.test.ts`
- **agentAuth.ts** (3 connections) — `services/token-server/src/agentAuth.ts`
- **insertProductEvent()** (3 connections) — `services/token-server/src/productEvents.ts`
- *... and 22 more nodes in this community*

## Relationships

- [Entitlement Store](Entitlement_Store.md) (8 shared connections)
- [Rate Limiting & Session Leases](Rate_Limiting_&_Session_Leases.md) (8 shared connections)
- [RevenueCat Billing](RevenueCat_Billing.md) (6 shared connections)
- [Session Token Grants](Session_Token_Grants.md) (5 shared connections)
- [HTTP Security & CORS](HTTP_Security_&_CORS.md) (4 shared connections)
- [Conversation Pack Data](Conversation_Pack_Data.md) (3 shared connections)
- [Path Node Row UI](Path_Node_Row_UI.md) (3 shared connections)
- [Session Metering & Cost](Session_Metering_&_Cost.md) (3 shared connections)
- [Speech Scoring & IPA](Speech_Scoring_&_IPA.md) (3 shared connections)
- [Account Data Export](Account_Data_Export.md) (3 shared connections)
- [Upstash Session Lease](Upstash_Session_Lease.md) (3 shared connections)
- [Drill Definitions](Drill_Definitions.md) (2 shared connections)

## Source Files

- `services/token-server/src/accountDeletion.test.ts`
- `services/token-server/src/accountDeletion.ts`
- `services/token-server/src/agentAuth.test.ts`
- `services/token-server/src/agentAuth.ts`
- `services/token-server/src/conversationPacks.test.ts`
- `services/token-server/src/conversationPacks.ts`
- `services/token-server/src/productEvents.test.ts`
- `services/token-server/src/productEvents.ts`
- `services/token-server/src/rateLimit.ts`
- `services/token-server/src/server.ts`

## Audit Trail

- EXTRACTED: 155 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*