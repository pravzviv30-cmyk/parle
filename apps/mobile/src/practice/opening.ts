/**
 * What a practice screen opens on: the sitting already under way on this
 * phone, a fresh one chosen now, or an honest "this cannot resume".
 *
 * Pure: the screen reads the stores and hands them here. The rules:
 *
 * - A `resume` link resumes the one saved sitting, whatever it was. With none
 *   saved, or one whose exercises are all gone and nothing answered, it cannot
 *   resume, and the screen says so rather than inventing its content.
 * - A `recommended` or `pack` link resumes the saved sitting when it is the
 *   same kind of sitting (and, for a pack, the same conversation). That is what
 *   makes a web reload come back to the same queue, the same position and the
 *   same answers instead of dealing a new sitting.
 * - Otherwise it is fresh, chosen by the same selector the Practice card used.
 *
 * A resumed sitting keeps its own sitting id, targets and warm-up flag from the
 * record, never from the link, so a reload cannot turn a warm-up sitting into
 * one that claims unaided recall.
 *
 * A deleted conversation is never brought back by resume. Deleting a saved
 * conversation leaves its exercises in the bank (earned learning stays), so the
 * bank alone cannot tell. Before a record is restored, every target attributed
 * to a conversation that is no longer in the pack cache is dropped, with its
 * queue entries and any answers to it: nothing about it is completed or
 * credited, and its source link is gone. Review targets are untouched, since
 * they belong to the learner's deck and not to any conversation. If nothing is
 * left to play or finish, the sitting cannot resume, and is cleared and said.
 */

import type { ConversationPack, DrillExercise, PracticeTarget, ReviewCard } from '@luvani/core';

import type { PracticeRoute } from './practiceRoute.ts';
import { packSelection, recommendation } from './recommendation.ts';
import { restorePracticeSession, type PracticeSessionRecord, type RestoredPracticeSession } from './sessionStore.ts';

export type PracticeOpening =
  | {
      kind: 'resume';
      record: PracticeSessionRecord;
      restored: RestoredPracticeSession;
      /** Exercises already answered before the reload, so their outcomes can still be read. */
      answeredExercises: DrillExercise[];
    }
  | { kind: 'fresh'; targets: PracticeTarget[] }
  | {
      kind: 'cannot-resume';
      /** The saved sitting to clear, when there was one. */
      sittingId: string | null;
    };

/** An exercise by id, including a repeat-this's silent twin, as the session store finds it. */
function findExercise(bank: readonly DrillExercise[], id: string): DrillExercise | null {
  for (const exercise of bank) {
    if (exercise.id === id) return exercise;
    if (exercise.kind === 'repeat-this' && exercise.noMicTwin.id === id) return exercise.noMicTwin;
  }
  return null;
}

/**
 * The record with every target from a conversation no longer in the pack cache
 * removed, and with it the queue entries and answers for those phrases. Pure.
 * `removed` says whether anything was dropped, so the caller can report it.
 */
export function withoutDeletedSources(
  record: PracticeSessionRecord,
  packs: readonly Pick<ConversationPack, 'id'>[],
  bank: readonly DrillExercise[],
): { record: PracticeSessionRecord; removed: boolean } {
  const live = new Set(packs.map((p) => p.id));
  const gone = new Set(
    record.targets.filter((t) => t.source.kind === 'pack' && !live.has(t.source.packId)).map((t) => t.phraseKey),
  );
  if (gone.size === 0) return { record, removed: false };
  const phraseOf = (id: string): string | null => findExercise(bank, id)?.phraseKey ?? null;
  const packStillLive = record.packId !== null && live.has(record.packId);
  return {
    removed: true,
    record: {
      ...record,
      packId: packStillLive ? record.packId : null,
      targets: record.targets.filter((t) => !gone.has(t.phraseKey)),
      queue: record.queue.filter((id) => {
        const phrase = phraseOf(id);
        return phrase === null || !gone.has(phrase);
      }),
      answered: record.answered.filter((a) => !gone.has(a.phraseKey)),
      missesById: Object.fromEntries(
        Object.entries(record.missesById).filter(([id]) => {
          const phrase = phraseOf(id);
          return phrase === null || !gone.has(phrase);
        }),
      ),
      assisted: record.assisted.filter((id) => {
        const phrase = phraseOf(id);
        return phrase === null || !gone.has(phrase);
      }),
    },
  };
}

function resumeFrom(
  saved: PracticeSessionRecord,
  bank: readonly DrillExercise[],
  deck: readonly ReviewCard[],
  packs: readonly ConversationPack[],
  now: number,
): PracticeOpening | null {
  const { record } = withoutDeletedSources(saved, packs, bank);
  if (record.targets.length === 0) return null;
  const restored = restorePracticeSession(record, bank, deck, now);
  if (restored === null) return null;
  const answeredExercises = record.answered.flatMap((a) => {
    const found = findExercise(bank, a.id);
    return found === null ? [] : [found];
  });
  return { kind: 'resume', record, restored, answeredExercises };
}

export function practiceOpening(input: {
  route: PracticeRoute;
  record: PracticeSessionRecord | null;
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  packs: readonly ConversationPack[];
  now: number;
}): PracticeOpening {
  const { route, record, deck, bank, packs, now } = input;

  if (route.origin === 'resume') {
    if (record === null) return { kind: 'cannot-resume', sittingId: null };
    return resumeFrom(record, bank, deck, packs, now) ?? { kind: 'cannot-resume', sittingId: record.sittingId };
  }

  const sameSitting =
    record !== null && record.origin === route.origin && (route.origin !== 'pack' || record.packId === route.packId);
  if (sameSitting) {
    const resumed = resumeFrom(record, bank, deck, packs, now);
    if (resumed !== null) return resumed;
  }

  if (route.origin === 'pack') {
    const selection = route.packId === null ? null : packSelection({ packId: route.packId, deck, bank, packs, now });
    return { kind: 'fresh', targets: selection?.targets ?? [] };
  }
  const rec = recommendation({ resumable: null, deck, bank, packs, now });
  return { kind: 'fresh', targets: rec.kind === 'start' ? rec.selection.targets : [] };
}

/**
 * What the Practice card needs from the saved sitting: whether there is one to
 * resume, and which conversation it came from. A sitting whose queue is empty
 * but has answered work is still worth resuming: opening it finishes it.
 */
export function resumableOf(
  saved: PracticeSessionRecord | null,
  packs: readonly Pick<ConversationPack, 'id'>[],
  bank: readonly DrillExercise[],
): { packId: string | null; remaining: number } | null {
  if (saved === null) return null;
  // The same reconciliation resume will apply, so the card never offers to
  // resume a sitting that was only about a conversation since deleted.
  const { record } = withoutDeletedSources(saved, packs, bank);
  if (record.targets.length === 0) return null;
  if (record.queue.length === 0 && record.answered.length === 0) return null;
  return { packId: record.packId, remaining: Math.max(1, record.queue.length) };
}
