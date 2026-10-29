/**
 * The CEFR spine: the order scenes are offered in, and what a learner has
 * earned along it.
 *
 * A projection, like `missionStates`, and nothing more. There is no level store
 * and no second scale: "earned" is {@link isEarned}, the rule the passport stamp
 * already uses, and the level is read off which A0, A1 and A2 scenes are earned.
 * Screens use this to say "You'll be able to..." and to draw the path from A0
 * up to B1. They never
 * show a rank name, a date or a promise of a level.
 *
 * The spine orders what is offered. It does not gate: every mission stays open
 * in any order, on the rule `suggestedMission` records.
 */

import { isLearnerGoal, type LearnerGoal } from '../firstPractice.ts';
import { earnedMissionIds, getMission, type Mission, type MissionId, type MissionLevel, type MissionProgress } from './missions.ts';

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
  'mission:club',
  'mission:banque',
  'mission:sortie',
  'mission:montreal',
  'mission:coup-de-main',
  'mission:anniversaire',
  'mission:fuite',
  'mission:avis',
  'mission:galere',
  'mission:teletravail',
  'mission:souvenirs',
  'mission:entretien',
];

export interface SpineView {
  /**
   * 'A0' until every A0 mission is earned, then 'A1'. 'A2' only once every A0
   * AND every A1 mission is earned. 'B1' only once every A0, A1 AND A2
   * mission is earned. A helped finish earns nothing, so it never
   * moves the level.
   */
  level: MissionLevel;
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
  const allEarnedAt = (cefr: MissionLevel): boolean =>
    spine.filter((mission) => mission.cefr === cefr).every((mission) => earnedIds.has(mission.id));
  const level: MissionLevel = !allEarnedAt('A0') ? 'A0' : !allEarnedAt('A1') ? 'A1' : !allEarnedAt('A2') ? 'A2' : 'B1';

  return { level, next, earned };
}

/**
 * The scenes each onboarding goal leans towards, most wanted first. 'because'
 * has none: a learner learning for its own sake just walks the spine.
 */
export const GOAL_SCENES: Readonly<Record<Exclude<LearnerGoal, 'because'>, readonly MissionId[]>> = {
  moving: [
    'mission:appartement', 'mission:banque', 'mission:medecin', 'mission:voisin', 'mission:colis', 'mission:pharmacie',
    'mission:telephone', 'mission:retour', 'mission:club', 'mission:montreal', 'mission:fuite',
  ],
  trip: ['mission:gare', 'mission:restaurant', 'mission:chemin', 'mission:hotel', 'mission:pharmacie'],
  food: ['mission:cafe', 'mission:restaurant', 'mission:marche'],
  family: [
    'mission:belle-famille', 'mission:anniversaire', 'mission:amis', 'mission:journee', 'mission:week-end', 'mission:souvenirs',
    'mission:galere',
  ],
  work: [
    'mission:collegues', 'mission:telephone', 'mission:coup-de-main', 'mission:week-end', 'mission:journee', 'mission:entretien',
    'mission:teletravail',
  ],
};

export interface NextScene {
  mission: Mission;
  /** 'goal' when the learner's goal chose it, 'spine' when it is plain `spineFrom().next`. */
  picked: 'goal' | 'spine';
}

const REACH: Readonly<Record<MissionLevel, MissionLevel>> = { A0: 'A1', A1: 'A2', A2: 'B1', B1: 'B1' };
const CEFR_RANK: Readonly<Record<MissionLevel, number>> = { A0: 0, A1: 1, A2: 2, B1: 3 };

/**
 * The scene to suggest next, leaning towards the learner's goal.
 *
 * Ordering only. It never gates a scene and never changes the level: the level
 * still comes only from earned scenes, through {@link spineFrom}. Until the
 * learner has earned a scene it is the spine's next scene (the opener), so a
 * brand-new learner always starts on the first coffee. After that, the first
 * unearned goal scene at most one band above the learner's level wins; with no
 * such scene, or no usable goal ('because', missing, unknown), it is the spine's
 * next scene.
 *
 * `startAt` is the learner's placement (F917, mobile `onboarding/placement.ts`):
 * the band suggestions start at. It is a starting point, never evidence: it
 * moves no level and earns nothing, and the scenes below it stay open to pick.
 * With it the goal leads from the very first suggestion (the opener rule is
 * for a learner starting at the bottom): the first unearned goal scene from the
 * placement's band up to the reach, else the first unearned spine scene at or
 * above it. Goal scenes below it are passed over, and the reach is never below
 * it. With empty progress this is exactly the plan's `firstSceneFor` (mobile
 * `onboarding/plan.ts`), so the plan and Home name one first scene. Once every
 * scene at or above it is earned, the skipped scenes are offered again. Pure
 * and unstored.
 */
export function nextScene(
  progress: readonly MissionProgress[],
  goal: LearnerGoal | null | undefined,
  startAt: MissionLevel | null = null,
): NextScene | null {
  const view = spineFrom(progress);
  const earnedIds = earnedMissionIds(progress);
  const floor = startAt !== null && startAt in CEFR_RANK ? CEFR_RANK[startAt] : 0;
  if ((earnedIds.size > 0 || floor > 0) && isLearnerGoal(goal) && goal !== 'because') {
    const reach = Math.max(CEFR_RANK[REACH[view.level]], floor);
    for (const id of GOAL_SCENES[goal]) {
      const mission = getMission(id);
      const rank = mission ? CEFR_RANK[mission.cefr] : -1;
      if (mission && !earnedIds.has(id) && rank >= floor && rank <= reach) return { mission, picked: 'goal' };
    }
  }
  if (floor > 0) {
    for (const id of SCENE_SPINE) {
      const mission = getMission(id);
      if (mission && !earnedIds.has(id) && CEFR_RANK[mission.cefr] >= floor) return { mission, picked: 'spine' };
    }
  }
  return view.next ? { mission: view.next, picked: 'spine' } : null;
}
