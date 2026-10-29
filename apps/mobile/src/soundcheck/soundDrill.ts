/**
 * Which drill Sounds of French plays (F919, founder decision 20).
 *
 * The sound the learner most needs is the one their newest measured check
 * named (`headSound`, the same honest source the sound check's panel reads),
 * and the drill is core's `bestDrillFor` that sound, which prefers a minimal
 * pair. With no measured sound, or one this build cannot drill, it is the
 * bank's first minimal pair: a learner who opened a sound drill gets one.
 */

import { DRILLS, bestDrillFor, getPhoneme, type Drill } from '@luvani/core';

import { headSound } from './headSound.ts';
import type { SoundCheckEvidence } from './model.ts';

export function soundDrillFor(checks: readonly SoundCheckEvidence[]): Drill {
  const ipa = headSound(checks);
  const phoneme = ipa === null ? undefined : getPhoneme(ipa);
  const drill = phoneme === undefined ? undefined : bestDrillFor(phoneme, phoneme.typicalSubstitution);
  return drill ?? DRILLS.find((d) => d.kind === 'minimal-pair') ?? DRILLS[0]!;
}
