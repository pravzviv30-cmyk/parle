import type { Plan, PlanSpec } from '@luvani/core';

/**
 * The plan catalogue the server last sent, for this run of the app only.
 *
 * The allowances belong to the server. They arrive on the 402 that refuses a
 * session and, since F514, on the 200 that grants one, so any learner who has
 * ever started a session has seen them. The wall's plans page needs them to say
 * what a plan buys in minutes, and this is where it reads them from.
 *
 * Deliberately not a persisted store, for three reasons. A stale allowance is
 * worse than none, because it is a number on a purchase surface that nobody
 * would notice had gone wrong. A device store here costs seven files of registry
 * plumbing that are all held by tests, for one object the server resends on
 * every start. And a copy on disk is a second place the allowance lives, which
 * is the shape of F266 rather than the fix for it.
 *
 * The cost is that a learner who has never started a session has no catalogue,
 * and the plans page says what it can without one. That is the honest trade:
 * the page is reached from a refusal or from the end of the welcome path, and
 * both of those have been through a session start.
 */
let latest: Record<Plan, PlanSpec> | null = null;

/** Remember a catalogue the server sent. A null answer leaves the last one standing. */
export function noteCatalogue(plans: Record<Plan, PlanSpec> | null): void {
  if (plans !== null) latest = plans;
}

/** What the server last said a plan buys, or null if it has not said yet. */
export function latestCatalogue(): Record<Plan, PlanSpec> | null {
  return latest;
}

/** Test seam. Nothing in the app calls this; a module-level value outlives a test otherwise. */
export function forgetCatalogue(): void {
  latest = null;
}
