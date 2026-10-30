import { authoredCorrectionReason, type CorrectionReasonId } from '@luvani/core';

/**
 * The chip under a learner's line (founder, 2026-10-29). A grammar fix
 * (`grammar-slip`) is a small fix; every other kind, and a kind this build has
 * never heard of, keeps "A more natural way".
 */
export function recastLabel(kind: string | undefined): string {
  return kind === 'grammar-slip' ? 'Small fix' : 'A more natural way';
}

export interface RecastView {
  label: string;
  better: string;
  betterEn: string;
  /** The authored reason in words, or null when there is none. */
  reason: string | null;
  /** The newest correction is drawn with the marker; older ones are plain. */
  latest: boolean;
}

/** What a recast shows, in the transcript and in the margin note alike. */
export function recastView(recast: { kind?: string; better: string; betterEn: string; reason?: CorrectionReasonId }, options: { latest: boolean }): RecastView {
  return {
    label: recastLabel(recast.kind),
    better: recast.better,
    betterEn: recast.betterEn,
    reason: authoredCorrectionReason(recast.reason),
    latest: options.latest,
  };
}
