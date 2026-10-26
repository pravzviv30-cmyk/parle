export {
  type DrillDifficulty,
  type DrillExercise,
  type FillBlankExercise,
  type BestSentenceExercise,
  type AppropriateReplyExercise,
  type RepeatThisExercise,
  type TapTranslateExercise,
  type ListenTypeExercise,
  type TranslationExercise,
  type OwnWordsExercise,
} from './types.ts';

export {
  gradeAnswer,
  damerauLevenshtein,
  sameWord,
  TYPO_MIN_LENGTH,
  TYPO_MAX_DISTANCE,
  type DrillVerdict,
  type GradeResult,
} from './grading.ts';

export {
  buildDrillSession,
  mixQueue,
  answerCurrent,
  suppressMic,
  // Aliased at the boundary: session/ already owns the bare name, and the
  // root barrel's export * would silently drop BOTH on the collision.
  summarise as summariseDrill,
  applyDrillResults,
  stageOf,
  stageForReps,
  GOOD_FEEDBACK,
  typoFeedback,
  missFeedback,
  ownWordsFeedback,
  type FeedbackTone,
  DRILL_STAGES,
  MAX_MISSES,
  type DrillStage,
  type DrillOutcome,
  type DrillSessionState,
  type DrillFeedback,
  type DrillSummary,
  type AnsweredExercise,
  type SettledVerdict,
} from './session.ts';

export {
  ownWordsFrom,
  decideOwnWords,
  scopedOwnWordsSession,
  meaningWords,
  MUST_KEEP_MAX,
  type OwnWordsVerdict,
  type OwnWordsDecision,
} from './ownWords.ts';

export {
  selectPracticeQueue,
  selectPackQueue,
  buildPracticeSession,
  practiceGrades,
  practiceOutcomeOf,
  PRACTICE_QUEUE_CAP,
  PER_SOURCE_CAP,
  type PracticeSource,
  type PracticeTarget,
  type PracticeSelection,
  type PracticePack,
  type PracticeSession,
  type PracticeOutcome,
} from './practice.ts';

export {
  validateExercise,
  validateBatch,
  learnerVisibleStrings,
  groundedDrills,
  exceedsAnswerCap,
  expectedFrenchAnswers,
  DRILL_ANSWER_WORD_CAP,
  GENERATED_DRILL_CAP,
  type DrillBand,
  type GroundedDrillOptions,
  type ValidationResult,
} from './validate.ts';

export { DRILL_FIXTURES } from './fixtures.ts';
