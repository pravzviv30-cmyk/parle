/**
 * One task for one goal, decided in code (Stage 4, item 1).
 *
 * The learner wrote a goal in their own words. This picks one authored mission
 * that practises it, by a keyword table over each mission's place and its
 * goal line. No model is asked: the model observes, code decides, and a table
 * is a rule a test can read.
 *
 * Missions only, by the lead's decision. A daily situation would open through
 * the seed-topic path, which is a Max-only door, so offering one here could
 * widen an entitlement; a Real Moment task would need the moment's identity
 * carried through a screen that does not carry it. Both are later work. The
 * stored task format (`goals/model.ts`) already accepts them, so a row a later
 * build writes survives this one.
 *
 * ## Matched, or a starting point
 *
 * Free-text goals will often match nothing. Then the answer is the first
 * mission, and its fit is `'starter'`: the words for it say "a good place to
 * start" and never "matches your goal". The fit is never stored, so the claim
 * is remade from the table every time it is drawn.
 */

import { FIRST_MISSION, getMission, normalise, type Mission, type MissionPlace } from '@luvani/core';

export type GoalTask = { kind: 'mission'; id: string };

export type GoalFit = 'matched' | 'starter';

export interface NextGoalTask {
  task: GoalTask;
  fit: GoalFit;
}

/**
 * Words that mean a place, in the learner's English (and the French they are
 * likely to type), after core's `normalise`: lowercase, no accents, no
 * apostrophes. Whole words only, so "roomba" is not a room.
 *
 * Authored by hand from each mission's place and its `goalEn`, never harvested
 * from them automatically. A harvested goal line brings its verbs with it:
 * "understand the answer" made "Understand French films" a match for asking
 * directions, and "(matches your goal)" printed over that would be false. So a
 * word is here only when it names the place or what is done there, and the
 * words that mean something else in ordinary English are left out on purpose:
 * "check" (the weather), "order" (in order to), "way", "day" (every day),
 * "train" (my ear), "stay" (motivated), "meeting" (at work).
 *
 * Stage 4 review (2026-09-25): words that name more than one place or have an
 * everyday second meaning claimed matches the mission did not serve ("Buy a
 * house" as the market, "Talk to my colleagues" as friends, "have a drink with
 * a stranger" as the café). They are out: "buy", "price", "shop", "drink",
 * "tea", "eat", the meals, "room", "booking", "reservation", "station",
 * "metro", "bus", "stranger", "home", "plans", "weekend", "colleagues". Where
 * a place is only named by a phrase, the phrase is the key: "ask for the way",
 * "find my way". The starter is the café, so a café goal that loses its word
 * loses only the claim, never the task.
 *
 * Stage 5 review (2026-09-26): metaphors and second meanings did the same
 * ("navigate the healthcare system", "a map of the metro", "get lost in a
 * novel", "a new direction", "street slang", "cook with fresh produce", "a
 * political party", "a study routine"). Precision over recall: a word stays
 * only when it almost always means the place, and a phrase stands in where the
 * single word is ambiguous ("find my way to", "daily routine", "about my day").
 */
const PLACE_WORDS: Record<MissionPlace, readonly string[]> = {
  cafe: ['cafe', 'coffee', 'croissant', 'bakery', 'boulangerie', 'barista', 'restaurant', 'restaurants', 'menu', 'waiter', 'bistro'],
  hotel: ['hotel', 'hotels', 'reception', 'accommodation', 'hostel', 'airbnb'],
  market: ['market', 'markets', 'marche', 'groceries', 'grocery', 'supermarket', 'stall'],
  street: ['directions', 'ask the way', 'ask for the way', 'find my way to', 'find the way to'],
  home: ['partner', 'husband', 'wife', 'neighbour', 'neighbours', 'neighbor', 'neighbors', 'daily routine', 'about my day'],
  friends: ['friend', 'friends', 'apero', 'aperitif'],
};

