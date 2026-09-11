import { replayRung, type MissionId, type MissionProgress, type ReviewCard } from '@luvani/core';

import { missionTint } from '../missions/missionTint.ts';
import { retainedOrder } from '../progress/momentum.ts';
import { rungLabel } from '../tutor/rungLabel.ts';
import type { TintName } from '../theme.ts';
import { WELCOME_PATH, beyondWelcomePath } from './welcomePath.ts';

/**
 * One row of the wall's first page: a place, and what the learner can do there.
 *
 * Four rows, always four. This is the property the whole design rests on, and it
 * is why this page opens the wall rather than a proof block: a learner who ran
 * out of minutes fastest is exactly the learner a proof screen has least to say
 * to, and a wall whose first page can be empty is a wall that is weakest where
 * it matters most. A walked place reads its own `winEn`; an unwalked one reads
 * its own `goalEn`. Nothing is removed and nothing degrades.
 */
export interface WallMapRow {
  id: MissionId;
  titleEn: string;
  tint: TintName;
  /** True when the beats have been finished at least once. */
  lit: boolean;
  /**
   * The one line under the title.
   *
   * Walked: the mission's authored `winEn`, which describes and never praises.
   * Unwalked: its authored `goalEn`, which is a can-do phrased forward. Both are
   * content rather than chrome, which is why neither is written here.
   */
  line: string;
  /** A line of French from this room, or null when there is none to show. */
  yours: string | null;
  /**
   * Whether `yours` is the learner's own or one the mission taught.
   *
   * The two license completely different sentences. A phrase with a conversational
   * use behind it can carry ledger.ts's claim that nobody asked them for it; a
   * reference line can only be said to have been practised. Getting this backwards
   * would be the app claiming something about a learner that is not true, which is
   * the one thing every count in this repo is arranged to avoid.
   */
  yoursIsTheirs: boolean;
  /** One rung above the last, in the tutor's own words, or null. */
  next: string | null;
}

/**
 * Page one, and which way round it opens.
 *
 * `problemFirst` is the whole of the second video's argument, taken as far as it
 * honestly goes here. People buy relief from a problem, so lead with the problem
 * — but a learner who has walked nothing has no gap worth naming, only an empty
 * start, and opening on four things they cannot do is the bleakest first screen
 * available to the cohort that most needs convincing. So the order inverts only
 * once the path is walked, which is exactly when the gap becomes real: the two
 * situations held back are then the only ones left, they are authored, and they
 * are what the learner came back for.
 *
 * The problem is named as a situation and never as a feeling. `goalEn` is the
 * catalogue's own sentence about what happens in that room, so nothing on this
 * page describes the learner at all.
 */
export interface WallMap {
  rows: readonly WallMapRow[];
  /** True when the rows open on what is still closed rather than on what is done. */
  problemFirst: boolean;
}

/**
 * Page one, from what the learner did rather than what they bought.
 *
 * `lit` is `timesFinished > 0` and deliberately not `state` and not `isStamped`.
 * `state` moves when the review scheduler moves, so a row would go dark on a
 * calendar rather than on a fact. `isStamped` is true only at `on-your-own`
 * (passport.ts), so a learner who finished all four at a low rung -- the modal
 * free learner, since the ladder opens low -- would read a completion line over
 * four empty marks. `timesFinished` asks the question this page is actually
 * asking: have you been here.
 *
 * Nothing in a row is about payment, so this picture would be identical if the
 * app were free. That is what lets the wall be shown more than once without
 * curdling into nagging, and it is why there is no padlock: `path.ts` already
 * quotes PRODUCT.md's first principle as the reason every authored node is open
 * in any order. A padlock is an accusation. An unvisited place is an invitation.
 */
export function wallMap(input: {
  progress: readonly MissionProgress[];
  deck: readonly ReviewCard[];
  /** The tutor's name, or null when the profile has not loaded. */
  tutorName: string | null;
}): WallMap {
  // Ranked once for the whole page rather than per row: `retainedOrder` sorts the
  // deck, and doing that six times to read six first elements is five sorts
  // nobody needs.
  const mine = retainedOrder(input.deck);

  const rowFor = (id: MissionId): WallMapRow => {
    const found = input.progress.find((entry) => entry.mission.id === id);
    if (!found) throw new Error(`wallMap has no progress for ${id}`);
    const { mission, timesFinished, lastRung } = found;
    const lit = timesFinished > 0;

    // The join. `mission.phraseKeys` and the deck share one identity scheme,
    // `phrase:<fr lowercased>`, so the mission's phrases and the learner's cards
    // are the same objects seen from two ends. Core brings these together exactly
    // once today, in `stateFor`, and only to ask whether a mission is due; nobody
    // has ever asked which line the learner actually said in that room.
    const said = lit ? mine.find((card) => mission.phraseKeys.includes(card.id)) : undefined;
    const taught = lit ? mission.referencePhrases[0] : undefined;
    const raised = replayRung(lastRung);

    return {
      id,
      titleEn: mission.titleEn,
      tint: missionTint(mission.place),
      lit,
      line: lit ? mission.winEn : mission.goalEn,
      yours: said?.front ?? taught ?? null,
      yoursIsTheirs: said !== undefined,
      // The rung label needs the tutor's name, so without a profile there is no
      // honest line to draw. A row is complete without it; a row that guessed the
      // name would not be.
      next: raised !== null && input.tutorName !== null ? rungLabel(raised, input.tutorName) : null,
    };
  };

  const walked = WELCOME_PATH.map(rowFor);
  const complete = walked.length > 0 && walked.every((row) => row.lit);
  if (!complete) return { rows: walked, problemFirst: false };

  // The path is done, so the gap is the situations held back, and they lead. The
  // walked rooms follow as the proof rather than being dropped: the evidence is
  // what makes the offer credible, and it is the same rows in the same words.
  const closed = beyondWelcomePath().map((mission) => rowFor(mission.id));
  return { rows: [...closed, ...walked], problemFirst: true };
}

/** How many of the drawn rooms the learner has been into. */
export function litCount(rows: readonly WallMapRow[]): number {
  return rows.filter((row) => row.lit).length;
}
