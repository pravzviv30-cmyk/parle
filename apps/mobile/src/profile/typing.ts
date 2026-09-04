/**
 * How this learner likes to answer, read once and read here.
 *
 * `store.ts` holds the field and `withPreferTyping` writes it. This is the one
 * place it is interpreted, for the same reason `strictnessOf` exists: the blob
 * has been round a sync, a version chain and another device's disk, and
 * `repairProfile` carries what it does not recognise through untouched. A
 * screen that read `profile.preferTyping` directly would be a screen that
 * believes whatever came back.
 *
 * ## What this is not
 *
 * It is not the quiet twin. A session that prefers typing still carries audio:
 * the tutor speaks, the microphone is one tap away on the same circle it always
 * was, and the whole scene is unchanged. All that moves is which control is
 * already open when the room does. The silent text mode is a different thing,
 * taken per session through the quiet door, and nothing here touches it.
 *
 * That distinction is the reason the sub-line promises the circle out loud. A
 * learner who turns this on and finds the microphone gone has been quietly
 * moved into a mode they did not ask for, and every spoken path in this product
 * is required to stay open.
 */

import type { StoredProfile } from './store.ts';

/** The row's own name, short enough to sit beside a switch at large text. */
export const PREFER_TYPING_ROW = 'Prefer typing';

/**
 * What saying yes does, in two plain sentences.
 *
 * The second one is the load-bearing half: it says the circle is still there.
 * Without it this reads as a setting that takes the voice away, which is not
 * what it does and not something this product would ever offer as a switch.
 */
export const PREFER_TYPING_SUB = 'Conversations open with the keyboard. You can still tap the circle to talk.';

/**
 * Does this learner want the box open when a conversation starts?
 *
 * True only for the literal `true`. No profile, no field, a string that says
 * "true", a one: all of them are somebody who has never asked, and the answer
 * for somebody who has never asked is the voice-first product.
 */
export function prefersTyping(profile: StoredProfile | null | undefined): boolean {
  return profile?.preferTyping === true;
}
