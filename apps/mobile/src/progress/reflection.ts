/**
 * The weekly reflection (Stage 4, item 6): one improvement, one focus, one
 * next place, from what was recorded in the learner's last seven local days.
 *
 * Pure. It takes values its caller already built and decides three lines:
 *
 * - **improvement**: this week's practice sentence (`progressStatement` over
 *   the conversations whose latest recorded practice fell in the week), else
 *   the week story's independence or sound sentence. Never a count: the story's
 *   word-count sentence is not an improvement anyone can feel.
 * - **focus**: the newest measured sound check of the week that called
 *   something out (`soundLine`, which already refuses a dated or counted
 *   assessor sentence), else the first curated correction of the newest
 *   conversation saved this week.
 * - **next**: core's suggested mission, the same one My French's "Try next"
 *   leads with, and only when there is an improvement or a focus to go with it.
 *
 * All three null draws nothing: no slot, no quota. Nothing compares this week
 * with an earlier one, so no older history can change a word of it. Every
 * line goes through `guiltIn`; a line that fails is skipped, never repaired.
 *
 * It does not import `progress/story.ts`: F233 keeps that module to exactly
 * two readers, Home and its inline detail component. The story arrives here as
 * the value Home already built.
 */

import { localDayKey, suggestedMission, type MissionPlace, type MissionProgress } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { progressStatement, type RecentConversation } from '../myfrench/recentConversations.ts';
import { soundLine } from '../myfrench/sounds.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';

/** Seven local days, this one and the six behind it: the same week the story tells. */
const REFLECTION_DAYS = 7;

export interface Reflection {
  improvement: string | null;
  focus: string | null;
  /** The place rides along so the row draws that place's own mark and paper. */
  next: { missionId: string; title: string; place: MissionPlace } | null;
}

export interface ReflectionInput {
  /** The week story Home already built. Only its independence and sound sentences are read. */
  story: { sentences: readonly string[] };
  /** Every ready saved conversation with its latest recorded outcome, as `allConversations` gives them. */
  recent: readonly RecentConversation[];
  /** Every sound check the store holds. */
  checks: readonly SoundCheckEvidence[];
  /** Where every mission stands, as `missionStates` gives it. */
  progress: readonly MissionProgress[];
  now: number;
}

/** The labels over the three lines. None counts them: any of the three can be absent. */
export const REFLECTION_COPY = {
  label: 'Your week, in short',
  improvement: 'What went well',
  focus: 'One thing to keep working on',
  next: 'A place to go next',
} as const;

const NOTHING: Reflection = { improvement: null, focus: null, next: null };

/**
 * The two story sentences that say something moved. Matched on the story's
 * own words, which `reflection.test.ts` builds through `storyFrom` itself, so
 * a reworded story sentence fails that test rather than silently vanishing.
 */
const INDEPENDENCE = 'This week you mostly found the words on your own.';
const SOUND = /^Your \/[^/\d]+\/ came out clearly this week\.$/;

function weekOf(now: number): (at: number) => boolean {
  const here = new Date(now);
  const days = new Set<string>();
  for (let back = 0; back < REFLECTION_DAYS; back += 1) {
    days.add(localDayKey(new Date(here.getFullYear(), here.getMonth(), here.getDate() - back).getTime()));
  }
  return (at) => Number.isFinite(at) && days.has(localDayKey(at));
}

/** A line the learner may read, or null. */
function said(line: string | null | undefined): string | null {
  if (line === null || line === undefined) return null;
  const text = line.trim();
  return text === '' || guiltIn(text) !== undefined ? null : text;
}

function improvementOf(input: ReflectionInput, inWeek: (at: number) => boolean): string | null {
  const practisedThisWeek = input.recent.filter((row) => row.at !== null && inWeek(row.at));
  const practice = said(progressStatement(practisedThisWeek));
  if (practice !== null) return practice;
  const story = input.story.sentences.find((sentence) => sentence === INDEPENDENCE) ?? input.story.sentences.find((sentence) => SOUND.test(sentence));
  return said(story);
}

function focusOf(input: ReflectionInput, inWeek: (at: number) => boolean): string | null {
  let newest: SoundCheckEvidence | null = null;
  for (const check of input.checks) {
    if (check.kind !== 'assessed-focus' || !inWeek(check.at)) continue;
    if (newest === null || check.at > newest.at) newest = check;
  }
  const sound = said(soundLine(newest));
  if (sound !== null) return sound;
  // `recent` arrives newest pack first; the first saved this week with a curated correction.
  for (const row of input.recent) {
    if (!inWeek(Date.parse(row.pack.createdAt))) continue;
    const better = said(row.pack.corrections[0]?.better);
    if (better !== null) return better;
  }
  return null;
}

export function reflectionFrom(input: ReflectionInput): Reflection {
  const inWeek = weekOf(input.now);
  const improvement = improvementOf(input, inWeek);
  const focus = focusOf(input, inWeek);
  if (improvement === null && focus === null) return NOTHING;
  const suggested = suggestedMission(input.progress);
  const title = said(suggested?.mission.titleEn);
  const next = suggested !== null && title !== null ? { missionId: suggested.mission.id, title, place: suggested.mission.place } : null;
  return { improvement, focus, next };
}

/** Whether there is anything to draw at all. */
export function hasReflection(reflection: Reflection): boolean {
  return reflection.improvement !== null || reflection.focus !== null || reflection.next !== null;
}
