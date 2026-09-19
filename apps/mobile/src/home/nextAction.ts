import type { HomeMission } from './homeMission.ts';
export function homeActionFor(hero: Pick<HomeMission, 'kind'>, dueCount: number): 'conversation' | 'review' {
  return hero.kind === 'today' && dueCount > 0 ? 'review' : 'conversation';
}
