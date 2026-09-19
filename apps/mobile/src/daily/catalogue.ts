import { DAILY_WORDS, DAILY_PHRASES, dailyPick, wordsForLevel, wordTierFor } from '@luvani/core';
import { VOICED_WORD_IDS, VOICED_PHRASE_IDS } from './voicedSelection.ts';
export interface DailyItem { id: string; fr: string; en: string; label: string; note: string; exampleFr?: string; exampleEn?: string; }
export const DAILY_ITEMS: readonly DailyItem[] = [
  ...DAILY_WORDS.map(w => ({ ...w, label: 'Word of the day' })),
  ...DAILY_PHRASES.map(p => ({ ...p, label: 'Phrase of the day', note: p.situation })),
];
const byId = new Map(DAILY_ITEMS.map(item => [item.id, item]));
const voicedWords = new Set(VOICED_WORD_IDS), voicedPhrases = new Set(VOICED_PHRASE_IDS);
const homeWords = DAILY_WORDS.filter(item => voicedWords.has(item.id));
const homePhrases = DAILY_PHRASES.filter(item => voicedPhrases.has(item.id));
export function dailyItem(id: string): DailyItem | undefined { return byId.get(id); }
export function todayItems(level: number, now: number): { word: DailyItem; phrase: DailyItem } {
  const word = dailyPick(wordsForLevel(homeWords, level), now);
  const phrase = dailyPick(homePhrases.filter(p => p.tier === wordTierFor(level)), now);
  return { word: byId.get(word.id)!, phrase: byId.get(phrase.id)! };
}
