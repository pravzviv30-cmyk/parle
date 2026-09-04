/**
 * Learner-facing words for the Tutor landing page.
 *
 * The dashboard is opened many times a day, so its greeting should acknowledge
 * the time without pretending it knows a learner's name when they chose not to
 * share one. Keep that decision out of the screen: a page should draw the
 * greeting, not invent one.
 */

/** Return the first name a learner asked us to use, or null when they skipped it. */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/** A warm, ordinary greeting that changes through the day. */
export function tutorGreeting(name: string | null | undefined, hour = new Date().getHours()): string {
  const lead = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = firstNameOf(name);
  return first === null ? lead : `${lead}, ${first}`;
}

/** The quiet promise underneath the greeting. */
export function tutorGreetingSubline(tutorName: string): string {
  return `${tutorName} is here when you are ready. Speak naturally, zero judgement.`;
}
