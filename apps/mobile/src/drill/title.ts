import type { DrillExercise } from '@luvani/core';

const TITLES: Record<DrillExercise['kind'], string> = {
  'fill-blank': 'Complete the line',
  'best-sentence': 'Choose the line',
  'appropriate-reply': 'Choose a reply',
  'repeat-this': 'Say the line',
  'tap-translate': 'Build the line',
  'listen-type': 'Hear and write',
  translate: 'Write it in French',
  'own-words': 'Make it yours',
};

export function drillTitle(kind: DrillExercise['kind']): string {
  return TITLES[kind];
}
