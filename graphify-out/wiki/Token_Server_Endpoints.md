# Token Server Endpoints

> 15 nodes · cohesion 0.20

## Key Concepts

- **server.ts** (28 connections) — `services/token-server/src/server.ts`
- **server** (10 connections) — `services/token-server/src/server.ts`
- **agentDebitAllowed()** (4 connections) — `services/token-server/src/agentAuth.ts`
- **agentAuth.test.ts** (4 connections) — `services/token-server/src/agentAuth.test.ts`
- **agentAuth.ts** (3 connections) — `services/token-server/src/agentAuth.ts`
- **json()** (2 connections) — `services/token-server/src/server.ts`
- **readAudio()** (2 connections) — `services/token-server/src/server.ts`
- **readJson()** (2 connections) — `services/token-server/src/server.ts`
- **underScoreBudget()** (2 connections) — `services/token-server/src/server.ts`
- **config** (1 connections) — `services/token-server/src/server.ts`
- **livekitUrl** (1 connections) — `services/token-server/src/server.ts`
- **PORT** (1 connections) — `services/token-server/src/server.ts`
- **requiredEnv()** (1 connections) — `services/token-server/src/server.ts`
- **scoreCounts** (1 connections) — `services/token-server/src/server.ts`
- **users** (1 connections) — `services/token-server/src/server.ts`

## Relationships

- [Entitlement Store](Entitlement_Store.md) (6 shared connections)
- [LiveKit Token Minting](LiveKit_Token_Minting.md) (4 shared connections)
- [Session Cost Metering](Session_Cost_Metering.md) (3 shared connections)
- [Phoneme Scoring Bridge](Phoneme_Scoring_Bridge.md) (3 shared connections)
- [Drill Bank and Design Tokens](Drill_Bank_and_Design_Tokens.md) (2 shared connections)
- [Server User Resolver](Server_User_Resolver.md) (2 shared connections)
- [Prompt and Turn Queue](Prompt_and_Turn_Queue.md) (1 shared connections)

## Source Files

- `services/token-server/src/agentAuth.test.ts`
- `services/token-server/src/agentAuth.ts`
- `services/token-server/src/server.ts`

## Audit Trail

- EXTRACTED: 42 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*