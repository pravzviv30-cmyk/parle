# Drill Grading

> 24 nodes · cohesion 0.20

## Key Concepts

- **drill/index.ts** (45 connections) — `packages/core/src/drill/index.ts`
- **drill/session.ts** (37 connections) — `packages/core/src/drill/session.ts`
- **drill/grading.ts** (18 connections) — `packages/core/src/drill/grading.ts`
- **sameWord()** (7 connections) — `packages/core/src/text/distance.ts`
- **gradeAnswer()** (6 connections) — `packages/core/src/drill/grading.ts`
- **gradeFreeText()** (6 connections) — `packages/core/src/drill/grading.ts`
- **distance.ts** (6 connections) — `packages/core/src/text/distance.ts`
- **damerauLevenshtein()** (6 connections) — `packages/core/src/text/distance.ts`
- **DrillVerdict** (5 connections) — `packages/core/src/drill/grading.ts`
- **missFeedback()** (5 connections) — `packages/core/src/drill/session.ts`
- **typoFeedback()** (5 connections) — `packages/core/src/drill/session.ts`
- **realWordSet()** (4 connections) — `packages/core/src/drill/grading.ts`
- **DrillFeedback** (4 connections) — `packages/core/src/drill/session.ts`
- **feedbackMessage()** (4 connections) — `packages/core/src/drill/session.ts`
- **acceptedFor()** (3 connections) — `packages/core/src/drill/grading.ts`
- **DrillSummary** (3 connections) — `packages/core/src/drill/session.ts`
- **MAX_MISSES** (3 connections) — `packages/core/src/drill/session.ts`
- **TYPO_MAX_DISTANCE** (3 connections) — `packages/core/src/text/distance.ts`
- **TYPO_MIN_LENGTH** (3 connections) — `packages/core/src/text/distance.ts`
- **GradeResult** (2 connections) — `packages/core/src/drill/grading.ts`
- **AnsweredExercise** (2 connections) — `packages/core/src/drill/session.ts`
- **DrillOutcome** (2 connections) — `packages/core/src/drill/session.ts`
- **DrillStage** (2 connections) — `packages/core/src/drill/session.ts`
- **NEW_PHRASES_PER_SESSION** (2 connections) — `packages/core/src/drill/session.ts`

## Relationships

- [Drill Fixtures and Validation](Drill_Fixtures_and_Validation.md) (20 shared connections)
- [Drill Exercise Types](Drill_Exercise_Types.md) (12 shared connections)
- [Drill Session Building](Drill_Session_Building.md) (12 shared connections)
- [Drill Screen UI](Drill_Screen_UI.md) (10 shared connections)
- [Drill Screen Tests](Drill_Screen_Tests.md) (6 shared connections)
- [Spaced Repetition Scheduler](Spaced_Repetition_Scheduler.md) (6 shared connections)
- [Lesson Definitions](Lesson_Definitions.md) (5 shared connections)
- [Drill Exercise Merge](Drill_Exercise_Merge.md) (3 shared connections)
- [Path Node Status Line](Path_Node_Status_Line.md) (1 shared connections)

## Source Files

- `packages/core/src/drill/grading.ts`
- `packages/core/src/drill/index.ts`
- `packages/core/src/drill/session.ts`
- `packages/core/src/text/distance.ts`

## Audit Trail

- EXTRACTED: 128 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*