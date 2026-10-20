/**
 * What the Then and now screen decides (2026-10-20, B4, artboard B-ThenNow).
 *
 * One row per guided scene: the first try we still have next to the best, each
 * in the ladder's help words, and a way back into the scene. Derived here in
 * mobile from the stored completions. There is no second ladder: the four
 * words are `HELP_WORDS`, and the best is core's best-ever rule
 * (`independenceFrom`), read as the try that reached it so its date is said.
 * Earned is core's `earnedMissionIds`, the rule the tab and the spine read.
 *
 * Retention keeps a mission's most recent completions plus its best
 * (`missions/retain.ts`, at most `COMPLETIONS_PER_MISSION`). Once a mission is
 * at that cap its very first try may have been dropped, so the row says "First
 * try we still have" there and "First" everywhere else.
 *
 * Free conversations have no guided steps and never appear. This module and
 * its screen read no plan and no continue-arc answer; the lock is the access
 * seam's alone.
 */

import { SCENE_SPINE, earnedMissionIds, getMission, spineFrom, type Mission, type MissionProgress, type Rung } from '@luvani/core';

import { featureAccess } from '../access/featureAccess.ts';
import { HELP_WORDS } from '../tutor/speakTabView.ts';
import { bestOf, earnedThroughBigger, firstLabel, segmentsText, shortDate, triesOf, TRY_AGAIN_FOR_BEST, type Access, type JourneyRoute, type Segment, type StoredCompletion } from './journeyView.ts';

export const THEN_NOW_TITLE = 'Then and now';
export const THEN_NOW_INTRO = 'Your first try at each guided scene, next to your best. Your best never goes backwards, even on a tired day.';
export const LEGEND_LABEL = 'How much help you needed';
export const THEN_NOW_FOOTER = 'Free conversations don’t appear here, because they don’t have guided steps.';
export const TRY_IT_AGAIN = 'Try it again';

export const STATUS = {
  earned: 'Ability earned',
  once: 'Tried once',
  helped: 'Practised with help',
  untried: 'Not tried yet',
} as const;

/** The four help words, in ladder order: most help first. */
export const LEGEND: readonly string[] = ([1, 2, 3, 4] as const).map((rung: Rung) => HELP_WORDS[rung]);

export interface ThenNowRow {
  missionId: string;
  scene: string;
  status: string;
  /** Under the status, for a scene earned through the bigger one containing it. */
  note: readonly Segment[] | null;
  first: { label: string; help: string } | null;
  best: { label: string; help: string } | null;
  /** Said under a single try in place of a best. */
  hint: string | null;
  route: JourneyRoute | null;
  accessibilityLabel: string;
}

export interface ThenNowView {
  rows: readonly ThenNowRow[];
  locked: boolean;
}

/** Which guided scenes the screen lists: this stage's, plus any already tried. */
function scenesShown(progress: readonly MissionProgress[], tried: ReadonlySet<string>): Mission[] {
  const stage = spineFrom(progress).level;
  return SCENE_SPINE.map((id) => getMission(id)).filter((m): m is Mission => m !== undefined && (m.cefr === stage || tried.has(m.id)));
}

export function thenNowView(input: { progress: readonly MissionProgress[]; completions: readonly StoredCompletion[]; access?: Access }): ThenNowView {
  const access = input.access ?? featureAccess;
  const tried = new Set(input.completions.map((c) => c.id));
  // The same earned rule as the tab and the spine: a bigger scene earned on
  // your own earns the scene it contains.
  const earnedIds: ReadonlySet<string> = earnedMissionIds(input.progress);
  const rows = scenesShown(input.progress, tried).map((mission): ThenNowRow => {
    const tries = triesOf(input.completions, mission.id);
    const note = earnedThroughBigger(mission.id, earnedIds, input.completions);
    if (tries.length === 0) {
      if (note !== null) {
        return { missionId: mission.id, scene: mission.title, status: STATUS.earned, note, first: null, best: null, hint: null, route: { screen: 'ScenePreview', params: { missionId: mission.id } }, accessibilityLabel: `${mission.title}. ${STATUS.earned}. ${segmentsText(note)}` };
      }
      return { missionId: mission.id, scene: mission.title, status: STATUS.untried, note: null, first: null, best: null, hint: null, route: null, accessibilityLabel: `${mission.title}. ${STATUS.untried}` };
    }
    const first = tries[0]!;
    const best = bestOf(tries)!;
    const status = earnedIds.has(mission.id) ? STATUS.earned : tries.length === 1 ? STATUS.once : STATUS.helped;
    const firstCell = { label: firstLabel(tries), help: first.help };
    const bestCell = tries.length > 1 ? { label: `Best, ${shortDate(best.at)}`, help: best.help } : null;
    const hint = bestCell === null ? TRY_AGAIN_FOR_BEST : null;
    const said = [mission.title, status, ...(note === null ? [] : [segmentsText(note)]), `${firstCell.label}, ${firstCell.help}`, bestCell === null ? hint : `${bestCell.label}, ${bestCell.help}`].join('. ');
    return {
      missionId: mission.id,
      scene: mission.title,
      status,
      note,
      first: firstCell,
      best: bestCell,
      hint,
      route: { screen: 'ScenePreview', params: { missionId: mission.id } },
      accessibilityLabel: said,
    };
  });
  return { rows, locked: access('thenAndNow') === 'locked' };
}
