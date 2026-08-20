# Conversation State Pipeline

> 10 nodes · cohesion 0.33

## Key Concepts

- **ConversationState** (20 connections) — `packages/brain/src/engine/conversation.ts`
- **buildSystemBlocks()** (17 connections) — `packages/brain/src/prompt/system.ts`
- **.publish()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.finish()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.curatePractice()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.generateDrills()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.curateAndDrill()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.extractMemory()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.conversationState()** (2 connections) — `services/tutor-agent/src/convo.ts`
- **.sendSpeaking()** (2 connections) — `services/tutor-agent/src/convo.ts`

## Relationships

- [Live Conversation Orchestrator](Live_Conversation_Orchestrator.md) (19 shared connections)
- [Turn Integration & Copy Rules](Turn_Integration_&_Copy_Rules.md) (5 shared connections)
- [Topic Curation](Topic_Curation.md) (5 shared connections)
- [Drill Generation Prompts](Drill_Generation_Prompts.md) (5 shared connections)
- [Learner Profile Model](Learner_Profile_Model.md) (4 shared connections)
- [Contract Schemas & Samples](Contract_Schemas_&_Samples.md) (4 shared connections)
- [LLM Client Adapters](LLM_Client_Adapters.md) (3 shared connections)
- [Playground CLI Commands](Playground_CLI_Commands.md) (3 shared connections)
- [Convo Frames & Usage](Convo_Frames_&_Usage.md) (3 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (3 shared connections)
- [Memory Extraction Prompt](Memory_Extraction_Prompt.md) (2 shared connections)
- [Difficulty Ladder](Difficulty_Ladder.md) (1 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `packages/brain/src/prompt/system.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 75 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*