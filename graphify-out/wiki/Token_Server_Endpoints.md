# Token Server Endpoints

> 16 nodes · cohesion 0.19

## Key Concepts

- **server.ts** (28 connections) — `services/token-server/src/server.ts`
- **server** (10 connections) — `services/token-server/src/server.ts`
- **scoreUtterance()** (9 connections) — `services/shared/speechace.ts`
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
- [Pronunciation Scoring](Pronunciation_Scoring.md) (4 shared connections)
- [LiveKit Session Tokens](LiveKit_Session_Tokens.md) (4 shared connections)
- [Session Cost Metering](Session_Cost_Metering.md) (3 shared connections)
- [French Lesson Content](French_Lesson_Content.md) (2 shared connections)
- [Server User Resolution](Server_User_Resolution.md) (2 shared connections)
- [Live Tutor Agent](Live_Tutor_Agent.md) (1 shared connections)
- [Tutor Prompt Building](Tutor_Prompt_Building.md) (1 shared connections)
- [Lesson Turn Grading](Lesson_Turn_Grading.md) (1 shared connections)
- [Project Overview Doc](Project_Overview_Doc.md) (1 shared connections)
- [Practice Path Row](Practice_Path_Row.md) (1 shared connections)

## Source Files

- `services/shared/speechace.ts`
- `services/token-server/src/agentAuth.test.ts`
- `services/token-server/src/agentAuth.ts`
- `services/token-server/src/server.ts`

## Audit Trail

- EXTRACTED: 48 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*