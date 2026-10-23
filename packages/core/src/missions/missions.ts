/**
 * Missions — a real situation a learner can walk into and come out of having
 * done something.
 *
 * A mission is NOT a script. It is a `ScenarioFrame` that was authored ahead of
 * time instead of written by a model at session open, and it runs on the free
 * conversation engine exactly as a learner's own typed topic does. The tutor
 * still writes every line live against what the learner actually said; the beats
 * are aims, not sentences; the learner can steer anywhere inside the scene. What
 * the mission fixes is where the conversation starts and what counts as done.
 *
 * Two halves, and the split is deliberate. The French lives in
 * `packages/brain/src/missions/frames.ts`, because `ScenarioFrameSchema` owns
 * whether a frame is valid and that schema is brain's. The catalogue lives here,
 * because which missions exist, what practises them and how much help a learner
 * still needed are progression, and progression is core's. Core cannot import
 * brain — the dependency arrow points one way — so the phrase keys are repeated
 * here as literal data, exactly as `drill/fixtures.ts` repeats the scene phrases
 * and for exactly the same reason. `packages/brain/src/missions/agreement.test.ts`
 * reads both sides and fails when they disagree, which is what makes the
 * repetition safe rather than a second source of truth.
 *
 * On state: there is no mission progress store. Display state is a PROJECTION,
 * on the same rule `path.ts` states in its own header, because a mission that
 * says "complete" about phrases the scheduler is calling due that morning is
 * lying to the learner. The one thing that must be remembered is the session
 * fact nothing else records — that the beats were finished, and how much help
 * the learner still had when they were. That follows `PathOptions.lessonDone`:
 * stored by the app, passed in, never recomputed here.
 */

import type { Rung } from '../ladder/ladder.ts';
import type { CefrLevel } from '../lessons/types.ts';
import { isDue } from '../review/evidence.ts';
import type { ReviewCard } from '../review/scheduler.ts';

/**
 * A mission's CEFR band. Core's `CefrLevel` stays lesson-scoped (A0 to A2, see
 * packages/brain/src/types.ts:4); missions run up to B1.
 */
export type MissionLevel = CefrLevel | 'B1';

export type MissionId =
  | 'mission:premier-cafe'
  | 'mission:cafe'
  | 'mission:amis'
  | 'mission:journee'
  | 'mission:chemin'
  | 'mission:marche'
  | 'mission:hotel'
  | 'mission:restaurant'
  | 'mission:pharmacie'
  | 'mission:gare'
  | 'mission:colis'
  | 'mission:voisin'
  | 'mission:week-end'
  | 'mission:collegues'
  | 'mission:telephone'
  | 'mission:medecin'
  | 'mission:retour'
  | 'mission:appartement'
  | 'mission:belle-famille'
  | 'mission:club'
  | 'mission:banque'
  | 'mission:sortie'
  | 'mission:montreal'
  | 'mission:coup-de-main'
  | 'mission:anniversaire'
  | 'mission:fuite'
  | 'mission:galere'
  | 'mission:avis'
  | 'mission:entretien'
  | 'mission:teletravail'
  | 'mission:souvenirs';

/**
 * Where the mission happens: one of the six places the daily pool already
 * draws as a disc. Kept as a small closed union so a new place is a deliberate
 * decision rather than a typo. Missions may share a place (the pharmacy and the
 * station are both `street`); what tells them apart on screen is that every
 * mission has its own drawing, keyed by mission id in
 * `apps/mobile/src/art/flat/scenes.ts`.
 */
export type MissionPlace = 'cafe' | 'friends' | 'home' | 'street' | 'market' | 'hotel';

export interface Mission {
  id: MissionId;
  /** French title, shown as the scene name. */
  title: string;
  titleEn: string;
  place: MissionPlace;
  /**
   * The level the scene is pitched at. Missions run from the beginner's front
   * door at A0 up into everyday A2 situations; the spine reads this to say
   * where a learner stands (`spine.ts`).
   */
  cefr: MissionLevel;
  /** Who the learner is in the scene. Plain English, one clause. */
  learnerRole: string;
  /** Who the tutor plays. Plain English, one clause. */
  tutorRole: string;
  /** The can-do outcome, in the learner's language. */
  goalEn: string;
  /**
   * What the learner reads at the moment the beats are done.
   *
   * Content, not chrome, which is why it lives per mission rather than as one
   * template: "you did this thing" is only warm when it names the thing. It
   * describes and never praises, on PEDAGOGY.md's rule that a learner is never
   * scored and never performed at.
   */
  winEn: string;
  /**
   * What the learner will be able to do, said before they start: "Order a
   * coffee at the counter". Shown on the path and the plan as a can-do. Plain
   * English, no digit, no em dash.
   */
  canDoEn: string;
  /**
   * The same can-do once it is earned, always opening "You can ". Earned is
   * {@link isEarned}, never a separate store.
   */
  earnedEn: string;
  /** The frame's beat ids, in order. The agreement test pins these to the frame. */
  beatIds: readonly string[];
  /**
   * The phrases this mission leaves behind, as review-deck ids.
   *
   * A subset of the frame's `goalPhrases`, not all of them: a frame teaches
   * more than a mission drills, and a phrase only earns a place here if it is
   * worth meeting again next week.
   */
  phraseKeys: readonly string[];
  /**
   * The phrases a pronunciation score may later be measured against.
   *
   * Conservative on purpose, and the reason the product can promise trustworthy
   * feedback at all: accuracy scoring needs a known reference text, so a line
   * only belongs here if it is fixed, self-contained, carries no placeholder or
   * substituted name, and has one natural delivery. Everything else is still
   * practised, just never scored. The post-mission Sound Check consumes these
   * lines and no others.
   */
  referencePhrases: readonly string[];
  /** The `AUTHORED_PATH` unit that practises this mission's phrases. */
  pathUnitId: string;
}

/**
 * That a learner finished a mission's beats, and how much help they still had.
 *
 * The rung is the whole point of storing this. It is the ladder's own measure of
 * how much support was in play, so independence is read off it rather than
 * guessed at, and no model is ever asked how well someone did.
 */
export interface MissionCompletion {
  id: MissionId;
  /** Epoch ms. */
  at: number;
  /** The rung the learner was on when the beats came together. */
  rung: Rung;
}

/**
 * How much of this the learner is now doing themselves.
 *
 * One state per rung, because the rung already IS the amount of support: rung 1
 * hands over the whole line, rung 4 hands over nothing. Inventing a second scale
 * beside the ladder would be a second answer to a question the ladder answers.
 */
export type Independence = 'new' | 'with-help' | 'getting-there' | 'mostly-yours' | 'on-your-own';

export type MissionState = 'new' | 'in-progress' | 'complete' | 'needs-review';

