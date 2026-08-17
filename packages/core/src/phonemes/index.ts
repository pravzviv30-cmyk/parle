export {
  FRENCH_PHONEMES,
  PHONEME_COUNT,
  getPhoneme,
  novelPhonemes,
  meaningBearingPhonemes,
  type Phoneme,
  type PhonemeClass,
  type Difficulty,
} from './inventory.ts';

export { DRILLS, getDrill, drillsFor, bestDrillFor, type Drill, type DrillKind, type DrillWord, type MinimalPair } from './drills.ts';

export {
  aggregate,
  buildReport,
  overallScore,
  priority,
  GOOD_ENOUGH,
  MIN_SAMPLES_TO_FLAG,
  type PhonemeObservation,
  type PhonemeStat,
  type FocusPoint,
  type SessionPhonemeReport,
} from './scoring.ts';
