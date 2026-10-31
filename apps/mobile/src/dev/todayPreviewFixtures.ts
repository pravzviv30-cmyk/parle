/**
 * The Today preview's keys and fixtures (UI-015, `?preview=today-*`), as plain
 * data so the routing and the fixed learner are tested without a renderer.
 *
 * The game view is folded by the real `gameViewFrom` from fixed records, so
 * the tiles, the nudge and the three are what a phone would draw from them:
 * a three-day run, 4 of 10 minutes, one of today's three done. Nothing here
 * reads storage, an account or the clock.
 */

import { emptyGame } from '../game/model.ts';
import { NO_OUTSIDE_FACTS, gameViewFrom, type GameFacts, type GameView } from '../game/view.ts';
import { statTileView, todayHeroView, type StatTileView, type TodayHeroView } from '../game/todayHeroView.ts';
import { questsCardView, type QuestsCardView } from '../game/questsCardView.ts';
import { homeNudge } from '../home/nudge.ts';
import { homeGreeting } from '../home/greeting.ts';
import type { ComingUpCardView } from '../today/TodayParts.tsx';
import type { GuestPractice } from '../onboarding/guestModel.ts';
import { freshPreAccountDraft } from '../onboarding/preAccountDraft.ts';

export const TODAY_PREVIEW_STATES = ['scene', 'fix', 'plans', 'starter', 'offline', 'tutor-unreachable', 'explore', 'loading', 'failed', 'evening', 'night'] as const;
export type TodayPreviewState = typeof TODAY_PREVIEW_STATES[number];

/** The preview keys, in the order the list shows them. */
export const TODAY_PREVIEW_KEYS = TODAY_PREVIEW_STATES.map((state) => `today-${state}` as const);
export type TodayPreviewKey = typeof TODAY_PREVIEW_KEYS[number];

export const TODAY_PREVIEW_LABELS: Record<TodayPreviewKey, string> = {
  'today-scene': 'Today, next scene',
  'today-fix': 'Today, one fix to try',
  'today-plans': 'Today, out of speaking time',
  'today-starter': 'Today, starter line',
  'today-offline': 'Today, offline',
  'today-tutor-unreachable': 'Today, tutor unreachable',
  'today-explore': 'Today, no next scene yet',
  'today-loading': 'Today, loading',
  'today-failed': 'Today, could not load',
  'today-evening': 'Today, evening sky',
  'today-night': 'Today, night sky',
};

/** The Today state a preview key names, or null for every other key. */
export function todayPreviewState(key: string): TodayPreviewState | null {
  const state = key.startsWith('today-') ? key.slice('today-'.length) : null;
  return TODAY_PREVIEW_STATES.find((value) => value === state) ?? null;
}

/** The hour the sky is drawn at: 9 by default, 20 for the evening, 23 for the night. */
export function todayPreviewHour(state: TodayPreviewState): number {
  return state === 'evening' ? 20 : state === 'night' ? 23 : 9;
}

/** The evening and night skies keep the scene as their hero. */
export function todayPreviewHero(state: TodayPreviewState): Exclude<TodayPreviewState, 'evening' | 'night'> {
  return state === 'evening' || state === 'night' ? 'scene' : state;
}

/** One fixed local day, so the greeting word matches the hour drawn. */
const DAY = '2026-10-07';
export const todayPreviewNow = (hour: number): number => new Date(2026, 9, 7, hour).getTime();

/** The greeting for the fixed learner, Léa, at that hour. */
export const todayPreviewGreeting = (hour: number) => homeGreeting('Léa', todayPreviewNow(hour));

/**
 * The fixed learner's records. `open` leaves today unpractised (the run still
 * three days, the nudge shown); otherwise today is lit.
 */
export function todayPreviewFacts(open: boolean): GameFacts {
  const at = (hour: number) => todayPreviewNow(hour);
  return {
    activity: open ? [{ at: at(8) - 86_400_000, kind: 'drill', xp: 60, activeMs: 240_000 }] : [{ at: at(8), kind: 'drill', xp: 60, activeMs: 240_000 }],
    practiceDays: open ? ['2026-10-04', '2026-10-05', '2026-10-06'] : ['2026-10-05', '2026-10-06', DAY],
    game: {
      ...emptyGame(),
      questDays: [{ day: DAY, ids: ['finish-practice', 'practise-twice', 'practice-set'], at: at(7) }],
      claims: open ? [] : [{ day: DAY, questId: 'finish-practice', xp: 10, at: at(8) }],
    },
    outside: { ...NO_OUTSIDE_FACTS, goalTarget: 10 },
    billing: null,
  };
}

export interface TodayPreviewGame {
  hero: TodayHeroView;
  tiles: StatTileView;
  nudge: string | null;
  three: QuestsCardView;
}

/** The tiles, the nudge and the three, folded by the game layer's own rules. */
export function todayPreviewGame(open: boolean): TodayPreviewGame {
  const view: GameView = gameViewFrom(todayPreviewFacts(open), DAY);
  const hero = todayHeroView({ streak: view.streak, goal: view.goal, level: view.level, xp: view.xp });
  const three = questsCardView(view.quests, { tutorName: 'Émilie', goalTarget: 10 });
  if (hero === null || three === null) throw new Error('the Today preview fixture no longer folds to a hero and a three');
  return { hero, tiles: statTileView(hero), nudge: homeNudge(view.streak), three };
}

/** The nudge is shown on the evening sky, while the run waits on today. */
export const todayPreviewOpen = (state: TodayPreviewState): boolean => state === 'evening';

export const TODAY_PREVIEW_SCENE = {
  eyebrow: 'Next scene, 2 of 3',
  title: 'Order at a café',
  time: 'About 3 minutes',
  /** As `sceneRowLine` joins them. */
  rowLine: 'Next scene, 2 of 3. About 3 minutes',
} as const;

export const TODAY_PREVIEW_FIX = {
  english: 'I would like a coffee, please.',
  after: "Your line from Friday and Émilie's version show after you try",
  locked: false,
} as const;

export const TODAY_PREVIEW_PHRASE = { fr: 'Je voudrais un café, s’il vous plaît.', en: 'I would like a coffee, please.' } as const;
export const TODAY_PREVIEW_REVIEW = { title: 'Review 4 phrases', line: 'About 2 minutes' } as const;
export const TODAY_PREVIEW_COMING_UP: ComingUpCardView = { title: 'Your trip to Lyon', when: 'Émilie remembers it is on Saturday', locked: false, feature: 'realMoment' };
export const TODAY_PREVIEW_WEEK = 'This week you spoke French for 18 minutes and kept 6 new phrases.';

/** A starter line the learner has not answered yet. */
export function todayPreviewStarter(): GuestPractice {
  return { version: 2, token: null, id: null, expiresAt: 0, secondsUsed: 0, attempts: [], kept: false, completed: false, plan: { ...freshPreAccountDraft(), eligibilityConfirmed: true, reason: 'trip', minutes: 10 } };
}
