/**
 * One way of saying what a door costs and how it sounds (Stage 4, item 5).
 *
 * Before this, five surfaces said the same few things five slightly different
 * ways, and one of them ("offline audio") promised sound for every item when
 * only the voiced ones have it. These are the words every Stage 4 surface uses,
 * and the lines Stage 1-3 already wrote identically read from here too. Lines
 * that say something close but not the same are left as they are: rewording
 * them is a later sweep, not a side effect of this one.
 *
 * Four honesty rules the wording carries:
 *
 * - Typing to the tutor is the live tutor. Nothing here, and nothing anywhere
 *   in the app, calls a typed conversation free (`access.test.ts` walks the
 *   source for it).
 * - A lesson is metered only while a tutor is connected; offline it runs on
 *   this phone. `LESSON_MINUTES` says exactly that and no more.
 * - A device synthesiser is never the tutor. `DEVICE_VOICE` says whose voice
 *   it is by not claiming one.
 * - An authored line is not the learner's conversation, and is never presented
 *   as an assessment of anything.
 *
 * No prices, no plans, no counts: which plan buys how many minutes is the
 * Plans screen's to say.
 */

/** Module work: practice, review, a warm-up. Nothing live is used. */
export const NO_MINUTES = 'Uses no live minutes.';

/** A door into the live tutor, spoken or typed. */
export const LIVE_MINUTES = 'Uses live minutes.';

/** Something that needs the live tutor, said where a connection is not certain. */
export const NEEDS_CONNECTION_AND_MINUTES = 'Needs a connection and uses live minutes.';

/**
 * The guided pronunciation lesson. It runs live when a tutor is connected and
 * locally on this phone when not, so the cost is conditional and says so.
 */
export const LESSON_MINUTES = 'Uses live minutes while your tutor is connected.';

/** A recording of the learner's chosen tutor voice, bundled with the app. */
export const RECORDED_AUDIO = 'Recorded tutor audio';

/** The phone's own French synthesiser. Never called the tutor's voice. */
export const DEVICE_VOICE = 'Device voice';

/** No recording and no French voice on this device: the words are on screen. */
export const TEXT_ONLY = 'Text only: no French voice on this device';

/** Beside any authored sample line, so it is never read as the learner's own. */
export const AUTHORED_EXAMPLE = 'Authored example, not your conversation.';

/** Every line above, for the copy sweeps. */
export const ACCESS_COPY: readonly string[] = [
  NO_MINUTES,
  LIVE_MINUTES,
  NEEDS_CONNECTION_AND_MINUTES,
  LESSON_MINUTES,
  RECORDED_AUDIO,
  DEVICE_VOICE,
  TEXT_ONLY,
  AUTHORED_EXAMPLE,
];
