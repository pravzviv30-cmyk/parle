/**
 * How long a scene is likely to take (F571).
 *
 * Home used to say "Usually five to ten minutes" over everything, which is a
 * sentence about scenes in general rather than about the scene on the card. The
 * moment a screen puts a number in front of somebody, the number has to come
 * from somewhere it can be argued with. So it comes from here, and every scene
 * brief, path row and chooser card reads it as "About N minutes" (the word in
 * full since revamp B, F602; it was "About N min").
 *
 * ## Where the arithmetic comes from
 *
 * A daily scene is three beats of the learner's own side of it, and the beats
 * are the work: four minutes of settling in and saying hello, then about a
 * minute per beat. A mission is longer per beat, because a mission is a scene
 * with a tutor playing a part in it and a beat can be handed back and tried
 * again, so it is three minutes plus a minute and a half each.
 *
 * Both open kinds are then held between five and twelve: a scene with room to
 * wander in is not over in less, and one that says twenty is a card nobody taps
 * on a Tuesday. The clamp bounds an open estimate; a script is bounded by its
 * own lines (below).
 *
 * ## The measured remainder is not clamped
 *
 * A scene left part way has a real measurement behind it: `missions/resume.ts`
 * extrapolates from the pace this learner actually kept through the beats they
 * have already done. That is a fact about them rather than a claim about
 * scenes, so it is passed through untouched. Clamping it would be the app
 * overruling its own measurement to make a nicer-looking number.
 *
 * ## A scripted scene is a minute a line (2026-09-27, notebook Phase 3)
 *
 * The opener, "Le premier café", has three beats and every one of them is a
 * fixed reference line: the learner says three known sentences and the tutor
 * answers. The open-mission formula and its five-minute floor offered it as
 * eight, which is the length of a scene with room to wander in. So a mission
 * whose reference lines cover every beat is estimated as a script, about a
 * minute a line, bounded by one and the ceiling. It is read off the data, not
 * the id: the day a second scene is written that way, it gets the same rule.
 */

import type { Mission } from '@luvani/core';

/** The ways the card can know how long something takes. */
export type Estimate =
  /** A daily scene, by how many beats of the learner's own side it has. */
  | { kind: 'scenario'; lines: number }
  /** A guided mission, by how many beats the frame carries. */
  | { kind: 'mission'; beats: number }
  /** A scene whose every beat is one fixed line, by how many lines. */
  | { kind: 'scripted'; lines: number }
  /** A real remainder, already extrapolated from this learner's own pace. */
  | { kind: 'measured'; minutes: number };

/** Nothing with another person in it is over in less than this. */
export const MIN_MINUTES = 5;

/** Past this a card stops being an invitation and becomes a commitment. */
export const MAX_MINUTES = 12;

/** Settling in, saying hello, and finding out who you are talking to. */
const SCENARIO_OPENING = 4;
const MISSION_OPENING = 3;

/** A mission beat can be handed back and tried again; a daily beat cannot. */
const MISSION_PER_BEAT = 1.5;

function clamp(minutes: number): number {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes));
}

/**
 * How many minutes to say, as a whole number.
 *
 * A measured remainder wins and is passed through: it is the only one of the
 * three that was measured rather than assumed, and the clamp exists to bound an
 * assumption.
 */
export function estimateMinutes(estimate: Estimate): number {
  if (estimate.kind === 'measured') return estimate.minutes;
  if (estimate.kind === 'mission') return clamp(Math.ceil(MISSION_OPENING + MISSION_PER_BEAT * estimate.beats));
  if (estimate.kind === 'scripted') return Math.min(MAX_MINUTES, Math.max(1, estimate.lines));
  return clamp(SCENARIO_OPENING + estimate.lines);
}

/**
 * How a mission is estimated, from its own shape.
 *
 * Scripted when its fixed reference lines cover every beat, otherwise an open
 * mission by its beats. Every surface that says how long a mission takes asks
 * this, so the opener cannot read three on Today and eight on Speak.
 */
export function missionEstimate(mission: Pick<Mission, 'beatIds' | 'referencePhrases'>): Estimate {
  const beats = mission.beatIds.length;
  return mission.referencePhrases.length >= beats ? { kind: 'scripted', lines: beats } : { kind: 'mission', beats };
}

/** The minutes a mission is offered as. */
export function missionMinutes(mission: Pick<Mission, 'beatIds' | 'referencePhrases'>): number {
  return estimateMinutes(missionEstimate(mission));
}

/** "minute" or "minutes", so a measured remainder of one never reads "1 minutes". */
function minutesWord(minutes: number): string {
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

/**
 * The one sanctioned numeral on a scene: a duration, which is a fact about the
 * next few minutes rather than a measurement of the learner. "About", because
 * it is an estimate and not a contract.
 *
 * The word is written in full (revamp B, F602). A resumed scene's measured
 * remainder can be a single minute, so the one reads "About 1 minute".
 */
export function minutesLine(minutes: number): string {
  return `About ${minutesWord(minutes)}`;
}

/**
 * The meta line over the blue scene brief (F602): what kind of scene this is,
 * how long it takes, and who it is with, joined into one plain sentence.
 *
 * "Next scene, about 3 minutes with Alexandre". The minutes are the same
 * words `minutesLine` says, lower-cased because they follow a comma. With no
 * estimate to give, the line says who it is with and nothing it cannot back.
 */
export function sceneMeta(label: string, minutes: number | null, tutorName: string): string {
  if (minutes === null) return `${label}, with ${tutorName}`;
  return `${label}, about ${minutesWord(minutes)} with ${tutorName}`;
}
