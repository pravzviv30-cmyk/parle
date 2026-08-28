export {
  createSession,
  currentPrompt,
  submitTurn,
  summarise,
  grade,
  MAX_ATTEMPTS_PER_TURN,
  INTELLIGIBLE,
  // Public because the conversation takes the same decision and must read this
  // declaration rather than keep a second copy of the number. See
  // CORRECTION_COOLDOWN_TURNS in session.ts.
  CORRECTION_COOLDOWN_TURNS,
  type SessionState,
  type SessionPrompt,
  type SessionSummary,
  type SupportView,
  type LearnerInput,
  type TurnFeedback,
  type TranscriptEntry,
} from './session.ts';
