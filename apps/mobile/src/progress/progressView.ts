/**
 * What the Progress screen says, and which places earn a row on it — F572.
 *
 * The screen itself is a frame, three headings and four blocks. Every word it
 * sets and the one rule it obeys are here, because a rule inside a `.tsx` is a
 * rule no test in this workspace can reach: there is no renderer, and a
 * component that decides for itself is a component nobody can defend.
 *
 * ## Why this is not `home/abilities.ts`
 *
 * Home folds the same stamps into one joined sentence and shows at most three
 * of them, because Home is one row deep and its job is to say that this is
 * going somewhere. Progress is the screen a learner opens *to see the list*, so
 * it caps nothing: a learner who has handled five places reads five rows, and
 * the sixth month does not quietly hide the first.
 *
 * The heading is borrowed rather than retyped, so the two surfaces cannot come
 * to disagree about what the claim is called.
 *
 * ## Earned on your own, or not at all
 *
 * Only a stamp the learner earned unaided reaches this list. A place walked
 * through with help is a real thing and Home says so in its softer line; it is
 * not "you can now", and printing it here under that heading would be the app
 * telling somebody they can do something they have not done yet.
 */

import type { MissionPlace } from '@luvani/core';

import { ABILITIES_LABEL } from '../home/abilities.ts';
import { isStamped, type Stamp } from './passport.ts';

/** The screen's own name, set large at the top. */
export const PROGRESS_TITLE = 'Real progress';

/** Over the list of places the learner can handle alone. Home's own words. */
export const CAN_DO_LABEL = ABILITIES_LABEL;

/** Over the four momentum cards. */
export const MOMENTUM_LABEL = 'Your momentum';

/** One place the learner can walk into on their own. */
export interface CanDoRow {
  /** So a tap can reopen the scene it came from. */
  missionId: string;
  /** Which paper the row takes, and which mark sits on its disc. */
  place: MissionPlace;
  /** The situation in the learner's language, as the passport worded it. */
  title: string;
}

/**
 * Every place handled unaided, in the order the passport gave them.
 *
 * Uncapped on purpose (see above). The order is the caller's, untouched: this
 * module has no opinion about which of a learner's own situations matters most,
 * and inventing one would be ranking them.
 */
export function canDoRows(stamps: readonly Stamp[]): readonly CanDoRow[] {
  return stamps.filter(isStamped).map((stamp) => ({
    missionId: stamp.missionId,
    place: stamp.place,
    title: stamp.titleEn,
  }));
}

/** True when the list has earned its heading. An empty heading is a quota. */
export function hasCanDo(rows: readonly CanDoRow[]): boolean {
  return rows.length > 0;
}
