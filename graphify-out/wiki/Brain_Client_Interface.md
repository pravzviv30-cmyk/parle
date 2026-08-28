# Brain Client Interface

> 13 nodes · cohesion 0.33

## Key Concepts

- **ConversationState** (20 connections) — `packages/brain/src/engine/conversation.ts`
- **.curatePractice()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.generateDrills()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.extractMemory()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.buildFrame()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.recordBrainUsage()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.recordFailedCall()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.curateAndDrill()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.noteAbandoned()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **postSessionDeadlineMs()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **withDeadline()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.conversationState()** (2 connections) — `services/tutor-agent/src/convo.ts`
- **.knownPhrases()** (2 connections) — `services/tutor-agent/src/convo.ts`

## Relationships

- [Conversation Orchestration](Conversation_Orchestration.md) (21 shared connections)
- [Coach Sample Fixtures](Coach_Sample_Fixtures.md) (6 shared connections)
- [Topic Curation](Topic_Curation.md) (5 shared connections)
- [Claude CLI and Pricing](Claude_CLI_and_Pricing.md) (5 shared connections)
- [Conversation View Model](Conversation_View_Model.md) (4 shared connections)
- [Brain LLM Client Types](Brain_LLM_Client_Types.md) (3 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (3 shared connections)
- [Zod Contract Schemas](Zod_Contract_Schemas.md) (2 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (2 shared connections)
- [Brain Playground CLI](Brain_Playground_CLI.md) (2 shared connections)
- [Difficulty Ladder](Difficulty_Ladder.md) (1 shared connections)
- [Session and Attempt Scoring](Session_and_Attempt_Scoring.md) (1 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 85 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*