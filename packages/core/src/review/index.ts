export {
  newCard,
  applyGrade,
  dueCards,
  firstReturn,
  mergeCards,
  AGAIN_RETRY_MS,
  MIN_EASE,
  DEFAULT_EASE,
  DUE_CAP,
  type ReviewCard,
  type ReviewCardKind,
  type ReviewGrade,
  type GradeContext,
} from './scheduler.ts';

export {
  evidenceOf,
  evidenceStateOf,
  presentationOf,
  addEvidence,
  raiseEvidenceTo,
  isDue,
  isSettled,
  isMastered,
  NO_EVIDENCE,
  EVIDENCE_STATES,
  MASTERY_USES,
  SETTLED_REPS,
  SETTLED_DAYS,
  type PhraseEvidence,
  type EvidenceState,
  type CardPresentation,
} from './evidence.ts';

export { buildCardsFromSummary } from './cards.ts';

export { mergeDecks, gradesApplied, PAST_CONVERSATION_NOTE } from './merge.ts';

export { reviewPhraseFor } from './language.ts';

export {
  conversationOnly,
  reviewableFree,
  sourcesOf,
  unionSources,
  withSources,
  REVIEW_SOURCES,
  type ReviewSource,
} from './sources.ts';
