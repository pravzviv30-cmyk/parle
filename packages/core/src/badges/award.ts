/**
 * Which badges to award now.
 *
 * Only ids not already awarded come back, each once, so asking twice (two
 * devices, a retry, a replay after a crash) can never award one twice. The
 * app saves an award for good the first time, which is what keeps a badge
 * once the history that earned it has been pruned.
 */

import { MONTHLY_QUEST_TARGET } from '../quests/catalogue.ts';
import { BADGES, monthlyQuestBadgeId, type BadgeFacts } from './catalogue.ts';

export function newBadges(facts: BadgeFacts, awarded: Iterable<string>): string[] {
  const held = new Set(awarded);
  const out: string[] = [];
  const add = (id: string) => {
    if (!held.has(id)) {
      held.add(id);
      out.push(id);
    }
  };
  for (const badge of BADGES) if (badge.earned(facts)) add(badge.id);
  const months = [...facts.questMonths].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  for (const { month, count } of months) {
    const id = monthlyQuestBadgeId(month);
    if (id !== null && Number.isFinite(count) && count >= MONTHLY_QUEST_TARGET) add(id);
  }
  return out;
}
