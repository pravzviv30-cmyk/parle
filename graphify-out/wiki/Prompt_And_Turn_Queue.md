# Prompt And Turn Queue

> 35 nodes · cohesion 0.08

## Key Concepts

- **tutor.ts** (42 connections) — `services/tutor-agent/src/tutor.ts`
- **tutor.test.ts** (20 connections) — `services/tutor-agent/src/tutor.test.ts`
- **prompt.ts** (12 connections) — `services/tutor-agent/src/prompt.ts`
- **src/prompt.test.ts** (10 connections) — `services/tutor-agent/src/prompt.test.ts`
- **TurnQueue** (9 connections) — `services/tutor-agent/src/queue.ts`
- **buildPrompt()** (8 connections) — `services/tutor-agent/src/prompt.ts`
- **tutor-agent/src/usage.ts** (6 connections) — `services/tutor-agent/src/usage.ts`
- **reportUsage()** (6 connections) — `services/tutor-agent/src/usage.ts`
- **TEXT_SILENCE_MS** (4 connections) — `services/tutor-agent/src/convo.ts`
- **queue.ts** (4 connections) — `services/tutor-agent/src/queue.ts`
- **baseInstructions()** (3 connections) — `services/tutor-agent/src/prompt.ts`
- **turnInstructions()** (3 connections) — `services/tutor-agent/src/prompt.ts`
- **queue.test.ts** (3 connections) — `services/tutor-agent/src/queue.test.ts`
- **forgetReportedSessions()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **build()** (3 connections) — `services/tutor-agent/src/tutor.test.ts`
- **usage.test.ts** (3 connections) — `services/tutor-agent/src/usage.test.ts`
- **.run()** (2 connections) — `services/tutor-agent/src/queue.ts`
- **.runIfCurrent()** (2 connections) — `services/tutor-agent/src/queue.ts`
- **REPLAYED_SESSION_MESSAGE** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **stubSession()** (2 connections) — `services/tutor-agent/src/tutor.test.ts`
- **tapped()** (2 connections) — `services/tutor-agent/src/tutor.test.ts`
- **UNSIGNED_SESSION_ID** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **held()** (1 connections) — `services/tutor-agent/src/queue.test.ts`
- **.busy()** (1 connections) — `services/tutor-agent/src/queue.ts`
- **.generation()** (1 connections) — `services/tutor-agent/src/queue.ts`
- *... and 10 more nodes in this community*

## Relationships

- [Conversation Brain Client](Conversation_Brain_Client.md) (13 shared connections)
- [Tutor Turn Handling](Tutor_Turn_Handling.md) (8 shared connections)
- [Mock Speech Session](Mock_Speech_Session.md) (7 shared connections)
- [Lesson Definitions](Lesson_Definitions.md) (5 shared connections)
- [Ladder State Machine](Ladder_State_Machine.md) (5 shared connections)
- [App Agent Protocol](App_Agent_Protocol.md) (5 shared connections)
- [TTS Caching Layer](TTS_Caching_Layer.md) (5 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (4 shared connections)
- [Drill Merge And Scene Controls](Drill_Merge_And_Scene_Controls.md) (4 shared connections)
- [Brain CLI Playground](Brain_CLI_Playground.md) (2 shared connections)
- [Thinking And Safety Views](Thinking_And_Safety_Views.md) (2 shared connections)
- [Speechace Pronunciation Scoring](Speechace_Pronunciation_Scoring.md) (2 shared connections)

## Source Files

- `services/tutor-agent/src/convo.ts`
- `services/tutor-agent/src/prompt.test.ts`
- `services/tutor-agent/src/prompt.ts`
- `services/tutor-agent/src/queue.test.ts`
- `services/tutor-agent/src/queue.ts`
- `services/tutor-agent/src/tutor.test.ts`
- `services/tutor-agent/src/tutor.ts`
- `services/tutor-agent/src/usage.test.ts`
- `services/tutor-agent/src/usage.ts`

## Audit Trail

- EXTRACTED: 115 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*