/**
 * The words on the tutor memory card and screen (F562), in a module plain
 * node can load. Every line a learner reads here is spelled once, here, and
 * the copy sweeps read these constants rather than the JSX.
 */

import { memoryPaused, type RememberedFact } from '@luvani/brain/profile';

import { visibleFacts } from './memory.ts';
import type { StoredProfile } from './store.ts';

/** "<Name> remembers", the card's heading and the screen's title. */
export function memoryLabel(tutorName: string): string {
  return `${tutorName} remembers`;
}

/**
 * Under the tutor's own name on Profile's first row.
 *
 * The row opens the voice sheet, so the line says what the voice IS rather
 * than offering to change it: a learner who has never thought about which
 * voice they have still learns from it who they are talking to.
 */
export const PARTNER_LINE = 'Your conversation partner';

/**
 * Under "<Name> remembers" on Profile's second row, and the reason to tap it.
 *
 * The row's title says what is behind it and this says what can be done there,
 * which is the half a learner is actually deciding about. How much the tutor
 * holds is said on the screen itself, in `memorySummary`, where there is room
 * for a sentence and where it is not the second line running to start with the
 * tutor's name.
 */
export const MEMORY_ROW_SUB = 'Forget any of it, or add a goal.';

/** What each kind of fact is, in the learner's language. */
export const KIND_GLOSS: Record<RememberedFact['kind'], string> = {
  interest: 'Something you like',
  'life-event': 'Something in your life',
  goal: 'Something you want',
  preference: 'How you like things',
};

export const FORGET_ONE = 'Forget this';
export const FORGET_ALL = 'Clear remembered details';
export const NOTHING_YET = 'Nothing yet. Everyday interests and plans can help your tutor remember what matters for your French.';
export const MEMORY_PAUSE_TITLE = 'Pause personal memory';
export const MEMORY_PAUSE_SUB = 'From your next conversation, remembered details and goals stay out of the tutor’s context, and no new details are added to personal memory. Your name and French progress still help the tutor.';
export const MEMORY_PAUSED_EMPTY = 'Personal memory is paused. You can resume it here when you are ready.';
export function memoryEmptyLine(profile: StoredProfile): string {
  return memoryPaused(profile.brain) ? MEMORY_PAUSED_EMPTY : NOTHING_YET;
}

export const GOALS_LABEL = 'What you want from French';
export const GOALS_SUB = 'Up to three lines, in your own words. Your tutor keeps them in mind when personal memory is on.';
export const GOAL_PLACEHOLDER = 'e.g. Order at a bakery without switching to English';
export const ADD_GOAL = 'Add this goal';
export const REMOVE_GOAL = 'Remove';
/** One plain sentence on what leaves the phone. Names the slice the agent sends. */
export const WHAT_LEAVES = 'Recent remembered details and your goals help personalise new conversations unless you pause personal memory. Your tutor also uses your name, learning progress and preferences. You can edit or remove details here; saved conversations are managed separately in Progress.';
export const MEMORY_SCOPE = 'Use memory for French goals and everyday interests, family and travel. Keep sensitive personal details out of goals and notes.';

/** Every line the card and the screen spell themselves, for the copy sweeps. */
export const TUTOR_MEMORY_COPY: readonly string[] = [
  PARTNER_LINE, MEMORY_ROW_SUB, ...Object.values(KIND_GLOSS), FORGET_ONE, FORGET_ALL, NOTHING_YET,
  MEMORY_PAUSE_TITLE, MEMORY_PAUSE_SUB, MEMORY_PAUSED_EMPTY,
  GOALS_LABEL, GOALS_SUB, GOAL_PLACEHOLDER, ADD_GOAL, REMOVE_GOAL, WHAT_LEAVES, MEMORY_SCOPE,
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
