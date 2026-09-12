/**
 * The words on the tutor memory card and screen (F562), in a module plain
 * node can load. Every line a learner reads here is spelled once, here, and
 * the copy sweeps read these constants rather than the JSX.
 */

import type { RememberedFact } from '@luvani/brain/profile';

import { visibleFacts } from './memory.ts';
import type { StoredProfile } from './store.ts';

/** "<Name> remembers", the card's heading and the screen's title. */
export function memoryLabel(tutorName: string): string {
  return `${tutorName} remembers`;
}

export const MEMORY_ROW = 'See what your tutor remembers';
export const MEMORY_ROW_SUB = 'Forget any of it, or add a goal.';

/** What each kind of fact is, in the learner's language. */
export const KIND_GLOSS: Record<RememberedFact['kind'], string> = {
  interest: 'Something you like',
  'life-event': 'Something in your life',
  goal: 'Something you want',
  preference: 'How you like things',
};

export const FORGET_ONE = 'Forget this';
export const FORGET_ALL = 'Forget everything';
export const NOTHING_YET = 'Nothing yet. What you mention about your life in a conversation lands here.';
export const GOALS_LABEL = 'What you want from French';
export const GOALS_SUB = 'Up to three lines, in your own words. Your tutor keeps them in mind.';
export const GOAL_PLACEHOLDER = 'Order at a bakery without switching to English';
export const ADD_GOAL = 'Add this goal';
export const REMOVE_GOAL = 'Remove';
/** One plain sentence on what leaves the phone. Names the slice the agent sends. */
export const WHAT_LEAVES = 'The last few of these ride into each new conversation, so your tutor can bring them up. Nothing else about you does.';

/** Every line the card and the screen spell themselves, for the copy sweeps. */
export const TUTOR_MEMORY_COPY: readonly string[] = [
  MEMORY_ROW, MEMORY_ROW_SUB, ...Object.values(KIND_GLOSS), FORGET_ONE, FORGET_ALL, NOTHING_YET,
  GOALS_LABEL, GOALS_SUB, GOAL_PLACEHOLDER, ADD_GOAL, REMOVE_GOAL, WHAT_LEAVES,
];

/**
 * One line on the card saying how much the tutor holds, in words. Never a
 * count: "remembers 7 things" is a score, and a score can go down.
 */
export function memorySummary(profile: StoredProfile, tutorName: string): string {
  const facts = visibleFacts(profile).length;
  const goals = profile.learnerGoals.length;
  const held =
    facts === 0
      ? `${tutorName} is still getting to know you.`
      : facts === 1
        ? `${tutorName} remembers one thing about you.`
        : facts <= 4
          ? `${tutorName} remembers a few things about you.`
          : `${tutorName} remembers quite a lot about you.`;
  if (goals === 0) return held;
  return `${held} ${goals === 1 ? 'And the goal you wrote.' : 'And the goals you wrote.'}`;
}
