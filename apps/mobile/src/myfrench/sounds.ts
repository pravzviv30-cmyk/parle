/**
 * The one honest thing this app says about how a learner sounds.
 *
 * A sound check is the only place in Luvani where audio is measured against a
 * known reference, so it is the only place a pronunciation claim may come from
 * at all. PEDAGOGY.md states the invariant: a score is never invented, implied
 * or displayed unless it was measured that way, and an unscored session says
 * so. Everything else that looks like pronunciation data is not: the offline
 * lesson path builds its observations in `mockSpeech.ts`, the live path keeps
 * real scoring behind a flag, and a spoken drill attempt is scored for one line
 * on screen and then thrown away.
 *
 * ## Why this is a module and not four lines in the screen
 *
 * It was four lines in the screen. `MyFrenchTab.tsx` decided this copy inline,
 * which made it the one judgement on that tab no test could reach: there is no
 * renderer in this workspace, so a rule left in a `.tsx` is a rule nothing
 * defends. Lifting it here is the same move `progress/passport.ts` and
 * `progress/portfolio.ts` already made, and it is what lets the guard below
 * exist at all.
 *
 * ## The guard the shipped version did not have
 *
 * `focus` is the assessor's one learner-safe sentence, and it is written at the
 * moment of the check. My French draws it whenever the learner opens the tab,
 * which may be months later. A sentence like "it came up 4 times today" was
 * true when it was stored and is a small lie by the time it is read, so a focus
 * carrying a digit or a word about time falls back to the timeless line. The
 * check is deliberately blunt for the reason `copy/guilt.ts` gives about its own
 * list: a false positive costs one sentence its detail, a false negative tells
 * a learner something untrue about their own mouth.
 */

import type { SoundCheckEvidence, SoundCheckKind } from '../soundcheck/model.ts';

/** The compact measured-sound door on My French. */
export const SOUND_FINGERPRINT_LABEL = 'Sound fingerprint';

/** What a screen reader hears before the measured line itself. */
export const SOUND_FINGERPRINT_OPEN = 'Open your latest measured sound check';

/**
 * The only two evidence kinds produced by an attempt the assessor measured.
 *
 * Self-guided practice and an unavailable assessor are both valuable practice,
 * but neither is a measurement. Keeping this predicate beside the evidence
 * projection makes it impossible for the surface to turn either one into a
 * pronunciation claim by accident.
 */
export function isMeasuredCheck(check: SoundCheckEvidence): boolean {
  return check.kind === 'assessed-focus' || check.kind === 'assessed-clear';
}

/** The newest genuinely measured check across every situation, or null. */
export function latestMeasuredCheck(checks: readonly SoundCheckEvidence[]): SoundCheckEvidence | null {
  let newest: SoundCheckEvidence | null = null;
  for (const check of checks) {
    if (!isMeasuredCheck(check)) continue;
    if (newest === null || check.at > newest.at) newest = check;
  }
  return newest;
}

export interface SoundFingerprint {
  /** The measured scene the compact row reopens. */
  missionId: string;
  /** The timeless, learner-safe sentence under the row label. */
  line: string;
}

/**
 * The truthful compact view of measured sound evidence, or no surface at all.
 *
 * `soundLine` owns the wording guard for stored focus sentences, so a dated or
 * counted assessor sentence cannot leak onto a page opened months later.
 */
export function soundFingerprint(checks: readonly SoundCheckEvidence[]): SoundFingerprint | null {
  const measured = latestMeasuredCheck(checks);
  if (measured === null) return null;
  const line = soundLine(measured);
  return line === null ? null : { missionId: measured.missionId, line };
}

/** What each kind of check is allowed to say, and the fallback when a focus cannot be trusted. */
export const SOUND_LINES = {
  focus: 'One sound is ready to revisit',
  clear: 'No single sound needed calling out',
  selfGuided: 'Last line was practised without assessment',
  unavailable: 'Last check did not return enough evidence',
} as const;

/**
 * Words that make a stored sentence a claim about when, rather than about what.
 *
 * Substring matched over a lowercased line, on `copy/guilt.ts`'s reasoning.
 */
const TIME_WORDS: readonly string[] = ['today', 'yesterday', 'tonight', 'this morning', 'just now', 'this week'];

/** The most recent check for one situation, or null when it has never been checked. */
export function latestCheck(
  missionId: string,
  checks: readonly SoundCheckEvidence[],
): SoundCheckEvidence | null {
  let best: SoundCheckEvidence | null = null;
  for (const item of checks) {
    if (item.missionId !== missionId) continue;
    if (best === null || item.at > best.at) best = item;
  }
  return best;
}

/**
 * Whether a stored focus sentence still says something true when read later.
 *
 * Exported so the test can walk it directly rather than through four kinds.
 */
export function timeless(focus: string): boolean {
  const line = focus.toLowerCase();
  if (/\d/.test(line)) return false;
  return !TIME_WORDS.some((word) => line.includes(word));
}

/** The line under one situation's row, or null when there is nothing honest to say. */
export function soundLine(check: SoundCheckEvidence | null): string | null {
  if (check === null) return null;
  const kinds: Record<SoundCheckKind, string> = {
    'assessed-focus': SOUND_LINES.focus,
    'assessed-clear': SOUND_LINES.clear,
    'self-guided': SOUND_LINES.selfGuided,
    unavailable: SOUND_LINES.unavailable,
  };
  if (check.kind !== 'assessed-focus') return kinds[check.kind];
  const focus = check.focus;
  if (focus === null || focus === '') return SOUND_LINES.focus;
  return timeless(focus) ? focus : SOUND_LINES.focus;
}
