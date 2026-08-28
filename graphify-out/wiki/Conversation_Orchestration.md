# Conversation Orchestration

> 42 nodes · cohesion 0.15

## Key Concepts

- **ParleConversation** (62 connections) — `services/tutor-agent/src/convo.ts`
- **.runBrainTurn()** (20 connections) — `services/tutor-agent/src/convo.ts`
- **.publish()** (16 connections) — `services/tutor-agent/src/convo.ts`
- **.finish()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.routeClientMessage()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.startScene()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.armRescue()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.handleSafety()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.clearRescue()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.open()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.openMission()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.say()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.openScene()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.returnToChoosing()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.onUserTurnCompleted()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.rescue()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.speak()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **LearnerTurnInput** (6 connections) — `packages/brain/src/engine/conversation.ts`
- **.guardLine()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.publishView()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.recover()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.releaseMoment()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.closeAfterStop()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.deferForAMoment()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.guardView()** (4 connections) — `services/tutor-agent/src/convo.ts`
- *... and 17 more nodes in this community*

## Relationships

- [Brain Client Interface](Brain_Client_Interface.md) (21 shared connections)
- [Conversation View Model](Conversation_View_Model.md) (10 shared connections)
- [Coach Sample Fixtures](Coach_Sample_Fixtures.md) (10 shared connections)
- [Conversation Engine Tests](Conversation_Engine_Tests.md) (8 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (5 shared connections)
- [Brain LLM Client Types](Brain_LLM_Client_Types.md) (4 shared connections)
- [Thinking and Session Reporting](Thinking_and_Session_Reporting.md) (4 shared connections)
- [Agent Turn Timing](Agent_Turn_Timing.md) (3 shared connections)
- [Tutor Evaluation Cases](Tutor_Evaluation_Cases.md) (2 shared connections)
- [Brain Playground CLI](Brain_Playground_CLI.md) (2 shared connections)
- [Brain Spend Metering](Brain_Spend_Metering.md) (2 shared connections)
- [Safety Decision Guard](Safety_Decision_Guard.md) (2 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 204 (99%)
- INFERRED: 3 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*