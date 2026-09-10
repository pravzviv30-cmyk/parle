import { MISSIONS, type Mission, type MissionId } from '@luvani/core';

/**
 * The four situations the free thirty minutes covers.
 *
 * The free tier is thirty seconds shy of half an hour of live speaking, granted
 * once and never renewed, and until now nothing in the app drew a shape around
 * it. A balance is the wrong shape: a learner watching a number fall is being
 * metered, and `secondsRemaining` lives on the server where the phone cannot see
 * it honestly anyway (F239, F377). A path is the right shape, and the catalogue
 * was already a path — six authored situations, each ending in a checkable fact
 * rather than praise.
 *
 * Four of the six, not all six, and the reasons are in this order:
 *
 * 1. Thirty minutes across six scenes leaves no slack. `MIN_VIABLE_SESSION_SEC`
 *    is two minutes, so the last two of the thirty cannot start anything, and
 *    the real ceiling is nearer twenty-eight. Most learners would meet the wall
 *    mid-path, which is the fuel-gauge feeling this shape exists to avoid.
 * 2. Holding two back gives the wall something specific to offer. A fully lit
 *    map has nothing left to want, and the plans page would have to sell in the
 *    abstract. `journee` and `amis` are authored, named, and already carry their
 *    own `goalEn`, so the wall can say what they are in the catalogue's words.
 * 3. The ladder climbs across these four: A0, A0, A1, A1. The two held back are
 *    the longest and most social, which is the right place for a paid tier to
 *    begin rather than the right place for a free one to end.
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
