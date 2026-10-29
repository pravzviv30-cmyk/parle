/**
 * What Today draws under the scene brief, decided (notebook Phase 3, B1).
 *
 * Two blocks, and each is drawn only when it has something true to show.
 *
 * On day one, "Where you're starting": the first three can-dos on the
 * CEFR spine, in spine order. It claims no level the learner has reached and no
 * date; it names where the path begins and what the first three scenes let a
 * learner say. It leaves the moment any scene has been finished, earned or not.
 *
 * After that, at most two plain sentences about the week, from the week story
 * and the reflection that reads the same week. A quiet week gets nothing: a
 * block that can render empty is a quota, and the four empty tiles and the
 * seven-dot rail this replaces were exactly that.
 */

import {
  QUEST_XP,
  buildDrillSession,
  SCENE_SPINE,
  getMission,
  type ConversationPack,
  type DrillExercise,
  type Mission,
  type MissionProgress,
  type ReviewCard,
} from '@luvani/core';

import type { FeatureAccess, LockedFeature } from '../access/featureAccess.ts';
import { dealForTier, offeredReview, reviewOffer } from '../review/freeTier.ts';
import { latestReadyPack } from '../conversationPacks/model.ts';
import { goalPickLine } from '../onboarding/goalLine.ts';
import { dayWord } from '../journey/journeyView.ts';
import type { Replay } from '../practice/madeFrom.ts';
import type { Reflection } from '../progress/reflection.ts';
import type { HomeMission } from './homeMission.ts';

/**
 * The week story's shape, stated rather than imported: `progress/story.ts`
 * keeps a pinned list of importers (F233), and Today already reads it once.
 */
interface WeekStory {
  sentences: readonly string[];
}

export const STARTING_LABEL = "Where you're starting";

/** The caps line over the week's sentences. */
export const WEEK_LABEL = 'This week';

/** Two sentences, never a wall of facts. */
export const WEEK_LINES_MAX = 2;

/** How many can-dos day one names. */
const STARTING_CAN_DOS = 3;

/** Day one's can-dos. No level: CEFR codes stay internal (2026-10-20, B5 learning-science review). */
export interface StartingPoint {
  canDos: readonly string[];
}

/**
 * Day one's block, or null once any scene has been finished.
 *
 * An empty list is a read that did not answer, not a first day, so it is null
 * too rather than a claim about a learner nobody could read.
 */
export function startingPoint(progress: readonly MissionProgress[]): StartingPoint | null {
  if (progress.length === 0) return null;
  if (progress.some((p) => p.timesFinished > 0)) return null;
  const canDos = SCENE_SPINE.map((id) => getMission(id))
    .filter((mission): mission is Mission => mission !== undefined)
    .slice(0, STARTING_CAN_DOS)
    .map((mission) => mission.canDoEn);
  return { canDos };
}

/**
 * The week in at most two sentences, or none.
 *
 * The reflection's "what went well" leads when there is one, because it is the
 * sentence that says something moved; then the story's own sentences. A line is
 * never said twice. The reflection's focus is left out on purpose: it can be a
 * bare French correction, which is not a sentence about the week.
 */
export function weekLines(input: { story: Pick<WeekStory, 'sentences'>; reflection: Reflection | null }): string[] {
  const out: string[] = [];
  for (const line of [input.reflection?.improvement ?? null, ...input.story.sentences]) {
    if (line === null) continue;
    const text = line.trim();
    if (text === '' || out.includes(text)) continue;
    out.push(text);
    if (out.length === WEEK_LINES_MAX) break;
  }
  return out;
}

/* ===========================================================================
 * The B-Today page (2026-10-20, B5, B-Today).
 *
 * Today reads, top to bottom: the greeting, the stats row, the yellow next
 * scene, today's three quests, one fix to try, today's phrase and the week in
 * French. Every block below is drawn only when it has something true to say.
 * 2026-10-20 UI-008, artboard B-Today: "Coming up" is drawn now (founder), from
 * the latest life-event the tutor remembers; its countdown and checklist have
 * no data and wait for Phase C. Nothing here reads a clock of its own, stores
 * anything or reads the allowance: minutes left belong to the wall.
 * =========================================================================== */

/**
 * The page's blocks, in order. 2026-10-29 (F934, LR-17, founder decision 6):
 * Today leads with one ordered path, and the quotas, Coming up and the week
 * sit under it. The fix and the phrase are stops on the path now.
 */
export const TODAY_CARDS = ['greeting', 'stats', 'path', 'three', 'comingUp', 'week'] as const;
export type TodayCard = (typeof TODAY_CARDS)[number];

/** Today's path, in the review's section 10 order: retry the fix, the next scene, say today's phrase. */
export const TODAY_PATH = ['fix', 'scene', 'phrase'] as const;
export type TodayPathStep = (typeof TODAY_PATH)[number];

