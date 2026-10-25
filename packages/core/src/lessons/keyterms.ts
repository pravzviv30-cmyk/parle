import { recognitionPhrases } from '../speech/recognitionRepair.ts';
import type { Lesson } from './types.ts';

/**
 * One fixed Deepgram keyterm list for a scripted session (VOICE-017), set once
 * when the recogniser is built: every keyterm change reopens the socket, and
 * under the paid proxy each reopening books a full session of audio.
 *
 * Targets come first because recognitionPhrases reads only the first 12 lines,
 * so each target's full line is placed first, then recognitionPhrases' short
 * forms, then acceptable options, so the lines learners aim for win any cut.
 * A trailing question mark is stripped here, since recognitionPhrases drops any
 * line containing one and would lose the café's three questions. `accepts` is
 * left out: it is lowercase and unaccented, and would bias recognition toward
 * the misspellings it exists to forgive. Caps match recognitionPhrases (16 phrases, 400 bytes),
 * which the paid proxy mirrors; duplicates by accent- and case-free words drop.
 */
export function lessonKeyterms(lesson: Lesson): string[] {
  const unquestion = (line: string) => line.replace(/\s*\?\s*$/, '');
  const targets = lesson.turns.map(turn => unquestion(turn.target));
  const options = lesson.turns.flatMap(turn => turn.options.filter(option => option.acceptable).map(option => unquestion(option.text)));
  // Every target's full line takes a slot before any short form or option:
  // recognitionPhrases alone would let "Un café" and friends crowd out the last turn.
  const ordered = [
    ...targets.flatMap(line => recognitionPhrases([line]).slice(0, 1)),
    ...recognitionPhrases(targets),
    ...recognitionPhrases(options),
  ];
  const seen = new Set<string>(), result: string[] = [];
  let bytes = 0;
  for (const phrase of ordered) {
    const key = phrase.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const length = new TextEncoder().encode(phrase).length;
    if (!key || seen.has(key) || result.length >= 16 || bytes + length > 400) continue;
    seen.add(key); result.push(phrase); bytes += length;
  }
  return result;
}
