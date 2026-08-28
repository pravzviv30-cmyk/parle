# Repo Design Principles

> 25 nodes · cohesion 0.10

## Key Concepts

- **shared/speechace.ts** (10 connections) — `services/shared/speechace.ts`
- **speechace.test.ts** (10 connections) — `services/tutor-agent/src/speechace.test.ts`
- **scoreUtterance()** (9 connections) — `services/shared/speechace.ts`
- **phoneMap.ts** (6 connections) — `services/shared/phoneMap.ts`
- **Expo + TypeScript npm-workspaces monorepo** (4 connections) — `PRODUCT.md`
- **Trustworthy pronunciation needs a reference text** (4 connections) — `PRODUCT.md`
- **packages/core is deliberately platform-free** (4 connections) — `README.md`
- **toInventoryIpa()** (4 connections) — `services/shared/phoneMap.ts`
- **parseSpeechace()** (4 connections) — `services/shared/speechace.ts`
- **Absolute-beginner audience (CEFR A0-A2)** (3 connections) — `PRODUCT.md`
- **The agent is authoritative over session state** (3 connections) — `README.md`
- **The alignment thesis** (3 connections) — `README.md`
- **A missing score is never an invented penalty** (3 connections) — `README.md`
- **src/speechace.ts** (3 connections) — `services/tutor-agent/src/speechace.ts`
- **Read the exact versioned Expo docs before writing code** (2 connections) — `apps/mobile/AGENTS.md`
- **Parle (working name)** (2 connections) — `PRODUCT.md`
- **Repo path contains a space** (1 connections) — `README.md`
- **ALIASES** (1 connections) — `services/shared/phoneMap.ts`
- **FRENCH_IPA** (1 connections) — `services/shared/phoneMap.ts`
- **isInventoryIpa()** (1 connections) — `services/shared/phoneMap.ts`
- **ScoreFetch** (1 connections) — `services/shared/speechace.ts`
- **ScoreRequest** (1 connections) — `services/shared/speechace.ts`
- **recorder()** (1 connections) — `services/tutor-agent/src/speechace.test.ts`
- **RESPONSE** (1 connections) — `services/tutor-agent/src/speechace.test.ts`
- **withKey()** (1 connections) — `services/tutor-agent/src/speechace.test.ts`

## Relationships

- [Difficulty Ladder](Difficulty_Ladder.md) (4 shared connections)
- [Thinking and Session Reporting](Thinking_and_Session_Reporting.md) (3 shared connections)
- [Session and Attempt Scoring](Session_and_Attempt_Scoring.md) (3 shared connections)
- [Account Deletion and Events](Account_Deletion_and_Events.md) (3 shared connections)
- [Pronunciation Drill Bank](Pronunciation_Drill_Bank.md) (2 shared connections)
- [Path Node Status Line](Path_Node_Status_Line.md) (2 shared connections)
- [App Root Wiring](App_Root_Wiring.md) (1 shared connections)
- [UI Component Primitives](UI_Component_Primitives.md) (1 shared connections)
- [Client Server Protocol](Client_Server_Protocol.md) (1 shared connections)
- [Parle Tutor Agent](Parle_Tutor_Agent.md) (1 shared connections)

## Source Files

- `PRODUCT.md`
- `README.md`
- `apps/mobile/AGENTS.md`
- `services/shared/phoneMap.ts`
- `services/shared/speechace.ts`
- `services/tutor-agent/src/speechace.test.ts`
- `services/tutor-agent/src/speechace.ts`

## Audit Trail

- EXTRACTED: 43 (83%)
- INFERRED: 9 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*