/**
 * How old the learner is, and what that lets us say about them.
 *
 * This lived inside `onboarding/OnboardingFlow.tsx`, which means it lived
 * somewhere nothing could check it: apps/mobile has no renderer, so a rule
 * inside a component is a rule with no test. It moves here unchanged so both
 * doors can share one copy — the onboarding page that asks, and the upgrade
 * chain that has to read an old date of birth off disk under plain node.
 *
 * The first judgement in this file is `ageConfirmedFromDob`, and its return
 * type is the whole argument: `true | null`, never false. A stored date that
 * puts the learner at thirteen or over is them having answered. Anything else —
 * no date, a mangled date, a date that reads young — is a question nobody asked
 * them, and null is the only honest word for that. Writing false would be the
 * app putting a denial in the learner's mouth.
 *
 * The second is `isUnderAgeStop`, and it is a different question with the same
 * discipline. The tutor's safety policy, not this app, decides that a learner
 * has said in a scene that they are under thirteen. All this file does is
 * recognise that one decision out of the eight the wire can carry, so the one
 * place that recognises it is a function a test can call rather than a
 * condition inside a screen.
 */

import type { SafetyCategory } from '@parle/core';

/** Youngest learner the product is made for. */
export const MIN_AGE = 13;

/**
 * Whole years between the ISO birthday and now. Future birthdays go negative.
 *
 * Anything that is not exactly YYYY-MM-DD gives NaN, which compares false
 * against every bound, so junk is never mistaken for an adult or for a child.
 * The shape is checked rather than split-and-hope on purpose: the loose
 * version read '2013-xx-01' as thirteen years old and '' as two thousand,
 * and this function now runs over blobs off a stranger's disk.
 */
export function ageOn(iso: string, now: Date): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return Number.NaN;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * What a stored date of birth lets us claim about the learner's age.
 *
 * True only when the date puts them at thirteen or over. Everything else is
 * null: not asked, never denied.
 */
export function ageConfirmedFromDob(dob: string | null | undefined, now: Date): true | null {
  if (typeof dob !== 'string') return null;
  return ageOn(dob, now) >= MIN_AGE ? true : null;
}

/**
 * The safety decision this account has to remember, as it arrives on the wire.
 *
 * Only the fields that decide are named, so any caller holding a safety frame
 * fits: `tutor/safetyView.ts`'s `SafetyDecision`, a raw `ServerMessage`, or a
 * test's own object.
 */
export interface AgeStopCandidate {
  category: SafetyCategory;
  action: 'stop' | 'redirect';
}

/**
 * Is this the one decision the account is required to remember?
 *
 * Both halves matter. `under-13` is the category and `stop` is the action, and
 * a redirect in that category — which the policy does not produce today, but
 * could — is the tutor steering the conversation, not the product closing its
 * doors. Every other stop, including the two that also end a session, ends that
 * session and nothing more; none of them is a statement about whether this
 * learner is who Parle is for.
 */
export function isUnderAgeStop(safety: AgeStopCandidate | null | undefined): boolean {
  if (!safety) return false;
  return safety.action === 'stop' && safety.category === 'under-13';
}

/**
 * Is a stop still standing between this learner and the tutor?
 *
 * Reads the one stored field and nothing else, so the answer is the same on
 * every surface that asks. `ageConfirmed` is deliberately not consulted here:
 * a learner who tapped the confirmation and then said in a scene that they are
 * eleven has done both of those things, and the doors close on the second one
 * without the app calling the first one a lie.
 */
export function ageStopStanding(profile: { ageStopAt: number | null } | null | undefined): boolean {
  return typeof profile?.ageStopAt === 'number';
}
