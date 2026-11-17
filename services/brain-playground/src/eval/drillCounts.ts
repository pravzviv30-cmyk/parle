/**
 * What the drill eval counts in one generated batch (F1124): exercises that
 * pass `validateExercise` (the basic check), and exercises that survive
 * `groundedDrills`, the filter the live tutor and the practice worker apply
 * before a learner sees a drill.
 *
 * The grounded keys mirror `drillPhraseKeys` in tutor-agent's convo.ts: the
 * phrases the request was built from, transfer phrases included. Production
 * always passes the learner's CEFR estimate as the band for the answer-length
 * cap. The eval's profiles carry none, so they take the estimate a learner
 * with no history starts on (`createProfile`, A0), which is also the strictest.
 */

import { createProfile, type DrillGenerationInput } from '@luvani/brain';
import { groundedDrills, phraseKeyOf, validateExercise, type DrillExercise } from '@luvani/core';
import { outputGuard } from '@luvani/tutor-agent/src/safety.ts';

export interface DrillCounts {
  total: number;
  /** Exercises that pass `validateExercise`, the basic check. */
  basic: number;
  /** Exercises that survive `groundedDrills`, the filter production applies. */
  kept: DrillExercise[];
  /** Why the basic check rejected exercises, by reason. */
  reasons: Map<string, number>;
}

export function drillCounts(exercises: readonly DrillExercise[], input: DrillGenerationInput): DrillCounts {
  let basic = 0;
  const reasons = new Map<string, number>();
  for (const exercise of exercises) {
    const verdict = validateExercise(exercise);
    if (verdict.ok) basic += 1;
    else for (const reason of verdict.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  const keys = new Set(
    [...input.sessionPhrases, ...input.profilePhrases, ...(input.transferPhrases ?? [])].map((p) => phraseKeyOf(p.fr)),
  );
  const kept = groundedDrills(exercises, keys, { screen: outputGuard, band: createProfile().cefr.estimate });
  return { total: exercises.length, basic, kept, reasons };
}
