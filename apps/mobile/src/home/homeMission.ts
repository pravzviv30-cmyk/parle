/**
 * Tonight's French: the one situation Home leads with (F543).
 *
 * Home used to open on the word of the day and offer the next situation as a
 * row near the foot. The founder's brief and both mockups open on one real
 * situation with a reason and a time, and the word lower down, because the
 * question a learner brings to the first screen is "what shall I do tonight",
 * not "what is a word". This module answers it and the hero draws the answer.
 *
 * Three kinds, in priority. A scene the learner walked out of part way is
 * offered back first, because they meant that scene whatever the deck says is
 * due. Otherwise core's own next situation, with the chooser's own status line
 * as the reason, so Home and the chooser never disagree about where a scene
 * stands. A learner who has never spoken meets the café and the chooser's
 * promise, on `chooserView`'s rule that a beginner is sent to the guided
 * situations rather than to a fixed script.
 *
 * ## The time line is a measurement or an expectation, never a guess
 *
 * `missions/resume.ts` extrapolates minutes from the learner's own pace, and
 * says nothing when it has nothing to extrapolate from. That is the only
 * number on the card. A scene not yet started says what scenes usually take,
 * in words, as an expectation rather than a measurement: "Usually five to ten
 * minutes" is a claim about scenes, not about this learner.
 *
 * ## The fallback claims nothing
 *
 * A storage read that fails still leaves a hero on the page, on the café,
 * with the chooser's own "ready when you are" and the expectation line. Both
 * are true of the café for every learner alive, so nothing about this learner
 * is invented; what a failed read withholds is the resume, the reason from
 * their history, and the abilities beneath.
 */

import { FIRST_MISSION, MISSIONS, suggestedMission, type Mission, type MissionProgress } from '@luvani/core';

import { PROMISE, missionStatus } from '../missions/chooserView.ts';
import type { ScenarioRecord } from '../missions/progressStore.ts';
import { minutesRemaining } from '../missions/resume.ts';
import { minutesRemainingLine } from '../tutor/gate.ts';
import { localHour } from './greeting.ts';

export type HomeMissionKind = 'resume' | 'next' | 'first';

export interface HomeMission {
  kind: HomeMissionKind;
  mission: Mission;
  /** The caps line over the card: what kind of offer this is. */
  label: string;
  /** One line saying why this scene, from the chooser's own status or the promise. */
  reason: string;
  /** How long: a measurement when there is one, an expectation in words when not. */
  timeLine: string;
}

export const HERO_LABELS = {
  resume: 'Pick up where you left off',
  first: 'Your first French',
  evening: "This evening's French",
  day: "Today's French",
} as const;

export const EXPECTED_TIME = 'Usually five to ten minutes';
export const RESUME_REASON = 'You were part way through this one.';
export const START_CONVERSATION = 'Start conversation';

/** Every line this module can say, for the copy sweeps. */
export const HERO_COPY: readonly string[] = [...Object.values(HERO_LABELS), EXPECTED_TIME, RESUME_REASON, START_CONVERSATION];

/** The greeting's own evening: from six until the small hours. */
export function heroLabel(now: number): string {
  const hour = localHour(now);
  return hour >= 18 || hour < 5 ? HERO_LABELS.evening : HERO_LABELS.day;
}

/** The scene most recently walked out of and not finished since, or null. */
function leftPartWay(
  progress: readonly MissionProgress[],
  records: readonly ScenarioRecord[],
): { progress: MissionProgress; record: ScenarioRecord } | null {
  let best: { progress: MissionProgress; record: ScenarioRecord } | null = null;
  for (const record of records) {
    const mine = progress.find((p) => p.mission.id === record.missionId);
    if (mine === undefined) continue;
    if (mine.lastFinishedAt !== null && record.at <= mine.lastFinishedAt) continue;
    if (best === null || record.at > best.record.at) best = { progress: mine, record };
  }
  return best;
}

export function homeMissionFrom(input: {
  progress: readonly MissionProgress[];
  records: readonly ScenarioRecord[];
  spokenBefore: boolean;
  now: number;
}): HomeMission | null {
  if (input.progress.length === 0) return null;

  if (!input.spokenBefore) {
    const first = input.progress.find((p) => p.mission.id === FIRST_MISSION) ?? input.progress[0]!;
    return { kind: 'first', mission: first.mission, label: HERO_LABELS.first, reason: PROMISE, timeLine: EXPECTED_TIME };
  }

  const left = leftPartWay(input.progress, input.records);
  if (left !== null) {
    const minutes = minutesRemaining(left.record, left.progress.mission.beatIds.length, left.progress.lastFinishedAt);
    return {
      kind: 'resume',
      mission: left.progress.mission,
      label: HERO_LABELS.resume,
      reason: RESUME_REASON,
      timeLine: minutes === null ? EXPECTED_TIME : minutesRemainingLine(minutes),
    };
  }

  const next = suggestedMission(input.progress) ?? input.progress[0]!;
  return {
    kind: 'next',
    mission: next.mission,
    label: heroLabel(input.now),
    reason: missionStatus(next.state, next.independence),
    timeLine: EXPECTED_TIME,
  };
}

/**
 * The hero for a page whose storage read failed: the café, offered as today's
 * French with the chooser's line for a scene nobody has started. True of the
 * café for everyone, so it claims nothing about the learner who could not be
 * read, and it keeps the page's one pill on the page.
 */
export function fallbackHero(now: number): HomeMission {
  const cafe = MISSIONS.find((mission) => mission.id === FIRST_MISSION) ?? MISSIONS[0]!;
  return { kind: 'next', mission: cafe, label: heroLabel(now), reason: missionStatus('new', 'new'), timeLine: EXPECTED_TIME };
}
