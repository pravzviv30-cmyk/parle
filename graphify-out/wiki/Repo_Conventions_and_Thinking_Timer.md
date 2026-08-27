# Repo Conventions and Thinking Timer

> 10 nodes · cohesion 0.24

## Key Concepts

- **ServerMessage** (12 connections) — `packages/core/src/protocol/protocol.ts`
- **thinking.ts** (5 connections) — `apps/mobile/src/live/thinking.ts`
- **thinking.test.ts** (4 connections) — `apps/mobile/src/live/thinking.test.ts`
- **thinkingAfter()** (4 connections) — `apps/mobile/src/live/thinking.ts`
- **Expo + TypeScript npm-workspaces monorepo** (4 connections) — `PRODUCT.md`
- **packages/core is deliberately platform-free** (4 connections) — `README.md`
- **The agent is authoritative over session state** (3 connections) — `README.md`
- **Read the exact versioned Expo docs before writing code** (2 connections) — `apps/mobile/AGENTS.md`
- **Parle (working name)** (2 connections) — `PRODUCT.md`
- **Repo path contains a space** (1 connections) — `README.md`

## Relationships

- [Live Failure Classification](Live_Failure_Classification.md) (3 shared connections)
- [App Agent Protocol](App_Agent_Protocol.md) (3 shared connections)
- [Path Node Status Line](Path_Node_Status_Line.md) (2 shared connections)
- [Mock Speech Session Screen](Mock_Speech_Session_Screen.md) (2 shared connections)
- [Conversation Brain Spend](Conversation_Brain_Spend.md) (2 shared connections)
- [Difficulty Ladder](Difficulty_Ladder.md) (2 shared connections)
- [App Root Bootstrap](App_Root_Bootstrap.md) (1 shared connections)
- [Conversation Turn Orchestration](Conversation_Turn_Orchestration.md) (1 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (1 shared connections)
- [Tutor Prompt Building](Tutor_Prompt_Building.md) (1 shared connections)
- [Parle Tutor Agent](Parle_Tutor_Agent.md) (1 shared connections)

## Source Files

- `PRODUCT.md`
- `README.md`
- `apps/mobile/AGENTS.md`
- `apps/mobile/src/live/thinking.test.ts`
- `apps/mobile/src/live/thinking.ts`
- `packages/core/src/protocol/protocol.ts`

## Audit Trail

- EXTRACTED: 25 (83%)
- INFERRED: 5 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*