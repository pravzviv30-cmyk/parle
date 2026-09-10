# LiveKit Session Tokens

> 16 nodes · cohesion 0.21

## Key Concepts

- **tokens.ts** (20 connections) — `services/token-server/src/tokens.ts`
- **tokens.test.ts** (16 connections) — `services/token-server/src/tokens.test.ts`
- **grantSession()** (12 connections) — `services/token-server/src/tokens.ts`
- **ROOM_LIFECYCLE** (3 connections) — `services/token-server/src/tokens.ts`
- **roomNameFor()** (3 connections) — `services/token-server/src/tokens.ts`
- **TokenConfig** (3 connections) — `services/token-server/src/tokens.ts`
- **metadataFor()** (2 connections) — `services/token-server/src/tokens.test.ts`
- **validMissionId()** (2 connections) — `services/token-server/src/tokens.ts`
- **validSeedTopic()** (2 connections) — `services/token-server/src/tokens.ts`
- **validStartRung()** (2 connections) — `services/token-server/src/tokens.ts`
- **validTutorVoice()** (2 connections) — `services/token-server/src/tokens.ts`
- **GrantResult** (1 connections) — `services/token-server/src/tokens.ts`
- **SeedTopic** (1 connections) — `services/token-server/src/tokens.ts`
- **SessionGrant** (1 connections) — `services/token-server/src/tokens.ts`
- **SessionMode** (1 connections) — `services/token-server/src/tokens.ts`
- **config** (1 connections) — `services/token-server/src/tokens.test.ts`

## Relationships

- [Session Metering Plans](Session_Metering_Plans.md) (6 shared connections)
- [Entitlement Store](Entitlement_Store.md) (6 shared connections)
- [Account Deletion Agent Auth](Account_Deletion_Agent_Auth.md) (4 shared connections)
- [Mission Tint Acoustic Model](Mission_Tint_Acoustic_Model.md) (2 shared connections)
- [Gate Ledger Contract](Gate_Ledger_Contract.md) (2 shared connections)
- [Mission Chooser View](Mission_Chooser_View.md) (1 shared connections)
- [Pre-Account Onboarding Draft](Pre-Account_Onboarding_Draft.md) (1 shared connections)

## Source Files

- `services/token-server/src/tokens.test.ts`
- `services/token-server/src/tokens.ts`

## Audit Trail

- EXTRACTED: 47 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*