/**
 * Word export, for Anki and spreadsheets.
 *
 * Issen users asked for exactly this on Hacker News and never got it. The learner's
 * words belong to the learner. One tap gives them a file their existing flashcard
 * routine can eat.
 *
 * Anki's importer reads tab-separated text, one note per line, front then back.
 * CSV gets a UTF-8 BOM so Excel opens the accents correctly instead of mangling
 * café into cafÃ©.
 */

import type { Lesson } from '../lessons/types.ts';
import { normalise } from '../lessons/types.ts';
import { DRILLS } from '../phonemes/drills.ts';

export interface ExportEntry {
  word: string;
  /** The phrase the learner said it in, with its meaning. Honest context. */
  gloss: string;
  ipa: string;
}

/**
 * Match each learner word to the phrase it was learned in.
 *
 * We do not own a French dictionary, so we do not pretend to. A word's card shows
 * the whole line it came from and what that line means. That is how phrase decks
 * work, and it beats pinning a sentence translation on a single word.
 *
 * IPA is only attached when we know it for the exact word: single-word lines, and
 * the drill bank, where every word carries its own transcription. Wrong IPA on a
 * flashcard is worse than none.
 */
export function buildEntries(words: readonly string[], lessons: readonly Lesson[]): ExportEntry[] {
  const phrases = new Map<string, string>();
  const ipaByWord = new Map<string, string>();

  for (const drill of DRILLS) {
    for (const item of drill.items ?? []) {
      const key = normalise(item.word);
      if (!key.includes(' ') && !ipaByWord.has(key)) ipaByWord.set(key, item.ipa);
    }
    for (const pair of drill.pairs ?? []) {
      for (const side of [pair.a, pair.b]) {
        const key = normalise(side.word);
        if (!ipaByWord.has(key)) ipaByWord.set(key, side.ipa);
      }
    }
  }

  for (const lesson of lessons) {
    for (const turn of lesson.turns) {
      const lineWords = normalise(turn.target).split(' ');
      const phrase = `${turn.target} = ${turn.targetEn}`;
      for (const w of lineWords) if (!phrases.has(w)) phrases.set(w, phrase);
      if (lineWords.length === 1 && !ipaByWord.has(lineWords[0]!)) {
        ipaByWord.set(lineWords[0]!, turn.targetIpa);
      }
      for (const o of turn.options) {
        for (const w of normalise(o.text).split(' ')) {
          if (!phrases.has(w)) phrases.set(w, `${o.text} = ${o.en}`);
        }
      }
    }
  }

  return words.map((word) => {
    const key = normalise(word);
    return { word, gloss: phrases.get(key) ?? '', ipa: ipaByWord.get(key) ?? '' };
  });
}

function csvField(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a UTF-8 BOM so Excel renders the accents. */
export function toCsv(entries: readonly ExportEntry[]): string {
  const rows = ['word,meaning,pronunciation', ...entries.map((e) => [e.word, e.gloss, e.ipa].map(csvField).join(','))];
  return '﻿' + rows.join('\n') + '\n';
}

/** Tab-separated, front tab back, the shape Anki imports without any settings. */
export function toAnkiTsv(entries: readonly ExportEntry[]): string {
  return entries.map((e) => `${e.word}\t${e.gloss}${e.ipa ? ` /${e.ipa}/` : ''}`).join('\n') + '\n';
}
