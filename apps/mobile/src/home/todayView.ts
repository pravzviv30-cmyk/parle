/**
 * What Today draws under the scene brief, decided (notebook Phase 3, B1).
 *
 * Two blocks, and each is drawn only when it has something true to show.
 *
 * On day one, "Where you're starting": A0 and the first three can-dos on the
 * CEFR spine, in spine order. It claims no level the learner has reached and no
 * date; it names where the path begins and what the first three scenes let a
 * learner say. It leaves the moment any scene has been finished, earned or not.
 *
 * After that, at most two plain sentences about the week, from the week story
 * and the reflection that reads the same week. A quiet week gets nothing: a
 * block that can render empty is a quota, and the four empty tiles and the
 * seven-dot rail this replaces were exactly that.
 */

import { SCENE_SPINE, getMission, type Mission, type MissionProgress } from '@luvani/core';

import type { Reflection } from '../progress/reflection.ts';

/**
 * The week story's shape, stated rather than imported: `progress/story.ts`
 * keeps a pinned list of importers (F233), and Today already reads it once.
 */
interface WeekStory {
  sentences: readonly string[];
}

export const STARTING_LABEL = "Where you're starting";

/** The caps line over the week's sentences. */
export const WEEK_LABEL = 'This week';

/** Two sentences, never a wall of facts. */
export const WEEK_LINES_MAX = 2;

/** How many can-dos day one names. */
const STARTING_CAN_DOS = 3;

export interface StartingPoint {
  level: 'A0';
  canDos: readonly string[];
}

/**
 * Day one's block, or null once any scene has been finished.
 *
 * An empty list is a read that did not answer, not a first day, so it is null
 * too rather than a claim about a learner nobody could read.
 */
export function startingPoint(progress: readonly MissionProgress[]): StartingPoint | null {
  if (progress.length === 0) return null;
  if (progress.some((p) => p.timesFinished > 0)) return null;
  const canDos = SCENE_SPINE.map((id) => getMission(id))
    .filter((mission): mission is Mission => mission !== undefined)
    .slice(0, STARTING_CAN_DOS)
    .map((mission) => mission.canDoEn);
  return { level: 'A0', canDos };
}

/**
 * The week in at most two sentences, or none.
 *
 * The reflection's "what went well" leads when there is one, because it is the
 * sentence that says something moved; then the story's own sentences. A line is
 * never said twice. The reflection's focus is left out on purpose: it can be a
 * bare French correction, which is not a sentence about the week.
 */
export function weekLines(input: { story: Pick<WeekStory, 'sentences'>; reflection: Reflection | null }): string[] {
  const out: string[] = [];
  for (const line of [input.reflection?.improvement ?? null, ...input.story.sentences]) {
    if (line === null) continue;
    const text = line.trim();
    if (text === '' || out.includes(text)) continue;
    out.push(text);
    if (out.length === WEEK_LINES_MAX) break;
  }
  return out;
}
