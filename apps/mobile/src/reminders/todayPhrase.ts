/**
 * Today's phrase, the one Home shows, for a reminder that promises it.
 *
 * "Today's phrase is ready" opens this phrase and no other: the daily pool
 * pitched at the learner's content standing, picked for today, exactly as
 * `tabs/HomeTab.tsx` picks it (`todayItems(levelFor(totalXp(activity)).index,
 * now)`). The standing is read for its index alone, the one use game.md 2.5
 * allows; no number from it is shown.
 *
 * The activity arrives through the game layer's own read, so this module, like
 * the planner, reaches practice only through `game/` (`reminder.test.ts`).
 * Unreadable, it answers the beginner pool's phrase, which is what Home shows
 * before its own read lands.
 */

import { levelFor, totalXp } from '@luvani/core';

import { todayItems } from '../daily/catalogue.ts';
import { readGameFacts } from '../game/settle.ts';
import { NO_OUTSIDE_FACTS } from '../game/view.ts';

export async function todayPhraseId(now: number): Promise<string> {
  try {
    const facts = await readGameFacts(NO_OUTSIDE_FACTS, null);
    return todayItems(levelFor(totalXp(facts.activity)).index, now).phrase.id;
  } catch {
    return todayItems(0, now).phrase.id;
  }
}
