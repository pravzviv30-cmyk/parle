import { MISSIONS, type Mission, type MissionId } from '@luvani/core';

/**
 * The four situations the free plan walks through.
 *
 * The free plan is one ten-minute conversation (REV-001, 2026-10-23),
 * coming back 44 hours after the window's first use. That is one scene every
 * other day: `MIN_VIABLE_SESSION_SEC` is two minutes, so a window holds a few
 * short starts at most, and usually one conversation. So this is a path walked
 * over days, not in one sitting, and nothing here pretends one free window
 * holds the whole of it. A
 * balance is still the wrong shape: a learner watching a number fall is being
 * metered (F239, F377). A path is the right shape, and the catalogue was
 * already one: six authored situations, each ending in a checkable fact.
 *
 * Four of the six, not all six:
 *
 * 1. Holding two back gives the wall something specific to offer. A fully lit
 *    map has nothing left to want. `journee` and `amis` are authored, named,
 *    and carry their own `goalEn`, so the wall can say what they are in the
 *    catalogue's words.
 * 2. The ladder climbs across these four: A0, A0, A1, A1. The two held back are
 *    the longest and most social, the right place for a paid tier to begin.
 * 3. Four weeks of a free scene each is a month of the product working, which
 *    is long enough to know whether it is worth paying for.
 *
 * Order is meaning, not display. Cafe is first for the reason `MISSIONS` states
 * about itself: it is the shortest path from "I speak no French" to "I said a
 * French sentence to a French person and it worked".
 *
 * This is a packaging decision, and packaging decisions are the client's. The
 * server meters seconds and neither knows nor cares which room they were spent
 * in, which is why this list lives beside the wall it justifies rather than in
 * `PLANS`. Nothing here is enforcement: a learner who somehow reaches a held
 * back room is stopped by the 402 at the door, not by this array.
 */
export const WELCOME_PATH: readonly MissionId[] = [
  'mission:cafe',
  'mission:hotel',
  'mission:marche',
  'mission:chemin',
];

/** Whether a situation is part of the free path. */
export function onWelcomePath(id: MissionId): boolean {
  return WELCOME_PATH.includes(id);
}

/**
 * The situations a plan opens, in catalogue order.
 *
 * Derived rather than listed, so the two halves cannot drift into overlapping or
 * into leaving a mission in neither.
 */
export function beyondWelcomePath(): readonly Mission[] {
  return MISSIONS.filter((mission) => !onWelcomePath(mission.id));
}

/** The path's situations, in path order rather than catalogue order. */
export function welcomeMissions(): readonly Mission[] {
  return WELCOME_PATH.map((id) => {
    const mission = MISSIONS.find((candidate) => candidate.id === id);
    // A typo in the array above would otherwise draw three rows and no error.
    if (!mission) throw new Error(`WELCOME_PATH names ${id}, which is not in MISSIONS`);
    return mission;
  });
}
