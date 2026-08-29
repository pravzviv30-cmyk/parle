# Session Domain Types

> 14 nodes · cohesion 0.21

## Key Concepts

- **Rung** (38 connections) — `packages/core/src/ladder/ladder.ts`
- **SessionSummary** (24 connections) — `packages/core/src/session/session.ts`
- **ConvoPhrase** (12 connections) — `packages/core/src/protocol/protocol.ts`
- **RecapPayload** (12 connections) — `packages/core/src/protocol/protocol.ts`
- **LiveSession** (11 connections) — `apps/mobile/src/live/useLiveSession.ts`
- **PracticeBatch** (10 connections) — `apps/mobile/src/live/journalRules.ts`
- **SessionPrompt** (9 connections) — `packages/core/src/session/session.ts`
- **SessionJournal** (7 connections) — `apps/mobile/src/live/journalRules.ts`
- **ConvoView** (7 connections) — `packages/core/src/protocol/protocol.ts`
- **IncomingTopic** (6 connections) — `packages/core/src/topics/topics.ts`
- **PhraseUse** (4 connections) — `apps/mobile/src/review/store.ts`
- **ReplayLine** (3 connections) — `apps/mobile/src/tutor/sceneControls.ts`
- **The conversation upgrade** (3 connections) — `README.md`
- **SessionViewProps** (2 connections) — `apps/mobile/src/SessionView.tsx`

## Relationships

- [Session Journal Recovery](Session_Journal_Recovery.md) (14 shared connections)
- [Conversation Screen And Profile](Conversation_Screen_And_Profile.md) (10 shared connections)
- [Audio Session Globals And Safety](Audio_Session_Globals_And_Safety.md) (10 shared connections)
- [App Agent Wire Protocol](App_Agent_Wire_Protocol.md) (10 shared connections)
- [Pronunciation Session Feedback](Pronunciation_Session_Feedback.md) (6 shared connections)
- [Mission Chooser View](Mission_Chooser_View.md) (6 shared connections)
- [Paper UI Primitives](Paper_UI_Primitives.md) (5 shared connections)
- [Coach Output Samples And Checks](Coach_Output_Samples_And_Checks.md) (4 shared connections)
- [Drill Exercise Bank Merge](Drill_Exercise_Bank_Merge.md) (3 shared connections)
- [Convo Screen Disk Tests](Convo_Screen_Disk_Tests.md) (3 shared connections)
- [Review Deck Store](Review_Deck_Store.md) (3 shared connections)
- [Cafe Lesson Definitions](Cafe_Lesson_Definitions.md) (3 shared connections)

## Source Files

- `README.md`
- `apps/mobile/src/SessionView.tsx`
- `apps/mobile/src/live/journalRules.ts`
- `apps/mobile/src/live/useLiveSession.ts`
- `apps/mobile/src/review/store.ts`
- `apps/mobile/src/tutor/sceneControls.ts`
- `packages/core/src/ladder/ladder.ts`
- `packages/core/src/protocol/protocol.ts`
- `packages/core/src/session/session.ts`
- `packages/core/src/topics/topics.ts`

## Audit Trail

- EXTRACTED: 126 (98%)
- INFERRED: 3 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*