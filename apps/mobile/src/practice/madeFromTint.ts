/**
 * Which tint sits under which kind of practice — F574.
 *
 * Practice draws three rows made from the learner's own conversations: the
 * moment worth replaying, the phrase worth making theirs, and the sound worth
 * tuning. They get the same three papers the tutor's three ways in get, in the
 * same order, because they are the same three moves one step later — a learner
 * who read peach as "a real situation" on Tutor reads peach as "something you
 * actually said" here, and the app stays one app.
 *
 * `MADE_FROM` is imported for its shape only, never for its values, so nothing
 * in the conversation-pack graph is loaded to answer a question about colour.
 * A fourth kind of practice arriving without a tint is a compile error here.
 */

import type { TintName } from '../palette.ts';
import type { MADE_FROM } from './madeFrom.ts';

export type MadeFromKey = keyof typeof MADE_FROM;

export const MADE_FROM_TINT: Record<MadeFromKey, TintName> = {
  replay: 'sand',
  phrase: 'sky',
  sound: 'sage',
};

export function madeFromTint(kind: MadeFromKey): TintName {
  return MADE_FROM_TINT[kind];
}
