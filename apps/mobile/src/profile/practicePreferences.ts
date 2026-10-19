import { DEFAULT_TUTOR_VOICE, parseFirstPracticeBrief, type FirstPracticeBrief } from '@luvani/core';

/** Self-described support preferences, never earned or certified ability. */
export type PracticePreferences = Pick<FirstPracticeBrief, 'level' | 'confidence' | 'focus'>;
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
  return clean.level !== null || clean.confidence !== null || clean.focus !== null ? clean : undefined;
}

/** Legacy and malformed profiles remain unanswered, without re-onboarding. */
export function practicePreferencesOf(profile: { practicePreferences?: unknown } | null | undefined): PracticePreferences {
  return storedPracticePreferences(profile?.practicePreferences) ?? { ...EMPTY };
}
