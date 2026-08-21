# Brain Playground CLI

> 38 nodes · cohesion 0.14

## Key Concepts

- **sessionLoop.ts** (42 connections) — `services/brain-playground/src/sessionLoop.ts`
- **chat.ts** (34 connections) — `services/brain-playground/src/chat.ts`
- **src/render.ts** (26 connections) — `services/brain-playground/src/render.ts`
- **main()** (18 connections) — `services/brain-playground/src/chat.ts`
- **runInput()** (14 connections) — `services/brain-playground/src/sessionLoop.ts`
- **supportViewFor()** (8 connections) — `packages/brain/src/engine/conversation.ts`
- **defaultModel()** (8 connections) — `packages/brain/src/llm/openaiCompat.ts`
- **commands.ts** (8 connections) — `services/brain-playground/src/commands.ts`
- **meta** (8 connections) — `services/brain-playground/src/render.ts`
- **renderRecap()** (8 connections) — `services/brain-playground/src/render.ts`
- **renderTurnView()** (7 connections) — `services/brain-playground/src/render.ts`
- **warm** (7 connections) — `services/brain-playground/src/render.ts`
- **beginSession()** (7 connections) — `services/brain-playground/src/sessionLoop.ts`
- **buildScenario()** (7 connections) — `services/brain-playground/src/sessionLoop.ts`
- **formatTurnUsage()** (7 connections) — `services/brain-playground/src/usage.ts`
- **SessionRecap** (6 connections) — `packages/brain/src/contract/types.ts`
- **renderOpening()** (6 connections) — `services/brain-playground/src/render.ts`
- **renderRescue()** (6 connections) — `services/brain-playground/src/render.ts`
- **title** (6 connections) — `services/brain-playground/src/render.ts`
- **resetProfile()** (5 connections) — `services/brain-playground/src/profileStore.ts`
- **saveProfile()** (5 connections) — `services/brain-playground/src/profileStore.ts`
- **rungLine()** (5 connections) — `services/brain-playground/src/render.ts`
- **endSession()** (5 connections) — `services/brain-playground/src/sessionLoop.ts`
- **Session** (5 connections) — `services/brain-playground/src/sessionLoop.ts`
- **pickClient()** (4 connections) — `services/brain-playground/src/chat.ts`
- *... and 13 more nodes in this community*

## Relationships

- [Conversation State Machine](Conversation_State_Machine.md) (15 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (14 shared connections)
- [Brain Evaluation Harness](Brain_Evaluation_Harness.md) (14 shared connections)
- [Learner Copy Rules](Learner_Copy_Rules.md) (9 shared connections)
- [Brain Client Contracts](Brain_Client_Contracts.md) (8 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (6 shared connections)
- [Memory Extraction Client](Memory_Extraction_Client.md) (5 shared connections)
- [Brain Client Test Fixtures](Brain_Client_Test_Fixtures.md) (3 shared connections)
- [Profile Store And Migration](Profile_Store_And_Migration.md) (3 shared connections)
- [Tutor Tab Curation](Tutor_Tab_Curation.md) (2 shared connections)
- [Brain Schemas And Samples](Brain_Schemas_And_Samples.md) (2 shared connections)
- [Live Conversation Orchestrator](Live_Conversation_Orchestrator.md) (2 shared connections)

## Source Files

- `packages/brain/src/contract/types.ts`
- `packages/brain/src/engine/conversation.ts`
- `packages/brain/src/llm/openaiCompat.ts`
- `services/brain-playground/src/chat.ts`
- `services/brain-playground/src/commands.test.ts`
- `services/brain-playground/src/commands.ts`
- `services/brain-playground/src/profileStore.ts`
- `services/brain-playground/src/render.ts`
- `services/brain-playground/src/sessionLoop.ts`
- `services/brain-playground/src/usage.ts`

## Audit Trail

- EXTRACTED: 189 (99%)
- INFERRED: 2 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*