/**
 * Phrases in which a place word means something else. They are taken out of
 * the goal before matching, so "the job market" is not the market.
 */
const OTHER_MEANINGS: readonly string[] = [
  'job market', 'stock market', 'housing market', 'property market', 'labour market', 'labor market',
  'black market', 'market research', 'market share',
];

/**
 * A goal that says what the learner does not want ("never stay in hotels
 * again", "not the market") names a place without wanting it, and a keyword
 * table cannot tell the difference. Any negation makes the answer a starting
 * point, which claims nothing. "Without" and "stop" are not here: "without
 * switching to English" and "stop a stranger" are what the learner wants.
 * Apostrophes are already gone after `normalise`, so "don't" reads "dont".
 */
const NEGATIONS: ReadonlySet<string> = new Set([
  'not', 'never', 'no', 'nor', 'neither', 'avoid', 'cannot', 'hate', 'hates', 'dislike', 'dislikes',
  'dont', 'doesnt', 'didnt', 'cant', 'wont', 'isnt', 'arent', 'wasnt', 'werent',
  'shouldnt', 'couldnt', 'wouldnt', 'havent', 'hasnt', 'hadnt',
  'ne', 'pas', 'jamais',
]);

/** A text's words, normalised the way core compares spoken French, one space apart. */
function wordsOf(text: string): string[] {
  return normalise(text).split(/[^a-z0-9]+/).filter((word) => word.length > 0);
}

/** How many of a mission's place words or phrases the goal uses, whole words only. */
function hits(words: readonly string[], mission: Mission): number {
  let said = ` ${words.join(' ')} `;
  for (const other of OTHER_MEANINGS) said = said.split(` ${other} `).join(' ');
  let count = 0;
  for (const key of PLACE_WORDS[mission.place]) if (said.includes(` ${key} `)) count += 1;
  return count;
}

/**
 * The one mission to offer for a goal, or null when the catalogue is empty.
 *
 * The mission with the most hits wins; ties go to catalogue order, so the same
 * goal always gets the same task. No hit at all is the starter: the catalogue's
 * first mission (core's `FIRST_MISSION` when present), fit `'starter'`.
 */
export function nextTaskForGoal(goal: string, input: { missions: readonly Mission[] }): NextGoalTask | null {
  const missions = input.missions;
  if (missions.length === 0) return null;
  const said = wordsOf(goal);
  const negated = said.some((word) => NEGATIONS.has(word));
  let best: Mission | null = null;
  let bestHits = 0;
  for (const mission of negated ? [] : missions) {
    const count = hits(said, mission);
    if (count > bestHits) {
      best = mission;
      bestHits = count;
    }
  }
  if (best !== null) return { task: { kind: 'mission', id: best.id }, fit: 'matched' };
  const starter = missions.find((mission) => mission.id === FIRST_MISSION) ?? missions[0]!;
  return { task: { kind: 'mission', id: starter.id }, fit: 'starter' };
}

/** The stored task id: the mission id, which already reads `mission:<place>`. */
export function goalTaskOf(task: GoalTask): string {
  return task.id;
}

/** The mission a stored task names, or null for another family or an id this build does not know. */
export function missionOfTask(task: string): Mission | null {
  if (!task.startsWith('mission:')) return null;
  return getMission(task) ?? null;
}

/** The words either side of the mission's name. */
export const GOAL_FIT_COPY = {
  matchedLead: 'Next: ',
  matchedTail: ' (matches your goal)',
  starterLead: 'A good place to start: ',
} as const;

/** The line under a goal: the mission by name, with the fit said honestly. */
export function nextLine(mission: Mission, fit: GoalFit): string {
  return fit === 'matched'
    ? `${GOAL_FIT_COPY.matchedLead}${mission.titleEn}${GOAL_FIT_COPY.matchedTail}`
    : `${GOAL_FIT_COPY.starterLead}${mission.titleEn}`;
}
