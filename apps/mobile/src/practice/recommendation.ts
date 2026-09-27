/**
 * The Practice tab's one recommended action, decided whole.
 *
 * Three answers and nothing else. An unfinished sitting on this phone is
 * resumed before anything new is offered, because a queue half answered is
 * the learner's own and starting another beside it would strand it. Otherwise
 * core's balanced selector chooses a short sitting from real material: a
 * little scheduled review and a little of the newest saved conversation that
 * can actually be drilled. When nothing at all is playable there is no primary
 * practice action, and the tab offers a real alternative instead of a button
 * that opens an empty sitting.
 *
 * This is a view model over `selectPracticeQueue`, not a second selector. Who
 * plays, how many, and where each target came from are core's decisions; this
 * file only turns saved conversations into the shape core reads and says which
 * conversation to name on the card. The name comes from the selection's own
 * `packId`, so a sitting made only of review never claims a conversation.
 *
 * Pure and clock-injected, so the tab can stay a layout.
 */

import {
  phraseKeyOf,
  selectPackQueue,
  selectPracticeQueue,
  type ConversationPack,
  type DrillExercise,
  type PracticePack,
  type PracticeSelection,
  type ReviewCard,
} from '@luvani/core';
import { orderedConversationPacks } from '../conversationPacks/model.ts';

/**
 * The phrase keys a saved conversation offers, in the order the pack offers
 * them: its key phrases, then the better line from each correction. The same
 * keys and the same order the recognition warm-up hands to recall, so the two
 * routes into one conversation practise the same material.
 */
export function practicePackOf(pack: ConversationPack): PracticePack {
  const keys = [...pack.keyPhrases.map((p) => phraseKeyOf(p.fr)), ...pack.corrections.map((c) => phraseKeyOf(c.better))];
  return { id: pack.id, phraseKeys: [...new Set(keys)] };
}

/** Saved conversations that can contribute practice, newest first. */
export function eligiblePacks(packs: readonly ConversationPack[]): ConversationPack[] {
  return orderedConversationPacks(packs).filter((pack) => pack.state === 'ready');
}

/**
 * What the resume record says, as far as this card needs it.
 *
 * Supplied by the practice data store. Only the facts the card shows: whether
 * something is waiting, which conversation it came from if any, and whether
 * it can still be played at all.
 */
export interface ResumableSummary {
  /** The saved conversation the sitting was started from, or null for a balanced or review sitting. */
  packId: string | null;
  /** Targets not yet answered. Zero means there is nothing left to resume. */
  remaining: number;
}

export type Recommendation =
  | {
      kind: 'resume';
      /** The conversation to name, when the sitting came from one that still exists here. */
      source: ConversationPack | null;
    }
  | {
      kind: 'start';
      selection: PracticeSelection;
      /** The conversation that contributed at least one target, or null when only review did. */
      source: ConversationPack | null;
    }
  | {
      kind: 'none';
      /**
       * The honest alternative. 'first' for a learner with no saved
       * conversation, 'talk' for one whose conversations left nothing playable
       * and whose deck is quiet.
       */
      fallback: 'first' | 'talk';
    };

export function recommendation(input: {
  resumable: ResumableSummary | null;
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  packs: readonly ConversationPack[];
  now: number;
}): Recommendation {
  const { resumable, deck, bank, packs, now } = input;
  const eligible = eligiblePacks(packs);
  const byId = new Map(eligible.map((pack) => [pack.id, pack]));

  if (resumable !== null && resumable.remaining > 0) {
    return { kind: 'resume', source: resumable.packId === null ? null : byId.get(resumable.packId) ?? null };
  }

  const selection = selectPracticeQueue({ deck, bank, packs: eligible.map(practicePackOf), now });
  if (selection.targets.length > 0) {
    return { kind: 'start', selection, source: selection.packId === null ? null : byId.get(selection.packId) ?? null };
  }

  return { kind: 'none', fallback: packs.length === 0 ? 'first' : 'talk' };
}

/**
 * Practise one saved conversation now, due or not.
 *
 * Null when the pack is not here, not ready, or has nothing the bank can
 * drill, so a caller can say so rather than open an empty sitting.
 */
export function packSelection(input: {
  packId: string;
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  packs: readonly ConversationPack[];
  now: number;
}): PracticeSelection | null {
  const pack = eligiblePacks(input.packs).find((p) => p.id === input.packId);
  if (pack === undefined) return null;
  const selection = selectPackQueue(practicePackOf(pack), input.deck, input.bank, input.now);
  return selection.targets.length > 0 ? selection : null;
}
