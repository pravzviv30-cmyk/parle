/**
 * The three Practice rows for a learner with no conversation behind them.
 *
 * Practice is made from what the learner said, and on a first evening they have
 * said nothing. The tab answers that by drawing the same three shapes from
 * authored material rather than by apologising, which is `practice/starter.ts`'s
 * decision and its copy. What was missing was the second half of it: the shapes
 * themselves. The starter branch went on drawing three tall white cards of
 * French with outline buttons under them long after the conversation branch
 * became three tinted rows, so a learner's first sight of the tab and their
 * second sight of it were two different pages.
 *
 * This module is what makes them one page. It maps the authored material onto
 * the props the same three row components take, so `PracticeTab` renders the
 * same components in both branches and the only difference is where a row goes.
 *
 * ## Why the destinations are here and not in the screen
 *
 * Each row goes somewhere different when there is nothing behind it: the moment
 * opens the scripted café lesson, because a lesson is the one place an authored
 * exchange can actually be walked; the phrase opens the own-words drill on the
 * café's first line; the sound opens the chooser, because no sound has been
 * measured and the next situation is what will name one. Those are three
 * decisions about authored material, not three pieces of layout, and a screen
 * that made them would be the second place they were made.
 *
 * ## What is deliberately not built here
 *
 * A `Replay`. It carries `quote`, which means "what you said", and a learner
 * with no conversation has not said anything. Shaping the café's line as a
 * `Replay` would put a sentence the learner never spoke into a field whose name
 * claims they did, one render away from `MomentCard` printing it under "What
 * you said". So the moment row is described in words here and drawn as the
 * shared row, and the field that would have to be invented is simply absent.
 *
 * The phrase is different and that is why it IS built: every field of
 * `PhraseToOwn` is honestly answerable. It is a real French line with a real
 * meaning, it came from the café lesson rather than from a conversation, and
 * `saved` and `sayable` are both false because nothing has been kept and no
 * sitting scoped to it would have anything in it.
 */

import { phraseKeyOf } from '@luvani/core';

import { LESSON_MINUTES } from '../copy/access.ts';
import { asSentences } from '../copy/spoken.ts';
import type { TintName } from '../palette.ts';
import { MADE_FROM, type PhraseToOwn } from './madeFrom.ts';
import { MADE_FROM_TINT } from './madeFromTint.ts';
import { STARTER, type Starter } from './starter.ts';

/** The pack id a starter phrase carries: authored, and named as such. */
export const STARTER_PACK_ID = 'starter';

/**
 * Where each starter row goes.
 *
 * Named rather than inlined so the three live in one place and a screen reads
 * them instead of choosing them.
 */
export const STARTER_DESTINATION = {
  /** The scripted café lesson, which is the old "Walk through it". */
  moment: 'Lesson',
  /** The chooser: the next situation is what names a sound to tune. */
  sound: 'Missions',
} as const;

/** The moment row, in the words the shared row draws and nothing else. */
export interface StarterMomentRow {
  tint: TintName;
  title: string;
  gloss: string;
  screen: (typeof STARTER_DESTINATION)['moment'];
}

/**
 * The first row: the café exchange, offered as the moment worth walking.
 *
 * The title is the made-from row's own, because it is the same shape in the
 * same place doing the same job. The gloss is the starter's, because that is
 * the one thing that differs and it is the honest thing to say: this came from
 * the café, where every learner starts, rather than from you.
 */
export function starterMomentRow(): StarterMomentRow {
  return {
    tint: MADE_FROM_TINT.replay,
    title: MADE_FROM.replay.label,
    // The lesson runs live, and metered, while the tutor is reachable, so the
    // row says so in the shared words, after where the material came from.
    gloss: asSentences([STARTER.moment.lead, LESSON_MINUTES]),
    screen: STARTER_DESTINATION.moment,
  };
}

/**
 * The second row's phrase: the café's first line to say, shaped to be owned.
 *
 * `from` is what the drill shows the learner as the situation, so it is the
 * starter's own sentence about the line rather than a conversation title that
 * does not exist.
 */
export function starterPhraseRow(starter: Starter): PhraseToOwn {
  return {
    packId: STARTER_PACK_ID,
    from: STARTER.phrase.lead,
    fr: starter.phrase.fr,
    en: starter.phrase.en,
    key: phraseKeyOf(starter.phrase.fr),
    // Nothing has been kept and no sitting scoped to this would have anything
    // in it. Both are the honest answer rather than a default.
    saved: false,
    sayable: false,
  };
}
