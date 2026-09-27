/**
 * The focused sound journey (Stage 4, item 2): one sound, across the measured
 * checks that called it out, and the lines that later came back clear.
 *
 * My French's fingerprint says one true thing about the newest measured check.
 * This says the next true thing, and only once there is enough to say it: at
 * least two measured checks, at least one of which named a sound this build
 * knows. Below that bar there is no journey, and the fingerprint alone stays.
 *
 * ## What counts, and what never moves it
 *
 * Only `isMeasuredCheck` rows are evidence (`myfrench/sounds.ts`). A self-guided
 * attempt, an unavailable assessor and a refused microphone (recorded as
 * self-guided, `model.ts` MIC_DENIED) are practice, and they are counted as
 * practice and nothing else: they never change which sound this is, how often
 * it was called out, or which line came back clear. A row stamped after `now`,
 * a row whose time is not a number, and a row naming a situation this build
 * does not know are left out entirely.
 *
 * ## Improvement is a claim about one line, never about a sound
 *
 * An `assessed-clear` row carries no phoneme, so "your /y/ got better" is
 * something no stored fact can support. What can be said is narrower and true:
 * this exact reference line, in this situation, was flagged, and a later
 * measured check of the same line called nothing out. "Later" is strict, and
 * any measured check of that line that called something out afterwards (this
 * sound, another sound, or a legacy row that named none) takes the claim away.
 *
 * No score, grid, percentage, trend or mastery word appears anywhere, and the
 * only number the surface prints is how many measured checks called the sound
 * out.
 */

import { getMission, type MissionId } from '@luvani/core';

import { SOUND_FINGERPRINT_OPEN, isMeasuredCheck, timeless } from '../myfrench/sounds.ts';
import { soundExampleWord } from '../tutor/soundExample.ts';
import { nextSoundCheckReference, type SoundCheckEvidence } from './model.ts';

/** One reference line the sound was called out on. */
export interface SoundJourneyLine {
  missionId: MissionId;
  reference: string;
  /** The newest measured check that called this sound out on this line. */
  lastFlaggedAt: number;
  /** When the same line was later measured with nothing called out, or null. */
  clearAt: number | null;
}

export interface SoundJourney {
  /** IPA, for the optional detail only. The surface leads with `example`. */
  phoneme: string;
  /** The inventory's own example word for the sound. */
  example: string;
  /** Measured checks that called this sound out. The one number the surface shows. */
  flaggedTimes: number;
  /** The situations it was called out in, each once, most recent first. */
  situations: MissionId[];
  lastFlaggedAt: number;
  /** The same reference line later measured 'assessed-clear'. */
  laterClear: { missionId: MissionId; reference: string; at: number }[];
  /** Every line it was called out on, most recent first. */
  lines: SoundJourneyLine[];
  /** The newest assessor sentence about it, only while it is still true. */
  focus: string | null;
  /** Self-guided and unavailable attempts. A count kept, never drawn as a number. */
  unmeasured: number;
}

/** Everything the journey screen says in its own voice. */
export const JOURNEY_COPY = {
  label: 'Your focus sound',
  purpose: 'Only sound checks the assessor measured count here.',
  linesLabel: 'Where it was called out',
  lineClear: 'That line came back with nothing called out.',
  again: 'Check this line again',
  againSituation: 'Check a line from this situation',
  unmeasured: 'Lines you said without assessment are practice, and are not counted here.',
  loading: 'Reading your sound checks.',
  unread: 'Your sound checks could not be loaded just now.',
  retry: 'Try again',
  none: 'Your focus sound appears here after more than one measured check, once one of them calls out a sound.',
  /** The empty state's way on, in the sound check's own cold-state words. */
  choose: 'Choose a situation',
} as const;

/** What a screen reader hears on My French's sound row when it opens the journey. */
export const SOUND_JOURNEY_OPEN = 'Open your focus sound';