/**
 * Stated estimates, said as such ("About"), never a measured length. The scene
 * has its own estimate (`estimate.ts`); a fix is one line (about 30 seconds);
 * the phrase and a review sitting are about 2 minutes.
 */
export function aboutMinutes(minutes: number): string {
  const n = Math.max(1, Math.round(minutes));
  return n === 1 ? 'About 1 minute' : `About ${n} minutes`;
}

const PATH_WORDS: Record<TodayPathStep, string> = {
  fix: 'Retry your last fix',
  scene: 'The next scene',
  phrase: "Say today's phrase",
};

/** A stop's title and its time: the scene's from its own estimate, the others stated. */
export function pathStep(step: TodayPathStep, minutes?: number): { title: string; line: string } {
  if (step === 'fix') return { title: PATH_WORDS.fix, line: 'About 30 seconds' };
  if (step === 'phrase') return { title: PATH_WORDS.phrase, line: aboutMinutes(2) };
  return { title: PATH_WORDS.scene, line: aboutMinutes(minutes ?? 1) };
}

/**
 * The review row (F934; reverses UI-008's "review off Today", DECISIONS
 * 2026-10-29): drawn only when Review would deal cards, by Review's own deal
 * (`dealForTier`), so a free learner with only conversation phrases due is
 * offered nothing Review would hold back.
 */
export function reviewRow(deck: readonly ReviewCard[], now: number, lock: Parameters<typeof dealForTier>[2]): { title: string; line: string; count: number } | null {
  if (offeredReview(reviewOffer(deck, now), lock) === null) return null;
  const count = dealForTier(deck, now, lock).due.length;
  if (count === 0) return null;
  return { title: count === 1 ? 'Review 1 phrase' : `Review ${count} phrases`, line: aboutMinutes(2), count };
}

export const TODAY_COPY = {
  path: "Today's path",
  three: "Today's three",
  fix: 'One fix to try',
  fixAsk: 'How would you say this in French?',
  fixAction: 'Say it better, then compare',
  phrase: "Today's phrase",
  sayIt: 'Say it yourself',
  week: 'Your week in French',
  seeWeek: 'See your week',
  todayScene: "Today's scene",
} as const;

/** Where every door on Today goes, named once so a test can hold each. */
export const TODAY_ROUTES = {
  profile: 'Profile',
  fix: 'Drill',
  phrase: 'DailyPractice',
  week: 'WeekWrapped',
  /** Rehearse now: the real-moment builder, prefilled with the event. */
  rehearse: 'RealMoment',
  /** The Start opens the room through the gate, `tutor/gate.ts`. */
  start: 'Convo',
} as const;

/**
 * The hero's eyebrow: "Next scene, 2 of 3", the scene's place among the spine
 * scenes of its own stage (A0 is Starter, A1 is Basics). A scene the learner
 * walked out of keeps its own label, and the day's scene after the spine says
 * so plainly, because it has no place to count. A scene the learner's goal
 * chose says so instead ("Picked for your move"): it may sit outside the
 * stage's count, so a number would mislead.
 */
export function sceneEyebrow(hero: HomeMission): string {
  if (hero.kind === 'today') return TODAY_COPY.todayScene;
  if (hero.label !== null) return hero.label;
  const goalLine = hero.picked === 'goal' ? goalPickLine(hero.pickedFor) : null;
  if (goalLine !== null) return goalLine;
  const stage = SCENE_SPINE.map((id) => getMission(id)).filter((m): m is Mission => m !== undefined && m.cefr === hero.mission.cefr);
  const at = stage.findIndex((m) => m.id === hero.mission.id);
  return at === -1 ? 'Next scene' : `Next scene, ${at + 1} of ${stage.length}`;
}

/** The line under the title: "Au café du coin, about 6 min with Alexandre". */
export function sceneLine(hero: HomeMission, tutorName: string): { french: string | null; rest: string } {
  const rest = `about ${Math.max(1, Math.round(hero.minutes))} min with ${tutorName}`;
  return hero.french === null ? { french: null, rest: `${rest.charAt(0).toUpperCase()}${rest.slice(1)}` } : { french: hero.french, rest: `, ${rest}` };
}

/**
 * The phrase from the last conversation the next scene uses, or null. It claims
 * no progression (2026-10-20, B5 learning-science review: "Uses", not "Builds on"). Only a real meeting counts:
 * one of the newest ready conversation's key phrases is one of the lines the
 * scene asks for, compared with case and closing punctuation set aside.
 */
