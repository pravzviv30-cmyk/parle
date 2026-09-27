/**
 * Before and after a tutor revisit (Stage 4, item 3).
 *
 * A revisit is briefed in code (`packages/core/src/tutorBrief.ts`): retry the
 * saved situation from memory, coach the saved correction, then change one
 * detail. The pack it produces names its source by id (`revisedFromPackId`,
 * attached by the token server only after an owner check). Nothing else links
 * the two, and nothing records whether the one-detail variation was attempted
 * or went well, so this reader never says so. That outcome is descoped until an
 * agent-side recap field exists.
 *
 * What can be put side by side is curated on both ends:
 *
 * - before: the source pack's first correction, which is exactly the one the
 *   revisit was briefed with (`revisionFromPack` sends `corrections[0]`), and
 *   the practice recorded on the source before the revisit pack was made,
 *   attributed by each target's own source so review in the same sitting never
 *   counts;
 * - after: how many corrections the revisit's own pack curated, whether the
 *   earlier one came up again (matched on `better`, ignoring case, accents
 *   and punctuation), and the revisit's own wins.
 *
 * A source no longer in the pack cache is not brought back from its history,
 * and a revisit that is not ready yet has no curated corrections, so both
 * answer null and the section is not drawn.
 */

import type { ConversationPack, ConversationPackCorrection } from '@luvani/core';

import { packTargetsOf, type PracticeHistoryItem } from '../practice/history.ts';
import type { ConversationEvidence } from '../myfrench/recentConversations.ts';

/** Only the outcomes of completed practice. A warm-up or a room opening is not practice. */
export type RevisionPractice = Extract<ConversationEvidence, 'recalled' | 'practised' | 'attempted'>;

export interface RevisionEvidence {
  source: ConversationPack;
  before: { correction: ConversationPackCorrection | null; practice: RevisionPractice | null };
  after: { corrections: number; earlierCorrectionRepeated: boolean; wins: string[] };
}

export const REVISION_COPY = {
  label: 'Before and after',
  process: 'Your tutor was asked to retry the situation, then change one detail.',
  earlier: 'From the earlier conversation',
  notRepeated: 'The earlier correction did not come up again in the revisit.',
  repeated: 'The earlier correction came up again in the revisit.',
} as const;

/**
 * What was practised on the source before the revisit, in the section's own
 * sentence. My French's lines are written for its list and read wrongly here.
 */
export const PRACTICE_BEFORE: Record<RevisionPractice, string> = {
  recalled: 'Before the revisit, you recalled phrases from it without choices.',
  practised: 'Before the revisit, you practised its phrases.',
  attempted: 'Before the revisit, you tried its phrases.',
};

/**
 * A correction's `better`, for comparison only: case and accents folded,
 * apostrophes of either kind and every other mark of punctuation taken out,
 * spaces collapsed. Folding accents errs toward "came up again", which claims
 * nothing the learner did, rather than a false "did not come up again".
 */
export function normaliseBetter(better: string): string {
  return better
    .normalize('NFKC')
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    // Ligatures are spelling, not accents: a re-curated line may write them out.
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The newest completed sitting on the source's own targets, before the revisit.
 * A revisit with no readable date has no "before", so nothing is claimed.
 */
function practiceBefore(sourceId: string, before: number, history: readonly PracticeHistoryItem[]): RevisionPractice | null {
  if (!Number.isFinite(before)) return null;
  let newest: { at: number; practice: RevisionPractice } | null = null;
  for (const event of history) {
    if (event.kind !== 'session-completed' || event.at >= before) continue;
    const own = packTargetsOf(event, sourceId);
    if (own.length === 0) continue;
    const practice: RevisionPractice = own.some((t) => t.outcome === 'recalled')
      ? 'recalled'
      : own.some((t) => t.outcome === 'practised')
        ? 'practised'
        : 'attempted';
    if (newest === null || event.at > newest.at) newest = { at: event.at, practice };
  }
  return newest?.practice ?? null;
}

export function revisionEvidence(
  pack: ConversationPack,
  packs: readonly ConversationPack[],
  history: readonly PracticeHistoryItem[],
): RevisionEvidence | null {
  const sourceId = pack.revisedFromPackId;
  if (sourceId === undefined || sourceId === null || pack.state !== 'ready') return null;
  const source = packs.find((candidate) => candidate.id === sourceId && candidate.id !== pack.id);
  if (source === undefined) return null;

  const correction = source.corrections[0] ?? null;
  const earlier = correction === null ? '' : normaliseBetter(correction.better);
  return {
    source,
    before: { correction, practice: practiceBefore(source.id, Date.parse(pack.createdAt), history) },
    after: {
      corrections: pack.corrections.length,
      earlierCorrectionRepeated: earlier !== '' && pack.corrections.some((c) => normaliseBetter(c.better) === earlier),
      wins: [...pack.wins],
    },
  };
}

/** The one sentence about the earlier correction, or null when there was none. */
export function correctionLine(evidence: RevisionEvidence): string | null {
  if (evidence.before.correction === null) return null;
  return evidence.after.earlierCorrectionRepeated ? REVISION_COPY.repeated : REVISION_COPY.notRepeated;
}