/** The sound row's accessible name, for whichever screen it opens. */
export function soundDoorLabel(journey: SoundJourney | null): string {
  return journey === null ? SOUND_FINGERPRINT_OPEN : SOUND_JOURNEY_OPEN;
}

/** "Called out once, on a line from …" or "Called out 3 times, most recently on a line from …". */
export function calledOutLine(times: number, situation: string): string {
  return times === 1
    ? `Called out once, on a line from ${situation}.`
    : `Called out ${times} times, most recently on a line from ${situation}.`;
}

/** A row the journey may read at all. */
function usable(check: SoundCheckEvidence, now: number): boolean {
  return Number.isFinite(check.at) && check.at <= now && getMission(check.missionId) !== undefined;
}

/** The IPA of a focus row, when it names a sound the inventory can give a word for. */
function namedSound(check: SoundCheckEvidence): string | null {
  if (check.kind !== 'assessed-focus') return null;
  const ipa = check.phoneme ?? '';
  if (ipa === '') return null;
  return soundExampleWord(ipa) === null ? null : ipa;
}

const lineKey = (check: { missionId: string; reference: string }): string => `${check.missionId}\u0000${check.reference}`;

export function soundJourney(checks: readonly SoundCheckEvidence[], now: number): SoundJourney | null {
  const valid = checks.filter((check) => usable(check, now));
  const measured = valid.filter(isMeasuredCheck);
  if (measured.length < 2) return null;

  const named = measured
    .filter((check) => namedSound(check) !== null)
    .sort((a, b) => b.at - a.at);
  const head = named[0];
  if (head === undefined) return null;
  const phoneme = head.phoneme!;
  const example = soundExampleWord(phoneme)!;

  const flagged = named.filter((check) => check.phoneme === phoneme);

  const situations: MissionId[] = [];
  const byLine = new Map<string, SoundJourneyLine>();
  for (const check of flagged) {
    const mission = getMission(check.missionId)!;
    if (!situations.includes(mission.id)) situations.push(mission.id);
    const key = lineKey(check);
    if (!byLine.has(key)) byLine.set(key, { missionId: mission.id, reference: check.reference, lastFlaggedAt: check.at, clearAt: null });
  }

  for (const line of byLine.values()) {
    const same = measured.filter((check) => lineKey(check) === lineKey(line));
    const lastCalledOut = Math.max(...same.filter((check) => check.kind === 'assessed-focus').map((check) => check.at));
    const clears = same.filter((check) => check.kind === 'assessed-clear' && check.at > lastCalledOut);
    line.clearAt = clears.length === 0 ? null : Math.max(...clears.map((check) => check.at));
  }

  const lines = [...byLine.values()].sort((a, b) => b.lastFlaggedAt - a.lastFlaggedAt);
  const focus = head.focus !== null && head.focus.trim() !== '' && timeless(head.focus) ? head.focus : null;

  return {
    phoneme,
    example,
    flaggedTimes: flagged.length,
    situations,
    lastFlaggedAt: head.at,
    laterClear: lines.flatMap((line) =>
      line.clearAt === null ? [] : [{ missionId: line.missionId, reference: line.reference, at: line.clearAt }],
    ),
    lines,
    focus,
    unmeasured: valid.length - measured.length,
  };
}

/**
 * The reference line the sound check will open on for this situation, or null.
 *
 * The same call `SoundCheckScreen` makes on the same store, so the answer is
 * the line the learner will actually be asked to say.
 */
export function checkOpensOn(missionId: string, checks: readonly SoundCheckEvidence[]): string | null {
  const mission = getMission(missionId);
  return mission === undefined ? null : nextSoundCheckReference(mission, checks);
}

/** "Check this line again" only when that is the line the check opens on. */
export function againLabel(
  line: { missionId: string; reference: string },
  checks: readonly SoundCheckEvidence[],
): string {
  return checkOpensOn(line.missionId, checks) === line.reference ? JOURNEY_COPY.again : JOURNEY_COPY.againSituation;
}
