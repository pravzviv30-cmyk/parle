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
import { isDue } from '../review/evidence.ts';
import type { ReviewCard } from '../review/scheduler.ts';

export type MissionId =
  | 'mission:cafe'
  | 'mission:amis'
  | 'mission:journee'
  | 'mission:chemin'
  | 'mission:marche'
  | 'mission:hotel';

/**
 * Where the mission happens. This is a place, not a category: it is what the
 * learner pictures, and what gives the mission its card. Kept as a small closed
 * union so a new place is a deliberate decision rather than a typo.
 */
export type MissionPlace = 'cafe' | 'friends' | 'home' | 'street' | 'market' | 'hotel';

export interface Mission {
  id: MissionId;
  /** French title, shown as the scene name. */
  title: string;
  titleEn: string;
  place: MissionPlace;
  /** Missions are the beginner's front door. Nothing here is above A1. */
  cefr: 'A0' | 'A1';
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
 */
export function suggestedMission(progress: readonly MissionProgress[]): MissionProgress | null {
  return (
    progress.find((p) => p.state === 'needs-review') ??
    progress.find((p) => p.state === 'in-progress') ??
    progress.find((p) => p.state === 'new') ??
    progress[0] ??
    null
  );
}

/** The mission a learner who has never said a word of French opens on. */
export const FIRST_MISSION: MissionId = 'mission:cafe';

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
 * Six situations an adult actually walks into, one place each so no two missions
 * hand back the same postcard. Café first because it is the shortest path from
 * "I speak no French" to "I said a French sentence to a French person and it
 * worked", and that is the whole promise.
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
    id: 'mission:cafe',
    title: 'Au café du coin',
    titleEn: 'Order at a café',
    place: 'cafe',
    cefr: 'A0',
    learnerRole: 'A customer ordering a coffee and something to eat.',
    tutorRole: 'Karim, the barista working the counter.',
    goalEn: 'Order a drink and something to eat, then pay and leave.',
    winEn: 'Et voilà. You just ordered a coffee, start to finish.',
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
];
