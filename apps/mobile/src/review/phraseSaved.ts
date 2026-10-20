/**
 * Keep a phrase in the learner's phrasebook, and say so only once the disk
 * has it (README Part 5.E, "Phrase saved anywhere (durable ack only)").
 *
 * The review deck is the phrasebook (`phrases/PhrasebookScreen.tsx` reads it),
 * and `addPhrases` answers `durable` only when its write landed. Only then is
 * the phrase called saved: the caller fills its bookmark and the celebration
 * host is handed one `phrase-saved` moment, keyed by the phrase's own key
 * (`celebrationKey.saved`), which it draws as the small toast with `save` and
 * `arrived()`. A refused write, or one that threw, says nothing and leaves the
 * way to keep it again.
 *
 * The moment carries the phrase key and never the learner's words. Origin is
 * `account`: every caller of this runs inside a signed-in app.
 */

import { phraseKeyOf, type ConvoPhrase, type ReviewSource } from '@luvani/core';

import { celebrationKey, publishCelebrations } from '../celebrate/events.ts';
import type { PersistAck } from '../storage/ack.ts';
import { addPhrases } from './store.ts';

/** Hand the host the saved moment for a phrase, only on a durable acknowledgement. True when it did. */
export function announcePhraseSaved(ack: PersistAck, fr: string, at: number = Date.now()): boolean {
  if (ack !== 'durable' || fr.trim() === '') return false;
  const phraseKey = phraseKeyOf(fr);
  publishCelebrations([{ type: 'phrase-saved', key: celebrationKey.saved(phraseKey), origin: 'account', at, data: { phraseKey } }]);
  return true;
}

/**
 * Keep one phrase and answer whether it is saved. Saved means durable, and only
 * a saved phrase is announced.
 */
export async function keepPhrase(
  phrase: ConvoPhrase,
  source: ReviewSource,
  write: (phrases: readonly ConvoPhrase[], opts: { source: ReviewSource }) => Promise<PersistAck> = addPhrases,
): Promise<boolean> {
  let ack: PersistAck;
  try {
    ack = await write([phrase], { source });
  } catch {
    ack = 'failed';
  }
  return announcePhraseSaved(ack, phrase.fr);
}
