/**
 * "One line to try", French with its English under it (F943).
 *
 * The English is core data (`Mission.referencePhrasesEn`), index for index with
 * the French, so a learner who cannot yet read the line still knows what it
 * says. Display only: what gets scored is still the French.
 */
import type { Mission } from '@luvani/core';

export interface ReferenceLine { fr: string; en: string }

export function referenceLines(mission: Pick<Mission, 'referencePhrases' | 'referencePhrasesEn'>, limit = 3): ReferenceLine[] {
  return mission.referencePhrases.slice(0, limit).map((fr, index) => ({ fr, en: mission.referencePhrasesEn[index] ?? '' }));
}
