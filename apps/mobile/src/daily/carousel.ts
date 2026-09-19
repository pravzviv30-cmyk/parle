import { WORD_SCENES, type WordSceneKey } from '../progress/wordScenes.ts';
export const DAILY_TABS = ['Word', 'Phrase'] as const;
export function horizontalSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.5;
}
export function swipedCard(index: number, dx: number, dy: number): number {
  return horizontalSwipe(dx, dy) && Math.abs(dx) >= 42 ? Math.max(0, Math.min(1, index + (dx < 0 ? 1 : -1))) : index;
}
/** Stable decorative art per item, not a claim that the picture translates it. */
export function sceneForDaily(id: string): WordSceneKey {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return WORD_SCENES[hash % WORD_SCENES.length]!;
}
