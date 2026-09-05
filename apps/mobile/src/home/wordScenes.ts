/**
 * The twenty drawings the word of the day rotates through.
 *
 * The card drew `WordSprout` and only `WordSprout`, so a learner who opened
 * Home every morning met the same seedling every morning. Twenty scenes is
 * three weeks of mornings before one comes round again, which is what the
 * founder asked for: something to see, not the same thing to see.
 *
 * This file is a list and nothing else. It holds no drawing, no width and no
 * motion: `home/WordScene.tsx` maps a key to a component, and the ink lives
 * under `illustrations/scenes/daily/`. Splitting the list off the switch is
 * what lets a test count the keys, check every one is reachable and check
 * every drawing is paused, without importing one React Native module.
 *
 * ## The order is the order the days walk
 *
 * `dailyPick(WORD_SCENES, now)` steps one place per local day, so a position
 * in this array is a day of the rotation rather than a ranking. The barrel
 * groups the drawings by subject, because that is how they were authored:
 * five kitchen scenes together, six street scenes together. Taken in that
 * order a learner would get five kitchen mornings in a row, which is the same
 * sameness the pack was drawn to end.
 *
 * So the four subjects are dealt out here instead, with no two neighbours from
 * one group and none across the wrap from the twentieth back to the first. The
 * grouping is not read at runtime and is not a type; it is a property of this
 * order, and the suite holds it so a scene appended to the end cannot quietly
 * put two kitchens side by side.
 *
 * Growing this list re-phases the sequence from that day on, exactly as
 * growing the word pool does. `daily/pick.ts` says at length why that is
 * accepted rather than stored, and the reason is the same one here: a stored
 * position is a second source of truth about what day it is.
 */

/**
 * The pool, in rotation order.
 *
 * `as const` is load-bearing twice over: it makes the keys a union rather than
 * `string`, so a missing case in the chooser is a type error, and it makes the
 * array readonly, so nothing can sort or splice the day order out from under
 * a learner mid-session.
 */
export const WORD_SCENES = [
  'sprout',
  'kettle',
  'postbox',
  'umbrella',
  'croissant',
  'bicycle',
  'snail',
  'cloud',
  'candle',
  'fountain',
  'kite',
  'cat',
  'casserole',
  'pigeon',
  'leaves',
  'teapot',
  'lantern',
  'sailboat',
  'snowflake',
  'shutters',
] as const;

/** One of the twenty. `WordScene.tsx` carries a case for each of them. */
export type WordSceneKey = (typeof WORD_SCENES)[number];
