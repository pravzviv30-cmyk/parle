/**
 * The drills a pack does not yet carry (F553).
 *
 * The server synthesises a translation pair for every key phrase and nothing
 * at all for the corrections, so the one line a learner most needed, the
 * better way to say what they said, had no drill behind it. This adds, per
 * pack, a translate and a repeat for the first correction and a repeat for the
 * first few key phrases, keyed by phrase so the bank's own merge identity
 * (phrase, kind, direction) folds them beside the server's and never over.
 *
 * A repeat carries its silent twin, the translate, so a learner who cannot
 * speak where they are sitting gets the same phrase asked another way rather
 * than a dead beat. Every exercise is run through core's validator before it
 * is offered, because a malformed one is a sitting that ends at once.
 */

import { phraseKeyOf, validateExercise, type ConversationPack, type DrillExercise, type RepeatThisExercise, type TranslationExercise } from '@luvani/core';

/** How many key phrases get a repeat. A sitting, not a syllabus. */
export const REPEATED_PHRASES = 3;

function translate(id: string, fr: string, en: string): TranslationExercise {
  return { id, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'translate', fr, en, direction: 'en-fr', accepted: [fr] };
}

function repeat(id: string, fr: string, en: string, twin: DrillExercise): RepeatThisExercise {
  return { id, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'repeat-this', reference: fr, referenceEn: en, ipa: null, noMicTwin: twin };
}

export function packExercisesFor(pack: ConversationPack): DrillExercise[] {
  const out: DrillExercise[] = [];
  const repair = pack.corrections[0];
  if (repair !== undefined) {
    const twin = translate(`pack:${pack.id}:repair:0:en-fr`, repair.better, repair.betterEn);
    out.push(twin, repeat(`pack:${pack.id}:repair:0:repeat`, repair.better, repair.betterEn, twin));
  }
  pack.keyPhrases.slice(0, REPEATED_PHRASES).forEach((phrase, index) => {
    const twin = translate(`pack:${pack.id}:repeat-twin:${index}`, phrase.fr, phrase.en);
    out.push(repeat(`pack:${pack.id}:repeat:${index}`, phrase.fr, phrase.en, twin));
  });
  return out.filter((exercise) => validateExercise(exercise).ok);
}

/** The key the replay card opens on: the better line's, so the drill finds it. */
export function repairKeyOf(pack: ConversationPack): string | null {
  const repair = pack.corrections[0];
  return repair === undefined ? null : phraseKeyOf(repair.better);
}