export function buildsOn(packs: readonly ConversationPack[], hero: HomeMission | null): string | null {
  if (hero === null || hero.kind !== 'scene') return null;
  const pack = latestReadyPack(packs);
  if (pack === null) return null;
  const wanted = new Set(hero.mission.referencePhrases.map(meetKey));
  return pack.keyPhrases.find((phrase) => wanted.has(meetKey(phrase.fr)))?.fr ?? null;
}

/** A line as the meeting compares it: case, the closing punctuation and its spaces aside. */
function meetKey(fr: string): string {
  return fr.normalize('NFC').toLocaleLowerCase('fr').replace(/[\s\u00a0\u202f.!?…]+$/u, '').trim();
}

export const buildsOnLine = (phrase: string): { before: string; french: string; after: string } => ({
  before: 'Uses \u201c',
  french: phrase,
  after: '\u201d from your last conversation',
});

/** "1 of 3 done": quests done today, never more than three. */
export function threeDone(done: number): string {
  return `${Math.max(0, Math.min(3, Math.floor(done)))} of 3 done`;
}

/** What a quest row carries on its right: its XP while it waits or once done, its count while it moves. */
export function questTrailing(row: { complete: boolean; done: number; target: number; count: string }): { kind: 'xp'; label: string; earned: boolean } | { kind: 'count'; label: string } {
  if (row.complete) return { kind: 'xp', label: `+${QUEST_XP} XP`, earned: true };
  if (row.target > 1 && row.done > 0) return { kind: 'count', label: row.count };
  return { kind: 'xp', label: `+${QUEST_XP} XP`, earned: false };
}

export interface OneFix {
  /** The English of the better line: all the card shows before a try. */
  english: string;
  /**
   * "Your line from Friday and Alexandre's version show after you try" when the
   * conversation's day is known, and the drill carries the moment to draw once
   * the learner has tried; else "Alexandre's version shows after you try".
   */
  after: string;
  /**
   * Opens the drill on the better line, attempt first. With a day the moment
   * rides along behind `afterTry`, so it is drawn only after the first answer.
   */
  route: { screen: 'Drill'; params: { node: { id: string; title: string; phraseKeys: readonly string[]; moment?: { quote: string; better: string; why: string }; afterTry?: true } } };
  feature: LockedFeature;
  locked: boolean;
}

/**
 * An exercise that asks for the French without showing it first: a typed
 * translation from English, a typed blank with no choices, or own words. Not
 * multiple choice, word tiles, a line to repeat or a line to listen to, each
 * of which puts the answer on screen or in the ear before the attempt
 * (2026-10-20, B5 learning-science review).
 */
export function hidesAnswer(exercise: DrillExercise): boolean {
  switch (exercise.kind) {
    case 'translate':
      return exercise.direction === 'en-fr';
    case 'fill-blank':
      return exercise.options === null;
    case 'own-words':
      return true;
    default:
      return false;
  }
}

/**
 * One fix to try, or null. It is the newest conversation's first correction
 * (`madeFromConversations().replay`), drawn attempt first: the English only,
 * with the learner's line and the tutor's version waiting behind the try.
 * The drill opens without the moment, as Your fixes does, because a drill
 * given a moment draws the better line above the exercise. Null when there is
 * no replay, the sitting would be empty, or the exercise it would open on shows
 * the French before the try.
 */
export function oneFix(input: {
  replay: Replay | null;
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  tutorName: string;
  access: (feature: LockedFeature) => FeatureAccess;
  now: number;
  /** The saved conversations, to name the day the learner's line was said. */
  packs?: readonly ConversationPack[];
}): OneFix | null {
  const { replay } = input;
  if (replay === null || !replay.sayable) return null;
  // The exercise the drill will really open on, by the drill's own rule, so
  // the card's promise holds: the French must stay hidden until the try.
  const first = buildDrillSession(input.deck, input.bank, input.now, { only: [replay.key] }).queue[0];
  if (first === undefined || first.phraseKey !== replay.key || !hidesAnswer(first)) return null;
  // 2026-10-20 UI-008, artboard B-Today: "your line from {day}" is back where
  // the conversation's day is known, and the drill then shows the learner's
  // line beside the better one, after the try (DrillScreen `afterTry`).
  const pack = input.packs?.find((p) => p.id === replay.packId);
  const said = pack === undefined ? Number.NaN : Date.parse(pack.createdAt);
  const day = Number.isFinite(said) && said <= input.now ? dayWord(said, input.now) : null;
  const node = { id: `fix:${replay.packId}:${replay.key}`, title: TODAY_COPY.fix, phraseKeys: [replay.key] };
  return {
    english: replay.betterEn,
    after: day === null ? `${input.tutorName}'s version shows after you try` : `Your line from ${day} and ${input.tutorName}'s version show after you try`,
    route: { screen: 'Drill', params: { node: day === null ? node : { ...node, moment: { quote: replay.quote, better: replay.better, why: replay.why }, afterTry: true } } },
    feature: 'fixes',
    locked: input.access('fixes') === 'locked',
  };
}

