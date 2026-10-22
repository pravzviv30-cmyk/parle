/**
 * One task for one goal, decided in code (Stage 4, item 1).
 *
 * The learner wrote a goal in their own words. This picks one authored mission
 * that practises it, by a keyword table authored per mission (not per place:
 * several missions share a drawn place, F864). No model is asked: the model
 * observes, code decides, and a table is a rule a test can read.
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
 * Free-text goals will often match nothing. Then the answer is the first full
 * scene (the café, never the three-line opener), and its fit is `'starter'`: the words for it say "a good place to
 * start" and never "matches your goal". The fit is never stored, so the claim
 * is remade from the table every time it is drawn.
 */

import { FIRST_MISSION, getMission, normalise, type Mission, type MissionId } from '@luvani/core';

export type GoalTask = { kind: 'mission'; id: string };

export type GoalFit = 'matched' | 'starter';

export interface NextGoalTask {
  task: GoalTask;
  fit: GoalFit;
}

/**
 * Words that mean a mission's place or what is done there, one list per
 * mission, in the learner's English (and the French they are likely to type),
 * after core's `normalise`: lowercase, no accents, no apostrophes. Whole words only, so "roomba" is not a room.
 *
 * Authored by hand from each mission's scene and its `goalEn`, never harvested
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
 *
 * Mission spine A2 review (2026-10-22, F864): twelve new missions share the six
 * drawn places, and a table keyed by place gave every mission at a place the
 * same score, so the tie sent "book a restaurant" to the café and "talk to my
 * neighbour" to the day scene. The table is keyed by mission now, and shared
 * places no longer share words. A word on two missions is deliberate and the
 * older scene wins the tie: bare "restaurant" sits on the café and the
 * restaurant, so "Order in a restaurant" stays the café while "Book a
 * restaurant" scores 2 for the new scene; "small talk with colleagues" goes to
 * the weekend scene before the colleagues one. The same precision rule holds,
 * and these second meanings are out on purpose: bare "return" (a return
 * flight, a tax return), "rent" (rent a car), "flat" (a flat white, a flat
 * tyre, French that sounds flat), "train" (my ear), "station" (the train
 * station is the way-finding scene), "package" (a salary package), "weekend"
 * (plan my weekend), "job" and "new job" (get a job), "reservation" (I have
 * reservations), "complaint" and "faulty". Where a bare word stays, its second
 * meanings go in OTHER_MEANINGS ("doctor who", "spin doctor", "part and
 * parcel", "parcel of land").
 */
export const MISSION_WORDS: Readonly<Record<Exclude<MissionId, 'mission:premier-cafe'>, readonly string[]>> = {
  'mission:cafe': ['cafe', 'coffee', 'croissant', 'bakery', 'boulangerie', 'barista', 'restaurant', 'restaurants', 'menu', 'waiter', 'bistro'],
  'mission:hotel': ['hotel', 'hotels', 'reception', 'accommodation', 'hostel', 'airbnb'],
  'mission:marche': ['market', 'markets', 'marche', 'groceries', 'grocery', 'supermarket', 'stall'],
  'mission:chemin': ['directions', 'ask the way', 'ask for the way', 'find my way to', 'find the way to'],
  'mission:journee': ['partner', 'husband', 'wife', 'daily routine', 'about my day'],
  'mission:amis': ['friend', 'friends', 'apero', 'aperitif'],
  'mission:restaurant': [
    'restaurant', 'restaurants', 'book a restaurant', 'book a table', 'booking a table', 'reserve a table',
    'table for two', 'restaurant reservation', 'dinner reservation',
  ],
  'mission:pharmacie': [
    'pharmacy', 'pharmacies', 'pharmacist', 'pharmacie', 'painkillers', 'fill a prescription',
    'fill my prescription', 'pick up a prescription', 'pick up my prescription',
  ],
  'mission:gare': [
    'train ticket', 'train tickets', 'return ticket', 'return tickets', 'ticket office', 'railway station',
    'sncf', 'tgv', 'gare', 'by train', 'take the train', 'catch a train', 'catch the train',
  ],
  'mission:colis': [
    'parcel', 'parcels', 'colis', 'pick up a package', 'pick up my package', 'collect a package',
    'collect my package', 'point relais',
  ],
  'mission:voisin': ['neighbour', 'neighbours', 'neighbor', 'neighbors', 'voisin', 'voisins', 'voisine'],
  'mission:week-end': [
    'about my weekend', 'about the weekend', 'about your weekend', 'last weekend', 'what i did at the weekend',
    'small talk at work', 'small talk with colleagues',
  ],
  'mission:collegues': [
    'colleague', 'colleagues', 'coworker', 'coworkers', 'co worker', 'co workers', 'first day at work',
    'first day at my new job', 'start a new job', 'starting a new job', 'my new job', 'introduce myself at work',
  ],
  'mission:telephone': ['appointment', 'appointments', 'phone call', 'phone calls', 'on the phone', 'over the phone', 'by phone'],
  'mission:medecin': ['doctor', 'doctors', 'gp', 'medecin', 'see a doctor'],
  'mission:retour': [
    'refund', 'refunds', 'return something', 'return an item', 'return a purchase', 'return it to the shop',
    'return to the shop', 'take something back', 'take it back to the shop', 'complain in a shop',
  ],
  'mission:appartement': [
    'apartment', 'apartments', 'appartement', 'landlord', 'landlady', 'flatshare', 'flatmate', 'rent a flat',
    'renting a flat', 'find a flat', 'view a flat', 'flat to rent', 'apartment to rent', 'flat viewing',
    'flat hunting', 'the rent', 'pay the rent', 'pay rent', 'my rent',
  ],
  'mission:belle-famille': [
    'partners parents', 'in laws', 'inlaws', 'mother in law', 'father in law', 'parents in law', 'belle famille',
    'boyfriends parents', 'girlfriends parents', 'husbands parents', 'wifes parents', 'meet his parents',
    'meet her parents', 'meet their parents',
  ],
};

/**
 * Phrases in which a place word means something else. They are taken out of
 * the goal before matching, so "the job market" is not the market.
 */
const OTHER_MEANINGS: readonly string[] = [
  'job market', 'stock market', 'housing market', 'property market', 'labour market', 'labor market',
  'black market', 'market research', 'market share',
  'doctor who', 'spin doctor', 'part and parcel', 'parcel of land',
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

/** How many of a mission's words or phrases the goal uses, whole words only. */
function hits(words: readonly string[], mission: Mission): number {
  let said = ` ${words.join(' ')} `;
  for (const other of OTHER_MEANINGS) said = said.split(` ${other} `).join(' ');
  let count = 0;
  const keys = mission.id === 'mission:premier-cafe' ? [] : MISSION_WORDS[mission.id];
  for (const key of keys) if (said.includes(` ${key} `)) count += 1;
  return count;
}

/**
 * The one mission to offer for a goal, or null when the catalogue holds no full
 * scene.
 *
 * The mission with the most hits wins; ties go to catalogue order, so the same
 * goal always gets the same task. No hit at all is the starter: the catalogue's
 * first full scene, fit `'starter'`. Core's `FIRST_MISSION`, the three-line
 * opener, is never offered for a goal, matched or not, at any boundary
 * (2026-09-27): a goal names a place, and a place means its full scene, so the
 * opener shares the café's place but is only ever the starting point.
 */
export function nextTaskForGoal(goal: string, input: { missions: readonly Mission[] }): NextGoalTask | null {
  const missions = input.missions.filter((mission) => mission.id !== FIRST_MISSION);
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
  return { task: { kind: 'mission', id: missions[0]!.id }, fit: 'starter' };
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
