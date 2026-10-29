import { DEFAULT_TUTOR_VOICE, parseFirstPracticeBrief, type FirstPracticeBrief } from '@luvani/core';
import { isPlacement, type Placement } from '../onboarding/placement.ts';

/**
 * Self-described support preferences, never earned or certified ability.
 * `placement` is where the learner chose to start (F917); it is present only
 * when set, and it never credits a stage (`onboarding/placement.ts`).
 */
export type PracticePreferences = Pick<FirstPracticeBrief, 'level' | 'confidence' | 'focus'> & { placement?: Placement };
const EMPTY: PracticePreferences = { level: null, confidence: null, focus: null };

/**
 * Reuse core's closed first-practice schema for each independent answer. One
 * malformed field does not discard another real answer, and no arbitrary text
 * survives in this small profile field.
 */
export function storedPracticePreferences(value: unknown): PracticePreferences | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const input = value as Record<string, unknown>;
  const clean: PracticePreferences = { ...EMPTY };
  for (const field of ['level', 'confidence', 'focus'] as const) {
    const parsed = parseFirstPracticeBrief({
      version: 1, goals: [], ...EMPTY, [field]: input[field] ?? null,
      minutes: null, tutorVoice: DEFAULT_TUTOR_VOICE,
    });
    if (field === 'level') clean.level = parsed?.level ?? null;
    else if (field === 'confidence') clean.confidence = parsed?.confidence ?? null;
    else clean.focus = parsed?.focus ?? null;
  }
  if (isPlacement(input.placement)) clean.placement = input.placement;
  return clean.level !== null || clean.confidence !== null || clean.focus !== null || clean.placement !== undefined ? clean : undefined;
}

/** Legacy and malformed profiles remain unanswered, without re-onboarding. */
export function practicePreferencesOf(profile: { practicePreferences?: unknown } | null | undefined): PracticePreferences {
  return storedPracticePreferences(profile?.practicePreferences) ?? { ...EMPTY };
}

export type StatedLevel = 'zero' | 'few' | 'getby' | 'confident';

/**
 * Settings copy for the stated starting point. Titles are the onboarding
 * `START_LEVELS` titles verbatim, so the learner sees the words they chose.
 */
export const STATED_LEVEL_OPTIONS: readonly { key: StatedLevel; title: string }[] = [
  { key: 'zero', title: 'Brand new' },
  { key: 'few', title: 'A few words' },
  { key: 'getby', title: 'I can get by' },
  { key: 'confident', title: 'Feeling confident' },
];

export const STATED_LEVEL_FOOTER = 'Changes the conversations we suggest next. Your earned level stays as it is.';