export interface MissionProgress {
  mission: Mission;
  state: MissionState;
  independence: Independence;
  /** How many times the beats have been finished. Never rendered as a score. */
  timesFinished: number;
  /** Epoch ms of the most recent finish, or null. */
  lastFinishedAt: number | null;
  /** The rung of the most recent finish, or null. Round 2's "less help than last time". */
  lastRung: Rung | null;
}

const INDEPENDENCE_BY_RUNG: Record<Rung, Independence> = {
  1: 'with-help',
  2: 'getting-there',
  3: 'mostly-yours',
  4: 'on-your-own',
};

/**
 * The best a learner has ever managed, not the most recent.
 *
 * Replaying a mission with more help on a tired evening is a good thing to do,
 * and a scale that walked backwards for it would turn practice into a risk. This
 * is the same instinct as the ladder's `partial` holding the rung rather than
 * dropping it, and the same one behind having no streak at all.
 */
export function independenceFrom(completions: readonly MissionCompletion[]): Independence {
  let best: Rung | null = null;
  for (const done of completions) {
    if (best === null || done.rung > best) best = done.rung;
  }
  return best === null ? 'new' : INDEPENDENCE_BY_RUNG[best];
}

/**
 * Whether a mission's can-do is earned: handled with nothing handed over.
 *
 * The one place this rule lives. It reads best-ever independence, so a tired
 * replay with more help can never un-earn it, and it asks for the top rung
 * because a finish with support in play is practice, not a can-do. The passport
 * stamp and the CEFR spine both read it from here.
 */
export function isEarned(progress: Pick<MissionProgress, 'independence'>): boolean {
  return progress.independence === 'on-your-own';
}

/**
 * Scenes whose can-do sits wholly inside a bigger scene's. Earning the bigger
 * one earns the smaller: someone who ordered, paid and left the full café on
 * their own can order a coffee at the counter, and sending them back to three
 * lines would be the product forgetting what they did. One direction only; the
 * opener says nothing about the rest of the café.
 */
export const SUBSUMED_BY: Readonly<Partial<Record<MissionId, MissionId>>> = {
  'mission:premier-cafe': 'mission:cafe',
};

/**
 * Every mission earned, directly by {@link isEarned} or through a bigger scene
 * that contains it. The set the CEFR spine reads, so the rule lives here once.
 */
export function earnedMissionIds(progress: readonly MissionProgress[]): Set<MissionId> {
  const earned = new Set<MissionId>(progress.filter(isEarned).map((item) => item.mission.id));
  for (const [smaller, bigger] of Object.entries(SUBSUMED_BY) as [MissionId, MissionId][]) {
    if (earned.has(bigger)) earned.add(smaller);
  }
  return earned;
}

/** True when a scene is only earned because the bigger one containing it was. */
function coveredByBigger(id: MissionId, earned: ReadonlySet<MissionId>): boolean {
  const bigger = SUBSUMED_BY[id];
  return bigger !== undefined && earned.has(bigger);
}

/**
 * One rung up, with the top rung as its own answer.
 *
 * A table rather than `Math.min(4, rung + 1)` so the ceiling is checked by the
 * compiler against `Rung` itself and there is no cast to be wrong about. The
 * ladder has four rungs and never grows a fifth by arithmetic.
 */
const RAISED_BY_RUNG: Record<Rung, Rung> = {
  1: 2,
  2: 3,
  3: 4,
  4: 4,
};

/**
 * The rung a deliberate replay of a finished scene opens on.
 *
 * One rung UP from the last finish, which is the opposite of `openingRung` in
 * `ladder/ladder.ts`, and deliberately so. Two questions, two answers. A cold
 * session opens one rung BELOW where the learner left off, because arriving
 * rusty at the edge of your ability is how a session dies in its first thirty
 * seconds. Choosing to walk back into a scene you have already finished is not
 * that question: the whole point of the replay is less help than last time.
 *
 * Reads the most recent rung, not the best ever, because a replay is about this
 * next attempt. `independenceFrom` above keeps reading best-ever, and that
 * asymmetry is what makes raising the rung safe — a tired evening at rung 1
 * lowers what the next replay offers and costs the learner nothing they have
 * already earned, so there is never a reason to avoid the tired evening.
 *
 * Clamped at the top: rung 4 is already no support at all, so there is nothing
 * left to withdraw. `null` in, `null` out — a scene nobody has finished has no
 * replay to open, and this refuses to invent a rung for it.
 *
 * This only decides what is OFFERED. The ladder still drops on the first four
 * seconds of silence, exactly as it always does, so an ambitious replay cannot
 * strand anyone.
 */
export function replayRung(lastRung: Rung | null): Rung | null {
  return lastRung === null ? null : RAISED_BY_RUNG[lastRung];
}

/**
 * Project one mission's display state from evidence.
 *
 * Mirrors `stateForPhrases` in `path.ts` deliberately: anything the scheduler
 * wants back reads as needing review however long ago the beats were finished,
 * because a phrase slipping away matters more than a finished scene. Both read
 * dueness through `isDue`, so the mirroring is one rule rather than two copies
 * that agree today.
 */
function stateFor(mission: Mission, finished: boolean, deck: readonly ReviewCard[], now: number): MissionState {
  const cards = deck.filter((card) => mission.phraseKeys.includes(card.id));
  if (!finished) return cards.length === 0 ? 'new' : 'in-progress';
  if (cards.some((card) => isDue(card, now))) return 'needs-review';
  return cards.length === mission.phraseKeys.length ? 'complete' : 'in-progress';
}

/**
 * Every mission with what the learner has actually done, in catalogue order.
 *
 * `now` is a parameter for the same reason it is everywhere else in core: a rule
 * about when something is due that cannot be tested across a boundary is a rule
 * nobody can trust.
 */
export function missionStates(
  completions: readonly MissionCompletion[],
  deck: readonly ReviewCard[],
  now: number,
): MissionProgress[] {
  return MISSIONS.map((mission): MissionProgress => {
    const mine = completions.filter((done) => done.id === mission.id).sort((a, b) => a.at - b.at);
    const latest = mine.length > 0 ? mine[mine.length - 1] : undefined;
    return {
      mission,
      state: stateFor(mission, mine.length > 0, deck, now),
      independence: independenceFrom(mine),
      timesFinished: mine.length,
      lastFinishedAt: latest?.at ?? null,
      lastRung: latest?.rung ?? null,
    };
  });
}

/**
 * Which mission to put in front of someone next.
 *
 * Anything the scheduler wants back comes first, then anything started and not
 * finished, then the first mission never attempted. It deliberately does NOT
 * gate: every mission is open in any order, on the same reasoning `path.ts`
 * records, because support is withdrawn as a learner improves rather than
 * withheld until they earn it. This only decides what is offered first.
 *
 * A scene covered by a bigger one the learner has earned (`SUBSUMED_BY`) is
 * never offered: it is still open, just never the suggestion.
 */
