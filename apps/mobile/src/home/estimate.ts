/**
 * How long the thing on the hero card is likely to take (F571).
 *
 * Home used to say "Usually five to ten minutes" over everything, which is a
 * sentence about scenes in general rather than about the scene on the card. The
 * founder's mockup asks the card to say "Ready for 7 min", and the moment a
 * screen puts a number in front of somebody, the number has to come from
 * somewhere it can be argued with. So it comes from here.
 *
 * ## Where the arithmetic comes from
 *
 * A daily scene is three beats of the learner's own side of it, and the beats
 * are the work: four minutes of settling in and saying hello, then about a
 * minute per beat. A mission is longer per beat, because a mission is a scene
 * with a tutor playing a part in it and a beat can be handed back and tried
 * again, so it is three minutes plus a minute and a half each.
 *
 * Both are then held between five and twelve. Not because the formulae cannot
 * produce a four or a twenty, but because a card that says "Ready for 3 min" is
 * promising something no conversation with a person in it can keep, and one
 * that says twenty is a card nobody taps on a Tuesday. The clamp is the honest
 * bound on an estimate, and it is the one thing here a learner would notice.
 *
 * ## The measured remainder is not clamped
 *
 * A scene left part way has a real measurement behind it: `missions/resume.ts`
 * extrapolates from the pace this learner actually kept through the beats they
 * have already done. That is a fact about them rather than a claim about
 * scenes, so it is passed through untouched. Clamping it would be the app
 * overruling its own measurement to make a nicer-looking number.
 */

/** The three ways the card can know how long something takes. */
export type Estimate =
  /** A daily scene, by how many beats of the learner's own side it has. */
  | { kind: 'scenario'; lines: number }
  /** A guided mission, by how many beats the frame carries. */
  | { kind: 'mission'; beats: number }
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
  return clamp(SCENARIO_OPENING + estimate.lines);
}

/**
 * The one line on Home with a numeral in it.
 *
 * Every other count was taken off this page on purpose, so this sentence is
 * deliberately the exception and deliberately small: it is a duration, which is
 * a fact about the next few minutes rather than a measurement of the learner.
 * It reads "Ready for" rather than "Takes", because the card is an invitation
 * and not a contract.
 */
export function readyLine(minutes: number): string {
  return `Ready for ${minutes} min`;
}
