/**
 * The CEFR spine: the order scenes are offered in, and what a learner has
 * earned along it.
 *
 * A projection, like `missionStates`, and nothing more. There is no level store
 * and no second scale: "earned" is {@link isEarned}, the rule the passport stamp
 * already uses, and the level is read off which A0 and A1 scenes are earned.
 * Screens use this to say "You'll be able to..." and to draw the path from A0
 * through A1 to A2. They never
 * show a rank name, a date or a promise of a level.
 *
 * The spine orders what is offered. It does not gate: every mission stays open
 * in any order, on the rule `suggestedMission` records.
 */

import type { CefrLevel } from '../lessons/types.ts';
import { isLearnerGoal, type LearnerGoal } from '../firstPractice.ts';
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
  'mission:restaurant',
  'mission:pharmacie',
  'mission:gare',
  'mission:colis',
  'mission:voisin',
  'mission:week-end',
  'mission:collegues',
  'mission:telephone',
  'mission:medecin',
  'mission:retour',
  'mission:appartement',
  'mission:belle-famille',
];

export interface SpineView {
  /**
   * 'A0' until every A0 mission is earned, then 'A1'. 'A2' only once every A0
   * AND every A1 mission is earned. A helped finish earns nothing, so it never
   * moves the level.
   */
  level: CefrLevel;
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
  const allEarnedAt = (cefr: CefrLevel): boolean =>
    spine.filter((mission) => mission.cefr === cefr).every((mission) => earnedIds.has(mission.id));
  const level: CefrLevel = !allEarnedAt('A0') ? 'A0' : !allEarnedAt('A1') ? 'A1' : 'A2';

  return { level, next, earned };
}

/**
 * The scenes each onboarding goal leans towards, most wanted first. 'because'
 * has none: a learner learning for its own sake just walks the spine.
 */
export const GOAL_SCENES: Readonly<Record<Exclude<LearnerGoal, 'because'>, readonly MissionId[]>> = {
  moving: ['mission:appartement', 'mission:medecin', 'mission:voisin', 'mission:colis', 'mission:pharmacie', 'mission:telephone', 'mission:retour'],
  trip: ['mission:gare', 'mission:restaurant', 'mission:chemin', 'mission:hotel', 'mission:pharmacie'],
  food: ['mission:cafe', 'mission:restaurant', 'mission:marche'],
  family: ['mission:belle-famille', 'mission:amis', 'mission:journee', 'mission:week-end'],
  work: ['mission:collegues', 'mission:telephone', 'mission:week-end', 'mission:journee'],
};

export interface NextScene {
  mission: Mission;
  /** 'goal' when the learner's goal chose it, 'spine' when it is plain `spineFrom().next`. */
  picked: 'goal' | 'spine';
}

const REACH: Readonly<Record<CefrLevel, CefrLevel>> = { A0: 'A1', A1: 'A2', A2: 'A2' };
const CEFR_RANK: Readonly<Record<CefrLevel, number>> = { A0: 0, A1: 1, A2: 2 };

/**
 * The scene to suggest next, leaning towards the learner's goal.
 *
 * Ordering only. It never gates a scene and never changes the level: the level
 * still comes only from earned scenes, through {@link spineFrom}. Until the
 * learner has earned a scene it is the spine's next scene (the opener), so a
 * brand-new learner always starts on the first coffee. After that, the first
 * unearned goal scene at most one band above the learner's level wins; with no
 * such scene, or no usable goal ('because', missing, unknown), it is the spine's
 * next scene. Pure and unstored.
 */
export function nextScene(progress: readonly MissionProgress[], goal: LearnerGoal | null | undefined): NextScene | null {
  const view = spineFrom(progress);
  const earnedIds = earnedMissionIds(progress);
  if (earnedIds.size > 0 && isLearnerGoal(goal) && goal !== 'because') {
    const reach = CEFR_RANK[REACH[view.level]];
    for (const id of GOAL_SCENES[goal]) {
      const mission = getMission(id);
      if (mission && !earnedIds.has(id) && CEFR_RANK[mission.cefr] <= reach) return { mission, picked: 'goal' };
    }
  }
  return view.next ? { mission: view.next, picked: 'spine' } : null;
}