export function suggestedMission(progress: readonly MissionProgress[]): MissionProgress | null {
  const earned = earnedMissionIds(progress);
  const offered = progress.filter((p) => !coveredByBigger(p.mission.id, earned));
  return (
    offered.find((p) => p.state === 'needs-review') ??
    offered.find((p) => p.state === 'in-progress') ??
    offered.find((p) => p.state === 'new') ??
    offered[0] ??
    progress[0] ??
    null
  );
}

/**
 * The mission a learner who has never said a word of French opens on: three
 * lines at a café counter, before the full café scene.
 */
export const FIRST_MISSION: MissionId = 'mission:premier-cafe';

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((mission) => mission.id === id);
}

/** Every phrase every mission drills. Used to prove none is orphaned. */
export function missionPhraseKeys(): string[] {
  return MISSIONS.flatMap((mission) => [...mission.phraseKeys]);
}

/**
 * The catalogue.
 *
 * Situations an adult actually walks into, opened by a three-line first scene in
 * the café. Places are the six drawn discs and missions may share one; each
 * mission has its own drawing, so no two hand back the same picture. Café first because it
 * is the shortest path from "I speak no French" to "I said a French sentence to
 * a French person and it worked", and that is the whole promise. Catalogue order
 * is also `SCENE_SPINE` order in `spine.ts`; the spine test holds both.
 *
 * `phraseKeys` use the deck's own identity scheme, `phrase:<fr lowercased>` from
 * `topics/phraseKeyOf`, so drilling a mission phrase reschedules the very card
 * the flashcard deck shows. Every key here also appears in this mission's path
 * unit and is drillable by the bank; `missions.test.ts` and `path.test.ts` hold
 * both ends, because a phrase with nowhere to be practised is a promise the app
 * cannot keep.
 */
