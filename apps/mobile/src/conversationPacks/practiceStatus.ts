/**
 * Whether a conversation's practice is still being made, made, or did not
 * come together.
 *
 * The server sends `practiceStatus` per pack on `GET /conversation-packs`.
 * An older server sends nothing, which has always meant ready. A pack whose
 * own `state` is 'generating' is read as preparing too, so the older signal
 * keeps working if a server ever writes it.
 *
 * What a learner can do is decided by what exists, not by the status: the
 * built-in exercises (`packExercisesFor`) are made on the phone from a ready
 * pack's phrases and corrections, so a pack still preparing or one whose
 * generated practice failed can still be practised when it has those. The
 * status only adds a note. No retry is offered: the server worker owns that.
 */

import type { ConversationPack } from '@luvani/core';

export type PracticeStatus = 'preparing' | 'ready' | 'failed';

export const PRACTICE_STATUS_COPY = {
  preparingList: 'Becoming practice',
  preparingPending: 'Your conversation is becoming practice.',
  preparingNote: 'More practice is on its way.',
  failedList: 'Its phrases are ready to review',
  failedEmptyList: 'Practice didn’t come together',
  failedNote: 'Practice for this one didn’t come together. Its phrases are ready to review.',
  failedEmptyNote: 'Practice for this one didn’t come together. Your saved phrases remain available in Progress.',
} as const;

export function practiceStatusOf(pack: ConversationPack): PracticeStatus {
  if (pack.state === 'generating') return 'preparing';
  const raw = (pack as { practiceStatus?: unknown }).practiceStatus;
  return raw === 'preparing' || raw === 'failed' ? raw : 'ready';
}

/** The learner can practise this pack now, with what the phone can build. */
export function hasPackPractice(pack: ConversationPack): boolean {
  return pack.state === 'ready' && (pack.keyPhrases.length > 0 || pack.corrections.length > 0);
}

export interface PackPracticeView {
  status: PracticeStatus;
  /** The footer "Practise this conversation" is drawn. */
  offersPractice: boolean;
  /** A short line under the practice, or null. */
  note: string | null;
  /** The pending card's headline when nothing can be practised yet, or null. */
  pending: string | null;
  /** The list row's status words, or null to keep the row's ordinary count. */
  listLine: string | null;
}

export function packPracticeView(pack: ConversationPack): PackPracticeView {
  const status = practiceStatusOf(pack);
  const offersPractice = hasPackPractice(pack);
  if (status === 'preparing') {
    return {
      status,
      offersPractice,
      note: offersPractice ? PRACTICE_STATUS_COPY.preparingNote : null,
      pending: offersPractice ? null : PRACTICE_STATUS_COPY.preparingPending,
      listLine: PRACTICE_STATUS_COPY.preparingList,
    };
  }
  if (status === 'failed') {
    const phrases = pack.state === 'ready' && pack.keyPhrases.length > 0;
    return {
      status,
      offersPractice,
      note: phrases ? PRACTICE_STATUS_COPY.failedNote : PRACTICE_STATUS_COPY.failedEmptyNote,
      pending: null,
      listLine: phrases ? PRACTICE_STATUS_COPY.failedList : PRACTICE_STATUS_COPY.failedEmptyList,
    };
  }
  return { status, offersPractice, note: null, pending: null, listLine: null };
}
