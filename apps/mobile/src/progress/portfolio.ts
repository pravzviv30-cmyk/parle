/**
 * The portfolio — one row's verb, and the words the next situation is named in.
 *
 * My French draws a list of situations and, at its foot, the one to walk into
 * next. Two decisions ride on that list and neither belongs in the `.tsx`: what
 * a row's button offers, and what the next-situation card is called. Deciding
 * either in the screen would be deciding it twice — once here, once on Home —
 * and the two would part company the first time one was tuned. Same arrangement
 * as `progress/passport.ts` and `practice/talkAgain.ts`: the judgement and the
 * copy in a `.ts`, the rendering in the `.tsx`.
 *
 * ## One row, one verb
 *
 * A situation finished before has sounds worth refining; one not yet walked into
 * is there to be started. That is the whole of `situationAction`, and it reads
 * off `timesFinished` — the count core already keeps — rather than off anything
 * this module recomputes. The screen asks once and branches on `kind`; it never
 * re-derives the verb from a rung or a state, because a second reading is a
 * second answer to a question that has one, and the passport is already the
 * place independence is judged.
 *
 * The screen-reader sentence travels with the label. A blind learner hears the
 * action before they reach the situation's title above it, so "Start" on its own
 * names nothing; the sentence carries the situation with it.
 *
 * ## Home's words, said once
 *
 * `NEXT_SITUATION` carries the exact copy Home's next-situation card already
 * uses. It is that card in a second place, so it has to be the same words: a
 * learner who meets "Next situation / Start this one" on Home and something
 * paraphrased here has been told the app keeps two names for one thing. HomeTab
 * is the source of truth and the test reads it, so a change there that is not
 * mirrored here fails rather than drifts.
 *
 * ## What is deliberately absent
 *
 * No score, no count, no number, and no word that scolds — the bar every surface
 * under `progress/` holds. And no read of the weekly story: F233 keeps exactly
 * one reader of that module, and this is not it, so nothing here imports it.
 */

import type { MissionProgress } from '@luvani/core';

/** Home's next-situation card, word for word. Mirrored, never paraphrased. */
export const NEXT_SITUATION = { label: 'Next situation', action: 'Start this one' } as const;

/** The two verbs a situation's row can offer. */
export const SITUATION_ACTION = { start: 'Start', refine: 'Refine pronunciation' } as const;

export interface SituationAction {
  kind: 'start' | 'refine';
  /** The word on the row's button. */
  label: string;
  /** What a screen reader says, naming the situation the button leaves silent. */
  accessibilityLabel: string;
}

/** "Start <situation>", for the next-situation pill and for a row's Start. */
export function startLabel(titleEn: string): string {
  return `Start ${titleEn}`;
}

/**
 * What one situation's row offers, decided here and once.
 *
 * Finished before -> refine its sounds; not yet -> start it. Read off
 * `timesFinished` and nothing else, so a row never grows a second opinion about
 * independence one screen away from the passport's.
 */
export function situationAction(item: Pick<MissionProgress, 'mission' | 'timesFinished'>): SituationAction {
  if (item.timesFinished > 0) {
    return {
      kind: 'refine',
      label: SITUATION_ACTION.refine,
      accessibilityLabel: `Refine pronunciation for ${item.mission.titleEn}`,
    };
  }
  return {
    kind: 'start',
    label: SITUATION_ACTION.start,
    accessibilityLabel: startLabel(item.mission.titleEn),
  };
}