/** The start of the local day six days before `now`'s: seven local days, today included. */
export function weekStart(now: number): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start.getTime();
}

/**
 * "11 minutes practised, 8 phrases saved" ("saved", not "kept": a card added
 * this week is not yet a phrase retained; B5 learning-science review), over the last seven local days, or
 * null on a week with no evidence. Minutes are the saved conversations' own
 * lengths (`durationSec`, which a typed conversation has too, so "practised"
 * and not "spoken"); phrases are deck cards added in the same days. A pack
 * with no length adds nothing rather than a guess.
 */
export function weekInFrench(input: { packs: readonly ConversationPack[]; deck: readonly ReviewCard[]; now: number }): string | null {
  const from = weekStart(input.now);
  const within = (at: number) => Number.isFinite(at) && at >= from && at <= input.now;
  let seconds = 0;
  for (const pack of input.packs) {
    if (pack.durationSec === null || !(pack.durationSec > 0)) continue;
    if (within(Date.parse(pack.createdAt))) seconds += pack.durationSec;
  }
  const minutes = Math.floor(seconds / 60);
  const kept = input.deck.filter((card) => within(card.addedAt)).length;
  if (minutes === 0 && kept === 0) return null;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'} practised`);
  if (kept > 0) parts.push(`${kept} ${kept === 1 ? 'phrase' : 'phrases'} saved`);
  return parts.join(', ');
}

/* ===========================================================================
 * Coming up (2026-10-20 UI-008, artboard B-Today; founder decision: shown now).
 *
 * The latest life event the tutor remembers, from the brain's memory facts:
 * its words, its loose when ("Friday", "next month") when there is one, and
 * "{tutor} remembers". No countdown and no checklist: nothing stores a date or
 * the steps (Phase C). Hidden with no life-event fact, while memory is paused,
 * and after Not now, which holds for this app session only, in memory: a
 * stored dismissal waits for Phase C.
 * =========================================================================== */

export const COMING_UP_COPY = {
  rehearse: 'Rehearse now',
  notNow: 'Not now',
} as const;

export interface RememberedEvent {
  kind: string;
  en: string;
  happensAround: string | null;
  notedAt: string;
}

export interface ComingUp {
  /** Which fact this is, so Not now hides this event and not the next. */
  key: string;
  title: string;
  when: string;
  locked: boolean;
  feature: LockedFeature;
  /** Rehearse now: the real-moment builder with the event typed in. */
  route: { screen: 'RealMoment'; params: { detail: string } };
}

/** Events hidden with Not now, for as long as the app stays open. */
const notNowThisSession = new Set<string>();

export function dismissComingUp(key: string): void {
  notNowThisSession.add(key);
}

/**
 * How long a remembered when stays believable (learning-science review,
 * 2026-10-20): `happensAround` is loose text relative to `notedAt`, so
 * "Friday" goes stale. Until Phase C stores real dates, a fact older than
 * this is not drawn.
 */
export const COMING_UP_FRESH_MS = 14 * 24 * 60 * 60 * 1000;

/** For tests: a new app session. */
export function resetComingUpSession(): void {
  notNowThisSession.clear();
}

export function comingUp(input: {
  facts: readonly RememberedEvent[];
  paused: boolean;
  tutorName: string;
  access: (feature: LockedFeature) => FeatureAccess;
  now: number;
}): ComingUp | null {
  if (input.paused) return null;
  let latest: RememberedEvent | null = null;
  for (const fact of input.facts) {
    if (fact.kind !== 'life-event' || fact.en.trim() === '') continue;
    if (latest === null || Date.parse(fact.notedAt) >= Date.parse(latest.notedAt)) latest = fact;
  }
  if (latest === null) return null;
  // Only an event with a when is "coming up"; one with none may be past.
  const around = latest.happensAround?.trim() ?? '';
  if (around === '') return null;
  const noted = Date.parse(latest.notedAt);
  if (!Number.isFinite(noted) || input.now - noted > COMING_UP_FRESH_MS) return null;
  const en = latest.en.trim();
  const key = `${latest.notedAt}:${en}`;
  if (notNowThisSession.has(key)) return null;
  const remembers = `${input.tutorName} remembers`;
  return {
    key,
    title: `Coming up: ${en}`,
    when: `${around}, ${remembers}`,
    // The lock is Rehearse now's, which opens RealMoment (F910): the badge and the tap agree.
    locked: input.access('realMoment') === 'locked',
    feature: 'realMoment',
    route: { screen: 'RealMoment', params: { detail: en } },
  };
}