export const MISSIONS: readonly Mission[] = [
  {
    // The first scene, and deliberately the smallest: three lines at the same
    // café counter as the full scene below, sharing its place and its path
    // unit. Its phrases and reference phrases are the approved first-coffee
    // lines from `daily/scenes/cafeAndFood.ts`, less the sentence-final full
    // stop that phrase keys never carry, so the brief, the bundled recordings,
    // the frame and the drills all say the same three lines. Earning the full
    // café earns this one too (`SUBSUMED_BY`).
    id: 'mission:premier-cafe',
    title: 'Le premier café',
    titleEn: 'Your first coffee',
    place: 'cafe',
    cefr: 'A0',
    learnerRole: 'A customer ordering a coffee at the counter.',
    tutorRole: 'Karim, the barista working the counter.',
    goalEn: 'Order a coffee, say you will have it here, and pay.',
    winEn: 'The coffee is on the counter, and you ordered it yourself.',
    canDoEn: 'Order a coffee at the counter',
    earnedEn: 'You can order a coffee',
    beatIds: ['greet-and-order', 'say-where', 'pay'],
    phraseKeys: [
      'phrase:bonjour, je vais prendre un café',
      "phrase:sur place, au comptoir, s'il vous plaît",
      'phrase:je vous dois combien ?',
    ],
    referencePhrases: [
      'Bonjour, je vais prendre un café',
      "Sur place, au comptoir, s'il vous plaît",
      'Je vous dois combien ?',
    ],
    pathUnitId: 'cafe',
  },
  {
    id: 'mission:cafe',
    title: 'Au café du coin',
    titleEn: 'Order at a café',
    place: 'cafe',
    cefr: 'A0',
    learnerRole: 'A customer ordering a coffee and something to eat.',
    tutorRole: 'Karim, the barista working the counter.',
    goalEn: 'Order a drink and something to eat, then pay and leave.',
    winEn: 'Et voilà. You just ordered a coffee, start to finish.',
    canDoEn: 'Order food and drink, then pay',
    earnedEn: 'You can order at a café and pay',
    beatIds: ['greet', 'order-drink', 'order-food', 'pay', 'leave'],
    phraseKeys: [
      "phrase:bonjour, un café s'il vous plaît",
      'phrase:je vais prendre un croissant',
      'phrase:ça sera tout, merci',
      'phrase:je peux payer par carte ?',
      'phrase:bonne journée !',
    ],
    referencePhrases: ["Bonjour, un café s'il vous plaît", 'Je peux payer par carte ?', 'Bonne journée !'],
    pathUnitId: 'cafe',
  },
  {
    id: 'mission:hotel',
    title: 'À la réception',
    titleEn: 'Check into a hotel',
    place: 'hotel',
    cefr: 'A0',
    learnerRole: 'A traveller arriving to check into a small family hotel.',
    tutorRole: 'Martine, the owner who checks you in and hands you the key.',
    goalEn: 'Check in at a small hotel and ask one thing about your stay.',
    winEn: 'You checked in, asked your question, and walked off with the key in your hand.',
    canDoEn: 'Check in and ask one question',
    earnedEn: 'You can check into a hotel',
    beatIds: [
      'arrive',
      'show-id',
      'ask-about-stay',
      'take-key',
    ],
    phraseKeys: [
      'phrase:bonsoir, j\'ai une réservation',
      'phrase:le petit déjeuner, c\'est à quelle heure ?',
      'phrase:faut laisser la clé quand je sors ?',
      'phrase:c\'est à quel étage ?',
      'phrase:je vous remercie',
    ],
    referencePhrases: [
      'Bonsoir, j\'ai une réservation',
      'Le petit déjeuner, c\'est à quelle heure ?',
      'Je vous remercie',
    ],
    pathUnitId: 'hotel',
  },
  {
    id: 'mission:marche',
    title: 'Au marché',
    titleEn: 'Buy something at a market',
    place: 'market',
    cefr: 'A1',
    learnerRole: 'A shopper buying tomatoes at a market stall.',
    tutorRole: 'Corinne, the stallholder who weighs and bags whatever you ask for.',
    goalEn: 'Buy produce at a market stall: how much, which ones, and what it comes to.',
    winEn: 'You asked the price, chose the tomatoes yourself, and knew what it came to before you handed anything over.',
    canDoEn: 'Ask the price and choose',
    earnedEn: 'You can buy food at a market',
    beatIds: [
      'greet-and-ask',
      'how-much',
      'pick-the-ones',
      'settle-up',
      'sign-off',
    ],
    phraseKeys: [
      'phrase:bonjour, je voudrais un kilo de tomates',
      'phrase:elles sont à combien, les tomates ?',
      'phrase:celles-là, s\'il vous plaît',
      'phrase:c\'est pour ce soir',
      'phrase:ça fait combien ?',
      'phrase:merci, bon week-end !',
    ],
    referencePhrases: [
      'Celles-là, s\'il vous plaît',
      'C\'est pour ce soir',
      'Ça fait combien ?',
      'Merci, bon week-end !',
    ],
    pathUnitId: 'marche',
  },
  {
    id: 'mission:chemin',
    title: 'Demander son chemin',
    titleEn: 'Ask for directions',
    place: 'street',
    cefr: 'A1',
    learnerRole: 'Someone on foot who has come up out of the Metro and cannot find the train station.',
    tutorRole: 'Sylvie, a passerby walking her dog, who slows down when you ask.',
    goalEn: 'Stop a stranger, ask the way, and understand the answer you get back.',
    winEn: 'You stopped a stranger in the street, asked the way, and understood what she told you.',
    canDoEn: 'Ask the way and follow the answer',
    earnedEn: 'You can ask for directions',
    beatIds: [
      'say-what-you-need',
      'take-in-the-way',
      'check-the-way',
      'thank-and-go',
    ],
    phraseKeys: [
      'phrase:excusez-moi, je cherche la gare',
      'phrase:j\'suis pas d\'ici',
      'phrase:plus lentement, s\'il vous plaît',
      'phrase:c\'est à gauche ou à droite ?',
      'phrase:d\'accord, je vois',
      'phrase:c\'est loin ?',
    ],
    referencePhrases: [
      'Plus lentement, s\'il vous plaît',
      'C\'est à gauche ou à droite ?',
      'D\'accord, je vois',
    ],
    pathUnitId: 'chemin',
  },
  {
    id: 'mission:journee',
    title: 'Ta journée, ça a été ?',
    titleEn: 'Talk about your day',
    place: 'home',
    cefr: 'A1',
    learnerRole: 'A friend home at the end of the day.',
    tutorRole: 'Nadia, a friend from the flat downstairs.',
    goalEn: 'Tell a friend how your day went, and ask about theirs.',
    winEn: 'You told a friend how your day went, and then you asked about hers. That is a catch-up, not an exercise.',
    canDoEn: 'Say how your day went, ask about theirs',
    earnedEn: 'You can talk about your day',
    beatIds: [
      'raconter-sa-journee',
      'donner-un-detail',
      'renvoyer-la-question',
      'reagir',
      'se-quitter',
    ],
    phraseKeys: [
      'phrase:ça a été',
      'phrase:comme d\'hab',
      'phrase:j\'ai pas arrêté',
      'phrase:et toi, ta journée ?',
      'phrase:tant mieux',
      'phrase:ah mince',
    ],
    referencePhrases: [
      'Ça a été',
      'Et toi, ta journée ?',
    ],
    pathUnitId: 'journee',
  },
  {
    id: 'mission:amis',
    title: "L'apéro entre potes",
    titleEn: 'Meet friends',
    place: 'friends',
    cefr: 'A1',
    learnerRole: 'One of the friends, just arrived.',
    tutorRole: 'Chloé and Sami, old friends of yours.',
    goalEn: 'Say how your week went, make a plan, and raise a glass.',
    winEn: 'That was a whole evening with friends, in French.',
    canDoEn: 'Make a plan with friends',
    earnedEn: 'You can make plans with friends',
    beatIds: ['arrive', 'news', 'plans', 'toast'],
    phraseKeys: [
      'phrase:salut ! ça va ?',
      "phrase:j'suis crevé, la semaine était longue",
      'phrase:on fait quoi samedi ?',
      'phrase:carrément !',
      "phrase:c'était un truc de ouf",
      'phrase:santé !',
    ],
    referencePhrases: ['Salut ! Ça va ?', 'On fait quoi samedi ?'],
    pathUnitId: 'amis',
  },
  {
    // A1 from here on, the everyday errands. The restaurant shares the café's
    // place disc and has its own drawing.
    id: 'mission:restaurant',
    title: 'Une table pour ce soir',
    titleEn: 'Book a table',
    place: 'cafe',
    cefr: 'A1',
    learnerRole: 'Someone stopping at a bistro door in the afternoon to book a table for tonight.',
    tutorRole: 'Hélène, the bistro owner, setting up the terrace before evening service.',
    goalEn: 'Book a table for two tonight: the time, the name, and where you sit.',
    winEn: 'A table for two is waiting tonight, and the booking is in your name.',
    canDoEn: 'Book a table for tonight',
    earnedEn: 'You can book a table',
    beatIds: ['ask-for-table', 'say-the-time', 'give-the-name', 'confirm-and-go'],
    phraseKeys: [
      'phrase:bonjour, vous avez une table pour deux ce soir ?',
      "phrase:vers vingt heures, c'est possible ?",
      "phrase:en terrasse, si c'est possible",
      'phrase:à ce soir, alors',
    ],
    referencePhrases: [
      'Bonjour, vous avez une table pour deux ce soir ?',
      "En terrasse, si c'est possible",
      'À ce soir, alors',
    ],
    pathUnitId: 'restaurant',
  },
  {
    id: 'mission:pharmacie',
    title: 'À la pharmacie',
    titleEn: 'Get help at a pharmacy',
    place: 'street',
    cefr: 'A1',
    learnerRole: 'Someone with a sore throat asking a pharmacist for something to take.',
    tutorRole: 'Thomas, the pharmacist, who asks a question before he hands anything over.',
    goalEn: 'Say what hurts and since when, find out how to take what you are given, and pay.',
    winEn: 'Thomas knows what hurts, you know how to take it, and the box is in your pocket.',
    canDoEn: 'Ask a pharmacist for help',
    earnedEn: 'You can get help at a pharmacy',
    beatIds: ['say-what-hurts', 'say-since-when', 'ask-how-to-take-it', 'pay-and-thank'],
    phraseKeys: [
      "phrase:bonjour, j'ai mal à la gorge",
      'phrase:depuis hier soir',
      'phrase:je le prends combien de fois par jour ?',
      'phrase:faut une ordonnance ?',
    ],
    referencePhrases: [
      "Bonjour, j'ai mal à la gorge",
      'Depuis hier soir',
      'Je le prends combien de fois par jour ?',
    ],
    pathUnitId: 'pharmacie',
  },
  {
    // Picks up where mission:chemin leaves the learner, outside the station.
    id: 'mission:gare',
    title: 'Au guichet de la gare',
    titleEn: 'Buy a train ticket',
    place: 'street',
    cefr: 'A1',
    learnerRole: 'A traveller buying a return ticket to Lyon at the station desk.',
    tutorRole: 'Julien, the agent at the ticket desk.',
    goalEn: 'Buy a return ticket, pick a train, and find out which platform it leaves from.',
    winEn: 'Ticket bought, train chosen, platform found. Off you go.',
    canDoEn: 'Buy a ticket and find your train',
    earnedEn: 'You can buy a train ticket',
    beatIds: ['ask-for-a-ticket', 'choose-a-train', 'ask-the-platform', 'pay'],
    phraseKeys: [
      "phrase:un aller-retour pour lyon, s'il vous plaît",
      'phrase:le prochain train part à quelle heure ?',
      "phrase:c'est quelle voie ?",
      "phrase:c'est un train direct ?",
    ],
    referencePhrases: ['Le prochain train part à quelle heure ?', "C'est un train direct ?"],
    pathUnitId: 'gare',
  },
  {
    id: 'mission:colis',
    title: 'Au point relais',
    titleEn: 'Pick up a parcel',
    place: 'market',
    cefr: 'A1',
    learnerRole: 'A customer collecting a parcel from the pickup point in a corner shop.',
    tutorRole: 'Sandrine, who runs the tabac-presse and its parcel shelf.',
    goalEn: 'Say you are here for a parcel, give the name and code, show ID, and check it is yours.',
    winEn: 'The parcel came out from the back room, and it left the shop with you.',
    canDoEn: 'Collect a parcel at the counter',
    earnedEn: 'You can pick up a parcel',
    beatIds: ['say-why-you-came', 'give-name-and-code', 'show-id', 'check-and-go'],
    phraseKeys: [
      'phrase:bonjour, je viens chercher un colis',
      "phrase:j'ai reçu un code par sms",
      "phrase:voilà ma pièce d'identité",
      "phrase:oui, c'est bien ça, merci",
    ],
    referencePhrases: [
      'Bonjour, je viens chercher un colis',
      "Voilà ma pièce d'identité",
      "Oui, c'est bien ça, merci",
    ],
    pathUnitId: 'colis',
  },
  {
    id: 'mission:voisin',
    title: 'Sur le palier',
    titleEn: 'Meet your neighbour',
    place: 'home',
    cefr: 'A1',
    learnerRole: 'Someone who has just moved into the building, carrying the last boxes upstairs.',
    tutorRole: 'Monique, the retired neighbour across the landing, who knows everyone.',
    goalEn: 'Introduce yourself to a neighbour, chat about the area, and get one good tip.',
    winEn: 'Monique knows who lives on the third floor now, and you know where the good bread is.',
    canDoEn: 'Introduce yourself to a neighbour',
    earnedEn: 'You can chat with a neighbour',
    beatIds: ['say-you-moved-in', 'say-where-from', 'chat-about-the-area', 'ask-for-a-tip', 'say-goodbye'],
    phraseKeys: [
      "phrase:bonjour, je viens d'emménager au troisième",
      'phrase:vous habitez ici depuis longtemps ?',
      'phrase:y a une bonne boulangerie dans le coin ?',
      'phrase:bonne soirée, à bientôt',
    ],
    referencePhrases: [
      'Vous habitez ici depuis longtemps ?',
      'Bonne soirée, à bientôt',
    ],
    pathUnitId: 'voisin',
  },
  {
    // A2 from here on, everyday life: telling what happened, holding a
    // position politely, and the first scene where tu is offered.
    id: 'mission:week-end',
    title: 'Alors, ce week-end ?',
    titleEn: 'Tell a colleague about your weekend',
    place: 'friends',
    cefr: 'A2',
    learnerRole: 'Someone who works in the office, getting a coffee before the first meeting on a Monday.',
    tutorRole: 'Lucas, a colleague from the next desk, chatty at the coffee machine.',
    goalEn: 'Say what you did at the weekend, add a detail, then ask about his and react.',
    winEn: 'Lucas heard about your Saturday, and you heard all about his.',
    canDoEn: 'Say what you did at the weekend',
    earnedEn: 'You can talk about your weekend',
    beatIds: ['say-what-you-did', 'add-a-detail', 'ask-about-theirs', 'react', 'back-to-work'],
    phraseKeys: [
      "phrase:samedi, j'ai vu des amis",
      "phrase:on a mangé au resto, c'était top",
      "phrase:et toi, t'as fait quoi ?",
      "phrase:bon, j'y retourne",
    ],
    referencePhrases: ["On a mangé au resto, c'était top", "Bon, j'y retourne"],
    pathUnitId: 'week-end',
  },
  {
    id: 'mission:collegues',
    title: 'Le premier jour',
    titleEn: 'Introduce yourself at work',
    place: 'home',
    cefr: 'A2',
    learnerRole: 'Someone starting a new job today, meeting the team manager for the first time.',
    tutorRole: 'Isabelle, the team manager, who starts with vous and offers tu.',
    goalEn: 'Say who you are and what you did before, accept tu, and ask one practical thing.',
    winEn: 'Isabelle switched to tu, and you know where the team eats at lunchtime.',
    canDoEn: 'Introduce yourself at work',
    earnedEn: 'You can introduce yourself at work',
    beatIds: ['say-who-and-role', 'say-what-before', 'accept-tu', 'ask-a-practical-thing', 'thank-her'],
    phraseKeys: [
      "phrase:bonjour, je commence aujourd'hui dans l'équipe",
      'phrase:avant, je travaillais dans une banque',
      "phrase:d'accord, on se tutoie",
      'phrase:tu peux me montrer la cantine ?',
    ],
    referencePhrases: [
      "Bonjour, je commence aujourd'hui dans l'équipe",
      'Avant, je travaillais dans une banque',
      'Tu peux me montrer la cantine ?',
    ],
    pathUnitId: 'collegues',
  },
  {
    // Books the appointment mission:medecin then keeps.
    id: 'mission:telephone',
    title: 'Prendre rendez-vous',
    titleEn: 'Book an appointment by phone',
    place: 'home',
    cefr: 'A2',
    learnerRole: 'Someone phoning a GP practice to book an appointment for a cough.',
    tutorRole: 'Nathalie, the practice secretary, who spells and repeats on request.',
    goalEn: 'Say why you are calling, settle on a slot, spell your name, and repeat the time back.',
    winEn: 'The appointment is booked, and the name on it is spelled right.',
    canDoEn: 'Book an appointment by phone',
    earnedEn: 'You can book an appointment by phone',
    beatIds: ['say-why-calling', 'take-or-turn-down-slot', 'spell-your-name', 'repeat-back'],
    phraseKeys: [
      'phrase:bonjour, je voudrais prendre rendez-vous',
      "phrase:pardon, j'ai pas bien entendu",
      'phrase:vous auriez quelque chose plus tôt ?',
      "phrase:je vous l'épelle",
    ],
    referencePhrases: [
      'Bonjour, je voudrais prendre rendez-vous',
      'Vous auriez quelque chose plus tôt ?',
      "Je vous l'épelle",
    ],
    pathUnitId: 'telephone',
  },
  {
    id: 'mission:medecin',
    title: 'Chez le médecin',
    titleEn: 'See a doctor',
    place: 'street',
    cefr: 'A2',
    learnerRole: 'A patient with a cough that has lasted a week, keeping the appointment booked by phone.',
    tutorRole: 'Dr Benali, the GP, who listens first and asks one question at a time.',
    goalEn: 'Say what the trouble is and since when, answer her questions, and ask how long to take the treatment.',
    winEn: 'Dr Benali knows what the trouble is, and you know how long to take the treatment.',
    canDoEn: 'Explain your symptoms to a doctor',
    earnedEn: 'You can explain your symptoms to a doctor',
    beatIds: ['say-what-is-wrong', 'say-since-when', 'answer-her-questions', 'ask-about-treatment', 'thank-her'],
    phraseKeys: [
      'phrase:je tousse beaucoup, surtout la nuit',
      'phrase:depuis la semaine dernière',
      "phrase:non, j'ai pas de fièvre",
      'phrase:je dois le prendre pendant combien de temps ?',
    ],
    referencePhrases: [
      'Je tousse beaucoup, surtout la nuit',
      'Depuis la semaine dernière',
      'Je dois le prendre pendant combien de temps ?',
    ],
    pathUnitId: 'medecin',
  },
  {
    id: 'mission:retour',
    title: 'Rapporter un article',
    titleEn: 'Take something back to a shop',
    place: 'market',
    cefr: 'A2',
    learnerRole: 'A customer bringing back a kettle that stopped working after two days.',
    tutorRole: 'Mehdi, the sales assistant at the returns counter, who offers a credit note first.',
    goalEn: 'Explain the problem, show the receipt, ask for a refund, and insist politely if you need to.',
    winEn: 'The kettle went back on the shelf, and the money went back on your card.',
    canDoEn: 'Return something that does not work',
    earnedEn: 'You can return something to a shop',
    beatIds: ['explain-it-does-not-work', 'show-the-receipt', 'ask-exchange-or-refund', 'insist-politely', 'leave'],
    phraseKeys: [
      "phrase:bonjour, j'ai un problème avec cette bouilloire",
      "phrase:j'ai gardé le ticket de caisse",
      'phrase:je préfère un remboursement',
      "phrase:c'est possible de voir avec un responsable ?",
    ],
    referencePhrases: [
      "J'ai gardé le ticket de caisse",
      'Je préfère un remboursement',
      "C'est possible de voir avec un responsable ?",
    ],
    pathUnitId: 'retour',
  },
  {
    id: 'mission:appartement',
    title: 'Visiter un appartement',
    titleEn: 'View a flat to rent',
    place: 'home',
    cefr: 'A2',
    learnerRole: 'Someone looking for a flat to rent, at a viewing with the letting agent.',
    tutorRole: 'Céline, the letting agent, brisk and friendly, with a busy morning of viewings.',
    goalEn: 'Ask about the rent and the flat, when it is free, and what the application needs.',
    winEn: 'Céline has answered every question, and you know what goes in the file.',
    canDoEn: 'Ask the right questions about a flat',
    earnedEn: 'You can ask about a flat to rent',
    beatIds: ['ask-about-rent', 'ask-about-the-flat', 'ask-when-free', 'ask-about-the-file', 'say-you-are-interested'],
    phraseKeys: [
      "phrase:le loyer, c'est charges comprises ?",
      'phrase:il est libre à partir de quand ?',
      "phrase:qu'est-ce qu'il faut pour le dossier ?",
      'phrase:faut un garant ?',
    ],
    referencePhrases: [
      "Le loyer, c'est charges comprises ?",
      'Il est libre à partir de quand ?',
      "Qu'est-ce qu'il faut pour le dossier ?",
    ],
    pathUnitId: 'appartement',
  },
  {
    id: 'mission:belle-famille',
    title: 'Dîner chez ses parents',
    titleEn: "Dinner with your partner's parents",
    place: 'friends',
    cefr: 'A2',
    learnerRole: "Someone meeting their partner's parents for dinner for the first time.",
    tutorRole: "Françoise and Bernard, your partner's parents, both on vous.",
    goalEn: 'Arrive with a gift, answer their questions, compliment the food, talk about plans, and thank them.',
    winEn: 'Françoise wrapped up some cake for later, and Bernard walked you both to the door.',
    canDoEn: "Have dinner with your partner's family",
    earnedEn: "You can have dinner with your partner's family",
    beatIds: ['arrive-with-a-gift', 'answer-about-yourself', 'compliment-the-food', 'talk-about-plans', 'thank-and-leave'],
    phraseKeys: [
      "phrase:bonsoir ! tenez, c'est pour vous",
      "phrase:c'est délicieux, c'est vous qui l'avez fait ?",
      "phrase:on va passer l'été dans le sud",
      'phrase:merci beaucoup pour cette soirée',
    ],
    referencePhrases: [
      "Bonsoir ! Tenez, c'est pour vous",
      "C'est délicieux, c'est vous qui l'avez fait ?",
      'Merci beaucoup pour cette soirée',
    ],
    pathUnitId: 'belle-famille',
  },
  {
    // A2, second group (docs/changes/mission-spine-b1.md): everyday tasks for
    // the moving, family and work goals, and the one Montréal scene.
    id: 'mission:club',
    title: "S'inscrire au club",
    titleEn: 'Sign up for a class',
    place: 'street',
    cefr: 'A2',
    learnerRole: 'Someone new to the area, signing up for a weekly class at the local community centre.',
    tutorRole: 'Sophie, at the welcome desk of the maison de quartier, who knows every timetable by heart.',
    goalEn: 'Say which class you want, ask the times, the price and what to bring, then sign up.',
    winEn: 'Sophie has put your name down, and you know what to bring along.',
    canDoEn: 'Sign up for a class',
    earnedEn: 'You can sign up for a class',
    beatIds: ['say-what-you-want', 'ask-the-times', 'ask-the-price', 'ask-what-to-bring', 'sign-up'],
    phraseKeys: [
      "phrase:je voudrais m'inscrire au cours de yoga",
      "phrase:c'est quel jour, et à quelle heure ?",
      "phrase:on peut faire un cours d'essai ?",
      "phrase:qu'est-ce qu'il faut apporter ?",
    ],
    referencePhrases: [
      "C'est quel jour, et à quelle heure ?",
      "On peut faire un cours d'essai ?",
      "Qu'est-ce qu'il faut apporter ?",
    ],
    pathUnitId: 'club',
  },
  {
    // Follows mission:appartement for a learner who has just moved.
    id: 'mission:banque',
    title: 'Ouvrir un compte',
    titleEn: 'Open a bank account',
    place: 'street',
    cefr: 'A2',
    learnerRole: 'Someone who has just moved to France, opening a bank account at a local branch.',
    tutorRole: 'Antoine, a bank adviser, polite and precise, who goes through each document in turn.',
    goalEn: 'Say you want an account and that you just moved, ask what documents and when the card comes, then book the next step.',
    winEn: 'Your next appointment is booked, and you know exactly which papers to bring.',
    canDoEn: 'Ask to open a bank account',
    earnedEn: 'You can ask to open a bank account',
    beatIds: ['say-you-want-an-account', 'say-you-just-moved', 'ask-what-documents', 'ask-about-the-card', 'book-the-next-step'],
    phraseKeys: [
      'phrase:bonjour, je voudrais ouvrir un compte',
      'phrase:je viens de déménager dans le quartier',
      'phrase:vous avez besoin de quels documents ?',
      'phrase:et la carte bancaire, je la reçois quand ?',
    ],
    referencePhrases: [
      'Bonjour, je voudrais ouvrir un compte',
      'Vous avez besoin de quels documents ?',
      'Et la carte bancaire, je la reçois quand ?',
    ],
    pathUnitId: 'banque',
  },
  {
    id: 'mission:sortie',
    title: 'On se fait un ciné ?',
    titleEn: 'Make plans with a friend',
    place: 'friends',
    cefr: 'A2',
    learnerRole: 'Someone phoning a friend to plan an evening at the cinema.',
    tutorRole: 'Léa, a friend, chatty on the phone, whose week is already half full.',
    goalEn: 'Suggest going out, turn down a day and offer another, then agree on a time and a place.',
    winEn: 'Léa has the evening in her diary, and so do you.',
    canDoEn: 'Make plans with a friend on the phone',
    earnedEn: 'You can arrange a night out with a friend',
    beatIds: ['suggest-going-out', 'turn-down-and-offer', 'agree-time-and-place', 'confirm'],
    phraseKeys: [
      'phrase:on se fait un ciné ?',
      'phrase:samedi, je peux pas, mais dimanche, ça te va ?',
      'phrase:on se retrouve devant le cinéma ?',
      "phrase:t'es libre samedi soir ?",
    ],
    referencePhrases: ['On se fait un ciné ?', 'On se retrouve devant le cinéma ?'],
    pathUnitId: 'sortie',
  },
  {
    // The one Quebec scene: standard Quebec French, a few local words, no joual.
    id: 'mission:montreal',
    title: "Un manteau pour l'hiver",
    titleEn: 'Buy a winter coat in Montréal',
    place: 'market',
    cefr: 'A2',
    learnerRole: 'Someone who has just arrived in Montréal, buying a first real winter coat.',
    tutorRole: 'Marc-André, a sales assistant in a Montréal clothing shop, warm and quick.',
    goalEn: 'Say what you are looking for, ask for your size, try it on and say how it fits, ask the price, and decide.',
    winEn: 'The coat fits, the taxes were no surprise at the till, and winter can come now.',
    canDoEn: 'Shop for a winter coat',
    earnedEn: 'You can shop for winter clothes',
    beatIds: ['say-what-you-look-for', 'ask-for-your-size', 'say-how-it-fits', 'ask-the-price', 'decide'],
    phraseKeys: [
      "phrase:bonjour, je cherche un manteau pour l'hiver",
      "phrase:vous l'avez dans une plus grande taille ?",
      'phrase:il est un peu serré aux épaules',
      'phrase:il coûte combien, avec les taxes ?',
    ],
    referencePhrases: [
      "Bonjour, je cherche un manteau pour l'hiver",
      "Vous l'avez dans une plus grande taille ?",
      'Il coûte combien, avec les taxes ?',
    ],
    pathUnitId: 'montreal',
  },
  {
    id: 'mission:coup-de-main',
    title: 'Un petit coup de main ?',
    titleEn: 'Ask a colleague for help',
    place: 'home',
    cefr: 'A2',
    learnerRole: 'Someone a few weeks into a new job, stuck on booking a meeting room in the office software.',
    tutorRole: 'Inès, a colleague in the open space, patient and quick with the office tools.',
    goalEn: 'Ask if she has a minute, explain what you are trying to do, ask her to show you, and check you understood.',
    winEn: 'Inès showed you once, and the next time you can manage on your own.',
    canDoEn: 'Ask a colleague to show you how, and check you followed',
    earnedEn: 'You can ask a colleague for help and check you followed',
    beatIds: ['ask-if-she-has-a-minute', 'explain-what-you-are-trying', 'ask-her-to-show-you', 'check-you-understood', 'thank-her'],
    phraseKeys: [
      "phrase:t'as deux minutes ?",
      "phrase:j'arrive pas à réserver une salle",
      'phrase:tu peux me montrer comment tu fais ?',
      "phrase:si j'ai bien compris, il faut d'abord choisir la date",
    ],
    referencePhrases: [
      'Tu peux me montrer comment tu fais ?',
      "Si j'ai bien compris, il faut d'abord choisir la date",
    ],
    pathUnitId: 'coup-de-main',
  },
  {
    // Widens mission:belle-famille to the partner's own generation, on tu.
    id: 'mission:anniversaire',
    title: "L'anniversaire de sa sœur",
    titleEn: "Your partner's sister's birthday",
    place: 'friends',
    cefr: 'A2',
    learnerRole: "Someone at their partner's sister's birthday party, meeting part of the family for the first time.",
    tutorRole: "Manon, your partner's sister, and Maxime, a cousin, both on tu from the start.",
    goalEn: 'Wish her happy birthday, say how you met your partner, chat with a cousin, accept more cake, and say goodbye.',
    winEn: 'Manon opened your present first, and Maxime wants the whole story of how you two met.',
    canDoEn: "Celebrate a birthday with your partner's family",
    earnedEn: "You can celebrate with your partner's family",
    beatIds: ['wish-happy-birthday', 'say-how-you-met', 'chat-with-a-cousin', 'accept-a-second-helping', 'say-goodbye'],
    phraseKeys: [
      "phrase:joyeux anniversaire ! c'est pour toi",
      "phrase:on s'est rencontrés par des amis",
      'phrase:on est ensemble depuis deux ans',
      'phrase:allez, juste un petit peu alors',
    ],
    referencePhrases: [
      "Joyeux anniversaire ! C'est pour toi",
      "On s'est rencontrés par des amis",
    ],
    pathUnitId: 'anniversaire',
  },
  {
    // B1 (docs/changes/mission-spine-b1.md): explaining a problem. Follows
    // mission:appartement once the learner lives in the flat.
    id: 'mission:fuite',
    title: 'Il y a une fuite',
    titleEn: 'Report a leak to your landlord',
    place: 'home',
    cefr: 'B1',
    learnerRole: 'A tenant phoning the landlord about a leak under the kitchen sink.',
    tutorRole: 'Patrick, the landlord, calm on the phone, who wants the facts before he sends anyone.',
    goalEn: 'Explain the leak, say since when and what you tried, say what it is damaging, then agree when a plumber can come.',
    winEn: 'Patrick is sending a plumber, and the bucket under the sink can go back in the cupboard.',
    canDoEn: 'Report a problem in your home',
    earnedEn: 'You can report a problem to your landlord',
    beatIds: ['explain-the-problem', 'say-since-when', 'say-what-it-damages', 'ask-when-someone-can-come', 'agree-on-a-time'],
    phraseKeys: [
      "phrase:il y a une fuite sous l'évier de la cuisine",
      "phrase:ça a commencé hier soir, et j'ai coupé l'eau",
      "phrase:l'eau coule chez le voisin du dessous",
      'phrase:un plombier pourrait passer quand ?',
    ],
    referencePhrases: [
      "Il y a une fuite sous l'évier de la cuisine",
      "Ça a commencé hier soir, et j'ai coupé l'eau",
      'Un plombier pourrait passer quand ?',
    ],
    pathUnitId: 'fuite',
  },
  {
    // B1: opinion and justification. The film mission:sortie planned.
    id: 'mission:avis',
    title: 'Alors, ce film ?',
    titleEn: 'Say what you thought of a film',
    place: 'cafe',
    cefr: 'B1',
    learnerRole: 'Someone coming out of the cinema with a friend, over a drink next door.',
    tutorRole: 'Yasmine, a friend who loves films and enjoys a friendly argument about them.',
    goalEn: 'Give your opinion and say why, add a nuance, agree or disagree politely, and suggest what to see next.',
    winEn: 'Yasmine half agrees with you, and the next film is your pick.',
    canDoEn: 'Say what you thought of a film, and why',
    earnedEn: 'You can give your opinion and explain it',
    beatIds: ['give-your-opinion', 'say-why', 'add-a-nuance', 'agree-or-disagree', 'suggest-what-next'],
    phraseKeys: [
      "phrase:à mon avis, c'était vraiment réussi",
      "phrase:ce qui m'a plu, c'est l'histoire",
      "phrase:c'était pas mal, par contre c'était un peu long",
      "phrase:je suis pas tout à fait d'accord",
    ],
    referencePhrases: ["À mon avis, c'était vraiment réussi", "Ce qui m'a plu, c'est l'histoire"],
    pathUnitId: 'avis',
  },
  {
    // B1: the imparfait sets the scene, the passé composé moves it on.
    id: 'mission:galere',
    title: 'Tu vas pas me croire',
    titleEn: 'Tell the story of your weekend',
    place: 'cafe',
    cefr: 'B1',
    learnerRole: 'Someone telling a friend over a drink about a weekend where everything went sideways.',
    tutorRole: 'Hugo, a friend, a great listener who always has a worse story of his own.',
    goalEn: 'Set the scene, say what happened and how you reacted, say how it ended, then react to his story.',
    winEn: 'Hugo laughed at the train part, then told you his own disaster.',
    canDoEn: 'Tell a friend a story from start to finish',
    earnedEn: 'You can tell a story about something that happened',
    beatIds: ['set-the-scene', 'say-what-happened', 'say-how-you-reacted', 'say-how-it-ended', 'react-to-his-story'],
    phraseKeys: [
      "phrase:il pleuvait, et j'étais à la gare",
      'phrase:et là, le train a été annulé',
      "phrase:du coup, j'ai pris le bus de nuit",
      "phrase:finalement, j'ai dormi chez des amis",
    ],
    referencePhrases: [
      "Il pleuvait, et j'étais à la gare",
      'Et là, le train a été annulé',
      "Finalement, j'ai dormi chez des amis",
    ],
    pathUnitId: 'galere',
  },
  {
    // B1: the polite conditional. Same Isabelle as mission:collegues, who
    // offered tu there, so it is tu here.
    id: 'mission:teletravail',
    title: 'Demander du télétravail',
    titleEn: 'Ask your manager to work from home',
    place: 'home',
    cefr: 'B1',
    learnerRole: 'Someone a few months into the job, asking their manager about working from home.',
    tutorRole: 'Isabelle, the team manager from the first day, open to it but worried about team meetings.',
    goalEn: 'Ask for a moment, make the request, give your reasons, answer her concern, and agree on a next step.',
    winEn: 'Isabelle said yes to a trial, and the team calendar already shows your home days.',
    canDoEn: 'Ask your manager for something politely',
    earnedEn: 'You can make a polite request at work',
    beatIds: ['ask-for-a-moment', 'make-the-request', 'give-your-reasons', 'answer-her-concern', 'agree-a-next-step'],
    phraseKeys: [
      'phrase:est-ce que ce serait possible de télétravailler ?',
      "phrase:à la maison, j'arrive mieux à me concentrer",
      "phrase:pour les réunions d'équipe, je serais toujours là",
      'phrase:et si on faisait un essai, pour voir ?',
    ],
    referencePhrases: [
      'Est-ce que ce serait possible de télétravailler ?',
      "À la maison, j'arrive mieux à me concentrer",
      "Pour les réunions d'équipe, je serais toujours là",
    ],
    pathUnitId: 'teletravail',
  },
  {
    // B1: imparfait descriptions and then-and-now. Widens
    // mission:belle-famille to the grandparents' generation.
    id: 'mission:souvenirs',
    title: 'Chez la grand-mère',
    titleEn: "Talk with your partner's grandmother",
    place: 'friends',
    cefr: 'B1',
    learnerRole: "Someone spending an afternoon with their partner's grandmother, over coffee and old photos.",
    tutorRole: "Jeannine, your partner's grandmother, who says tu to you and loves to tell stories.",
    goalEn: 'Say where you grew up and what it was like, ask about her youth, compare then and now, and thank her.',
    winEn: 'Jeannine brought out the old photo album, and wants you back for Sunday lunch.',
    canDoEn: "Share memories with your partner's grandmother",
    earnedEn: 'You can talk about the past and how things have changed',
    beatIds: ['say-where-you-grew-up', 'describe-what-it-was-like', 'ask-about-her-youth', 'compare-then-and-now', 'thank-her-for-the-stories'],
    phraseKeys: [
      "phrase:j'ai grandi dans une petite ville au bord de la mer",
      "phrase:quand j'étais enfant, on jouait dehors tout le temps",
      "phrase:et vous, comment c'était, quand vous étiez jeune ?",
      "phrase:aujourd'hui, tout va beaucoup plus vite",
    ],
    referencePhrases: [
      "J'ai grandi dans une petite ville au bord de la mer",
      "Quand j'étais enfant, on jouait dehors tout le temps",
    ],
    pathUnitId: 'souvenirs',
  },
  {
    // B1: a short, realistic interview. No salary talk.
    id: 'mission:entretien',
    title: "L'entretien d'embauche",
    titleEn: 'A short job interview',
    place: 'home',
    cefr: 'B1',
    learnerRole: 'A candidate in a first interview for a job in a French company.',
    tutorRole: 'Claire Lefèvre, a recruiter, friendly but precise, who listens for examples.',
    goalEn: 'Sum up your background, say why this job, give an example of a strength, ask about the role, and close.',
    winEn: 'Claire Lefèvre walked you to the lift and promised news by the end of the week.',
    canDoEn: 'Talk about yourself in a job interview',
    earnedEn: 'You can talk about yourself in a short job interview',
    beatIds: ['sum-up-your-background', 'say-why-this-job', 'give-an-example', 'ask-about-the-role', 'close-and-thank'],
    phraseKeys: [
      "phrase:j'ai travaillé plusieurs années dans la vente",
      "phrase:ce poste m'intéresse parce que j'aime le travail en équipe",
      "phrase:mon point fort, c'est l'organisation",
      "phrase:j'aimerais savoir à quoi ressemble une journée type",
    ],
    referencePhrases: [
      "J'ai travaillé plusieurs années dans la vente",
      "Mon point fort, c'est l'organisation",
      "J'aimerais savoir à quoi ressemble une journée type",
    ],
    pathUnitId: 'entretien',
  },
];
