import { DAILY_SCENARIOS } from './scenarios.ts';

export interface DailyPhrase {
  id: string;
  fr: string;
  en: string;
  tier: 1 | 2 | 3;
  situation: string;
  scenarioId: string;
}

const seen = new Set<string>();
// Round-robin across situations before second/third lines: all ten themes
// remain represented instead of filling the pack with the first category.
const authored = [0, 1, 2].flatMap(index => DAILY_SCENARIOS.flatMap(scene => {
  const line = scene.lines[index];
  if (!line) return [];
  const key = line.fr.normalize('NFC').toLocaleLowerCase('fr').replace(/[.!?]+$/g, '').trim();
  if (seen.has(key)) return [];
  seen.add(key);
  return [{ id: `phrase:${scene.id}:${index}`, ...line, tier: scene.tier, situation: scene.titleEn, scenarioId: scene.id }];
}));

/** One thousand distinct bilingual lines from the authored situation library. */
export const DAILY_PHRASES: readonly DailyPhrase[] = authored.slice(0, 1000);
