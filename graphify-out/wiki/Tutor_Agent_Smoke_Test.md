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

- [Wire Protocol Codec](Wire_Protocol_Codec.md) (6 shared connections)
- [LiveKit Session Globals](LiveKit_Session_Globals.md) (4 shared connections)
- [Conversation Packs](Conversation_Packs.md) (4 shared connections)
- [agent.ts](agent.ts.md) (3 shared connections)
- [Pre-Account Onboarding Draft](Pre-Account_Onboarding_Draft.md) (3 shared connections)
- [Tutor Prompt Building](Tutor_Prompt_Building.md) (2 shared connections)
- [Live Session Hook Tests](Live_Session_Hook_Tests.md) (1 shared connections)
- [Start Ownership Guard](Start_Ownership_Guard.md) (1 shared connections)
- [Voice Lifecycle Checks](Voice_Lifecycle_Checks.md) (1 shared connections)
- [Safety State View](Safety_State_View.md) (1 shared connections)
- [Design System Doc](Design_System_Doc.md) (1 shared connections)
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