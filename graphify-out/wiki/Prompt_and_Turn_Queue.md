# Prompt and Turn Queue

> 20 nodes · cohesion 0.17

## Key Concepts

- **core/src/index.ts** (64 connections) — `packages/core/src/index.ts`
- **tutor.ts** (29 connections) — `services/tutor-agent/src/tutor.ts`
- **prompt.ts** (9 connections) — `services/tutor-agent/src/prompt.ts`
- **src/prompt.test.ts** (8 connections) — `services/tutor-agent/src/prompt.test.ts`
- **buildPrompt()** (7 connections) — `services/tutor-agent/src/prompt.ts`
- **TurnQueue** (7 connections) — `services/tutor-agent/src/queue.ts`
- **thinking.ts** (5 connections) — `apps/mobile/src/live/thinking.ts`
- **reportUsage()** (5 connections) — `services/tutor-agent/src/usage.ts`
- **thinking.test.ts** (4 connections) — `apps/mobile/src/live/thinking.test.ts`
- **thinkingAfter()** (4 connections) — `apps/mobile/src/live/thinking.ts`
- **tutor-agent/src/usage.ts** (4 connections) — `services/tutor-agent/src/usage.ts`
- **baseInstructions()** (3 connections) — `services/tutor-agent/src/prompt.ts`
- **turnInstructions()** (3 connections) — `services/tutor-agent/src/prompt.ts`
- **queue.ts** (3 connections) — `services/tutor-agent/src/queue.ts`
- **.run()** (2 connections) — `services/tutor-agent/src/queue.ts`
- **.runIfCurrent()** (2 connections) — `services/tutor-agent/src/queue.ts`
- **.generation()** (1 connections) — `services/tutor-agent/src/queue.ts`
- **.idle()** (1 connections) — `services/tutor-agent/src/queue.ts`
- **Publisher** (1 connections) — `services/tutor-agent/src/tutor.ts`
- **UsageReport** (1 connections) — `services/tutor-agent/src/usage.ts`

## Relationships

- [Client Agent Wire Protocol](Client_Agent_Wire_Protocol.md) (8 shared connections)
- [Conversation Ladder and Copy Rules](Conversation_Ladder_and_Copy_Rules.md) (7 shared connections)
- [Lesson Session Grading](Lesson_Session_Grading.md) (7 shared connections)
- [Tab Bar Icons](Tab_Bar_Icons.md) (7 shared connections)
- [Shared UI Components](Shared_UI_Components.md) (7 shared connections)
- [LiveKit Tutor Agent](LiveKit_Tutor_Agent.md) (7 shared connections)
- [Learner Profile Model](Learner_Profile_Model.md) (6 shared connections)
- [Live Session Navigation Context](Live_Session_Navigation_Context.md) (5 shared connections)
- [Utterance Audio Capture](Utterance_Audio_Capture.md) (5 shared connections)
- [Live Failure Handling](Live_Failure_Handling.md) (4 shared connections)
- [Phoneme Scoring Bridge](Phoneme_Scoring_Bridge.md) (4 shared connections)
- [Drill Bank and Design Tokens](Drill_Bank_and_Design_Tokens.md) (2 shared connections)

## Source Files

- `apps/mobile/src/live/thinking.test.ts`
- `apps/mobile/src/live/thinking.ts`
- `packages/core/src/index.ts`
- `services/tutor-agent/src/prompt.test.ts`
- `services/tutor-agent/src/prompt.ts`
- `services/tutor-agent/src/queue.ts`
- `services/tutor-agent/src/tutor.ts`
- `services/tutor-agent/src/usage.ts`

## Audit Trail

- EXTRACTED: 131 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*