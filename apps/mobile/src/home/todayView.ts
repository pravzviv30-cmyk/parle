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
import { latestReadyPack } from '../conversationPacks/model.ts';
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
 * French. Every block below is drawn only when it has something true to say,
 * and "Coming up" is not drawn at all until Phase C stores the event it would
 * describe (founder, 2026-10-20). Nothing here reads a clock of its own, stores
 * anything or reads the allowance: minutes left belong to the wall.
 * =========================================================================== */

/** The page's blocks, in the artboard's order. "Coming up" is not one of them. */
export const TODAY_CARDS = ['greeting', 'stats', 'nextScene', 'three', 'fix', 'phrase', 'week'] as const;
export type TodayCard = (typeof TODAY_CARDS)[number];

export const TODAY_COPY = {
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
  /** The Start opens the room through the gate, `tutor/gate.ts`. */
  start: 'Convo',
} as const;

/**
 * The hero's eyebrow: "Next scene, 2 of 3", the scene's place among the spine
 * scenes of its own stage (A0 is Starter, A1 is Basics). A scene the learner
 * walked out of keeps its own label, and the day's scene after the spine says
 * so plainly, because it has no place to count.
 */
export function sceneEyebrow(hero: HomeMission): string {
  if (hero.kind === 'today') return TODAY_COPY.todayScene;
  if (hero.label !== null) return hero.label;
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
  /** "Alexandre's version shows after you try": the drill opens without the moment, so the learner's own line is never promised. */
  after: string;
  /** Opens the drill on the better line alone, without the moment, so nothing is revealed first. */
  route: { screen: 'Drill'; params: { node: { id: string; title: string; phraseKeys: readonly string[] } } };
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
}): OneFix | null {
  const { replay } = input;
  if (replay === null || !replay.sayable) return null;
  // The exercise the drill will really open on, by the drill's own rule, so
  // the card's promise holds: the French must stay hidden until the try.
  const first = buildDrillSession(input.deck, input.bank, input.now, { only: [replay.key] }).queue[0];
  if (first === undefined || first.phraseKey !== replay.key || !hidesAnswer(first)) return null;
  return {
    english: replay.betterEn,
    after: `${input.tutorName}'s version shows after you try`,
    route: { screen: 'Drill', params: { node: { id: `fix:${replay.packId}:${replay.key}`, title: TODAY_COPY.fix, phraseKeys: [replay.key] } } },
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
