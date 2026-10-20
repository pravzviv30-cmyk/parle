/**
 * Persist the one phrase the recap presents as the learner's keepsake.
 *
 * This is an acknowledged exact write, not a replacement for the conversation
 * outbox. The full recap remains in the session journal until the ordinary
 * curated practice batch banks successfully, so a failed keepsake write is
 * both reported truthfully by the recap and still recoverable after a restart.
 */

import { addPhrases } from '../review/store.ts';

export interface RecapKeepsake {
  readonly fr: string;
  readonly en: string;
}

export async function saveRecapKeepsake(phrase: RecapKeepsake): Promise<boolean> {
  const acknowledged = await addPhrases([
    {
      fr: phrase.fr,
      frWritten: null,
      en: phrase.en,
      enLiteral: null,
      register: 'courant',
      note: null,
    },
  ], { source: 'conversation' });
  return acknowledged === 'durable';
}
