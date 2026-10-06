/**
 * The facts the game layer reads from stores it does not own: the daily goal,
 * the deck, the scenes and the sound checks (Come alive, Phase 1).
 *
 * Read-only, and forgiving on purpose. Each of these feeds a quest or a badge,
 * and a store that cannot be read counts as nothing, which can only hold a
 * quest or a badge back, never award one. The streak, the XP and the game's own
 * facts are read strictly by `game/settle.ts`, because those are the numbers a
 * learner is shown.
 */

import {
  isDailyGoalMinutes,
  missionStates,
  spineFrom,
  isEarned,
  localDayKey,
  type DayKey,
  type ReviewCard,
} from '@luvani/core';

import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { loadProfile } from '../profile/store.ts';
import { loadDeck } from '../review/store.ts';
import { loadSoundChecks } from '../soundcheck/store.ts';
import { NO_OUTSIDE_FACTS, type OutsideFacts } from './view.ts';

const isPhraseCard = (card: ReviewCard): boolean => card.kind !== 'phoneme';

async function orElse<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

/** What the other stores hold today, each a count of persisted practice. */
export async function readOutsideFacts(today: DayKey, now: number, dayOf: (at: number) => DayKey = localDayKey): Promise<OutsideFacts> {
  const [profile, deck, completions, checks] = await Promise.all([
    orElse(() => loadProfile(), null),
    orElse(() => loadDeck(), [] as ReviewCard[]),
    orElse(() => loadMissionCompletions(), []),
    orElse(() => loadSoundChecks(), []),
  ]);
  const phrases = deck.filter(isPhraseCard);
  const goal = profile?.dailyGoalMin ?? null;
  const missions = missionCompletionsFrom(completions);
  const progress = missionStates(missions, deck, now);
  return {
    ...NO_OUTSIDE_FACTS,
    goalTarget: isDailyGoalMinutes(goal) ? goal : null,
    phraseCards: phrases.length,
    newPhrasesToday: phrases.filter((card) => dayOf(card.addedAt) === today).length,
    recalls: phrases.reduce((sum, card) => sum + Math.max(0, card.reps - 1), 0),
    scenesOnOwn: progress.filter(isEarned).length,
    // A finish on the top rung is a scene done with nothing handed over.
    scenesOnOwnToday: missions.filter((done) => done.rung === 4 && dayOf(done.at) === today).length,
    allA0ScenesEarned: spineFrom(progress).level === 'A1',
    soundChecks: checks.length,
    soundChecksToday: checks.filter((check) => dayOf(check.at) === today).length,
  };
}
