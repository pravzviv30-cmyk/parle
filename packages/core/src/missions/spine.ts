/**
 * The CEFR spine: the order scenes are offered in, and what a learner has
 * earned along it.
 *
 * A projection, like `missionStates`, and nothing more. There is no level store
 * and no second scale: "earned" is {@link isEarned}, the rule the passport stamp
 * already uses, and the level is read off which A0 scenes are earned. Screens use
 * this to say "You'll be able to..." and to draw the A0 to A1 path. They never
 * show a rank name, a date or a promise of a level.
 *
 * The spine orders what is offered. It does not gate: every mission stays open
 * in any order, on the rule `suggestedMission` records.
 */

import { earnedMissionIds, getMission, type Mission, type MissionId, type MissionProgress } from './missions.ts';

/** Every mission once, in the order a learner is walked through them. */
export const SCENE_SPINE: readonly MissionId[] = [
  'mission:premier-cafe',
  'mission:cafe',
  'mission:hotel',
  'mission:marche',
  'mission:chemin',
  'mission:journee',
  'mission:amis',
];

export interface SpineView {
  /** 'A1' only once every A0 mission is earned. */
  level: 'A0' | 'A1';
  /** The first unearned mission on the spine, or null when all are earned. */
  next: Mission | null;
  /** Earned missions, in spine order. */
  earned: readonly Mission[];
}

/**
 * Where a learner stands on the spine, from the progress `missionStates` built.
 *
 * Pure and unstored. A mission missing from `progress` counts as not earned,
 * so a partial list can only understate, never overclaim.
 */
export function spineFrom(progress: readonly MissionProgress[]): SpineView {
  // Earned directly or through a bigger scene: the full café earns the opener.
  const earnedIds: ReadonlySet<MissionId> = earnedMissionIds(progress);
  const spine = SCENE_SPINE.map((id) => getMission(id)).filter((mission): mission is Mission => mission !== undefined);

  const earned = spine.filter((mission) => earnedIds.has(mission.id));
  const next = spine.find((mission) => !earnedIds.has(mission.id)) ?? null;
  const level = spine.filter((mission) => mission.cefr === 'A0').every((mission) => earnedIds.has(mission.id)) ? 'A1' : 'A0';

  return { level, next, earned };
}
