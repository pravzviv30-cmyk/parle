# Tutor Agent Smoke Test

> 13 nodes · cohesion 0.17

## Key Concepts

- **encodeMessage()** (17 connections) — `packages/core/src/protocol/protocol.ts`
- **smokeTutor.mjs** (11 connections) — `scripts/smokeTutor.mjs`
- **TOPIC_SERVER** (7 connections) — `packages/core/src/protocol/protocol.ts`
- **TOPIC_CLIENT** (5 connections) — `packages/core/src/protocol/protocol.ts`
- **packages/core is deliberately platform-free** (4 connections) — `README.md`
- **The agent is authoritative over session state** (3 connections) — `README.md`
- **send()** (2 connections) — `scripts/smokeTutor.mjs`
- **tapped()** (2 connections) — `services/tutor-agent/src/tutor.test.ts`
- **inbox** (1 connections) — `scripts/smokeTutor.mjs`
- **messageInbox()** (1 connections) — `scripts/smokeTutor.mjs`
- **room** (1 connections) — `scripts/smokeTutor.mjs`
- **smokeStartedAt** (1 connections) — `scripts/smokeTutor.mjs`
- **tokenReadyAt** (1 connections) — `scripts/smokeTutor.mjs`

## Relationships

- [Client-Agent Protocol](Client-Agent_Protocol.md) (6 shared connections)
- [Live Session Audio Lifecycle](Live_Session_Audio_Lifecycle.md) (4 shared connections)
- [Conversation Test Fixtures](Conversation_Test_Fixtures.md) (4 shared connections)
- [Turn Timing Metrics](Turn_Timing_Metrics.md) (3 shared connections)
- [Onboarding Voice Step](Onboarding_Voice_Step.md) (3 shared connections)
- [Brain Prompt & Turn Queue](Brain_Prompt_&_Turn_Queue.md) (2 shared connections)
- [Live Session Test Fragments](Live_Session_Test_Fragments.md) (1 shared connections)
- [Session Start Ownership](Session_Start_Ownership.md) (1 shared connections)
- [Voice Lifecycle Checks](Voice_Lifecycle_Checks.md) (1 shared connections)
- [Safety & Thinking View](Safety_&_Thinking_View.md) (1 shared connections)
- [Product Design Principles](Product_Design_Principles.md) (1 shared connections)
- [Pedagogy Ladder Logic](Pedagogy_Ladder_Logic.md) (1 shared connections)

## Source Files

- `README.md`
- `packages/core/src/protocol/protocol.ts`
- `scripts/smokeTutor.mjs`
- `services/tutor-agent/src/tutor.test.ts`

## Audit Trail

- EXTRACTED: 41 (95%)
- INFERRED: 2 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*