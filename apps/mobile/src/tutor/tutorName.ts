/**
 * What the tutor is called, in one place.
 *
 * The app used to say "your tutor" in twenty-odd places, which is a role, not a
 * person, and a learner who is told they have a French friend and then read at
 * by "your tutor" can hear the difference. He has a name now.
 *
 * One home rather than twenty literals, for the reason F8 gave about the token
 * server address: twenty copies agree about nothing today and would eventually
 * disagree about something. The name also lives in the tutor's own prompt
 * (packages/brain/src/prompt/system.ts), and that one is held by its own test,
 * so a rename is two deliberate edits rather than a hunt.
 *
 * ## This is that rename, made per learner
 *
 * A learner picks their tutor's voice now, and two of the eight voices are
 * women. So the name is no longer a constant about the product: it is a fact
 * about one person's profile, and a screen that hardcodes it introduces Céline
 * as a man. `tutorPersonaOf` is what the screens read, and the catalogue in
 * `@luvani/core` is where the eight names actually live, so a ninth voice needs
 * no edit here at all.
 *
 * `TUTOR_NAME` survives as exactly one thing: the name of the DEFAULT voice,
 * derived from the catalogue rather than typed again. One caller still wants it
 * because they have no learner in hand at the moment they compose their words
 * (see the source walk in tutorName.test.ts, which names them and says why).
 * Everything with a profile within reach calls `tutorPersonaOf`.
 *
 * Where he is NOT used, deliberately: failure screens. "Luc did not pick up"
 * blames a person for a dead server, and that copy already goes out of its way
 * to say this one is on us, not on you.
 */

import { DEFAULT_TUTOR_VOICE, isTutorVoiceKey, tutorVoice, type TutorPersona } from '@luvani/core';
import type { StoredProfile } from '../profile/store.ts';

export type { TutorPersona };

/**
 * The default voice's persona. Who a learner talks to before they have chosen,
 * and who they keep if they never do.
 */
export const DEFAULT_TUTOR_PERSONA: TutorPersona = tutorVoice(DEFAULT_TUTOR_VOICE).persona;

/**
 * The default tutor's name, read off the catalogue rather than spelled again.
 *
 * Deriving it is the point. A literal here would be a second opinion about who
 * `DEFAULT_TUTOR_VOICE` is, and the compiler would never say a word when the
 * two drifted apart.
 */
export const TUTOR_NAME = DEFAULT_TUTOR_PERSONA.name;

/**
 * Who THIS learner is talking to.
 *
 * Deliberately incurious about the rest of the profile and deliberately
 * sceptical about this one field, exactly like `strictnessOf`: the blob has
 * been round a sync, a version chain and another device's disk, and a stored
 * key that is no longer in the catalogue must land on the default rather than
 * name nobody.
 *
 * Null means never chosen, which is not an error and never reads as one. The
 * agent resolves the same way at the other end, so a learner who has never
 * opened the picker hears the same person the app names.
 */
export function tutorPersonaOf(profile: StoredProfile | null | undefined): TutorPersona {
  const stored: unknown = profile?.tutorVoice;
  return isTutorVoiceKey(stored) ? tutorVoice(stored).persona : DEFAULT_TUTOR_PERSONA;
}

/**
 * The name alone, for the many places that only interpolate it.
 *
 * A convenience over `tutorPersonaOf(profile).name` and nothing more. It exists
 * so a screen that wants one word does not have to reach through a record it
 * has no other use for.
 */
export function tutorNameOf(profile: StoredProfile | null | undefined): string {
  return tutorPersonaOf(profile).name;
}
