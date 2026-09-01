/**
 * What the first run tells a learner about what they are talking to.
 *
 * Before this module the app said nothing. Splash, onboarding and the auth
 * welcome carried zero mentions of AI, and TutorIntro introduced the tutor with
 * a biography: twenty years behind a bar. A character is not
 * a lie. Presenting one as a biography to somebody who does not yet know they
 * are talking to software is, and the fix is not to delete Luc's history but to
 * introduce it as what it is. The warmth stays; the pretence goes.
 *
 * These are constants rather than JSX literals for the reason `answers.ts`
 * gives: apps/mobile has no renderer, so a promise that only exists inside a
 * screen is a promise nothing can check. Here, "the first run says AI" and "no
 * first-run copy claims a person is listening" are assertions a test can make
 * about values, and `disclosure.test.ts` makes them.
 *
 * Three surfaces read from here, and `FIRST_RUN_SURFACES` names them in the
 * order a learner meets them:
 *
 *   1. the welcome subline, before an account exists,
 *   2. the Meet Luc page, the last thing before choosing a scene,
 *   3. TutorIntro's persona page, at the door of the tutor itself.
 *
 * Four rules bind the words, and each one is held by a test.
 *
 * **AI is said plainly.** The literal word, next to the word tutor, on every
 * surface, in the first sentence of the first one. Not "smart", not "powered
 * by", not a footnote after the persona has already landed.
 *
 * **Nobody is listening.** `PRIVACY_AND_SAFETY.md` puts it as bluntly as it can
 * be put: nobody is watching a session, nobody is on call, no message reaches a
 * human. The first run has to say so before a learner decides what to say out
 * loud, not after.
 *
 * **One vendor vocabulary.** `VENDOR_PHRASE` is lifted verbatim from the
 * Profile footer, which already agrees with `PRIVACY_AND_SAFETY.md`. Two
 * sentences about the same pipeline is how a document and a screen start
 * disagreeing, and the learner is the one who finds out.
 *
 * **No policy that does not exist.** Terms and a privacy policy are not
 * written. The footer says so and must keep saying so, so nothing here implies
 * a document, a certification or a guarantee behind it. Nothing here claims
 * audio is deleted either: the device recorder still leaves attempt files in
 * the app cache, which `PRIVACY_AND_SAFETY.md` lists under Not true yet, and a
 * first-run screen is the worst place to make a promise the code has not kept.
 *
 * F115 closed the recorder half of that gap after this module was written: an
 * attempt is discarded once scoring is done with it, and a reset sweeps anything
 * left behind. The mic line still makes no claim about deletion, deliberately.
 * The fix is proven by test and has never run on a device, and the first run is
 * not where an unproven promise should make its debut. Revisit when F114's
 * device pass has actually watched a file disappear.
 */

import { TUTOR_NAME } from '../tutor/tutorName.ts';

/**
 * The words the Profile footer uses for where speech goes, character for
 * character. Copied on purpose: if the footer changes its mind about how to
 * describe the pipeline, the test that reads both files says so.
 */
export const VENDOR_PHRASE = 'speech and language services';

/**
 * The welcome subline, under "Find your voice in French".
 *
 * The front door, so it carries the disclosure in its first sentence. What
 * follows is the old auth welcome's promise, kept whole, because the honest
 * version of a good promise is still a good promise.
 */
export const WELCOME_SUBLINE = `${TUTOR_NAME} is an AI tutor. He talks with you in French, steps in when you stall, and never makes you feel silly.`;

/** The Meet Luc page: the one readiness screen, immediately before the chooser. */
export const MEET_TITLE = `Meet ${TUTOR_NAME}`;

/**
 * The persona, introduced as a persona.
 *
 * It says why the character exists rather than apologising for it. A learner
 * who knows Luc is written can still enjoy him; a learner who finds out later
 * was tricked, and the second one stops trusting everything else on the screen.
 */
export const MEET_AI = `${TUTOR_NAME} is an AI tutor. The man who ran a bar for twenty years is a character we wrote for him, because a person is easier to talk to than a program. He is made up. The French is real.`;

/** Where the words go, in the footer's vocabulary, and who does not hear them. */
export const MEET_PRIVACY = `No person hears you. What you say goes to ${VENDOR_PHRASE} so ${TUTOR_NAME} can answer, and nothing is shared with anyone else.`;

/**
 * The microphone, said before the system dialog rather than after it.
 *
 * Deliberately stops at the ask. The permission prompt is real and arrives at
 * the first scene; what happens to the audio afterwards is a claim this repo
 * cannot fully make yet, so the sentence does not make it.
 */
export const MEET_MIC = 'Your phone will ask to use the microphone when you start a scene.';

/** The way through for anyone who cannot speak aloud, named after the real control. */
export const MEET_TYPING = 'If you cannot speak out loud, tap Type instead in the scene and write your answer.';

/** Where the rest of it lives. A pointer to text that exists, not to a policy that does not. */
export const MEET_MORE = 'Profile has the rest of what Luvani keeps.';

/** The one action on the page. */
export const MEET_PILL = 'Choose your first scene';

/** TutorIntro's first page, at the door of the conversation. */
export const PERSONA_TITLE = `You'll be talking to ${TUTOR_NAME}`;

/**
 * The rewritten persona page.
 *
 * The sentence this replaces was "Luc is from Lyon, he ran a bar there for
 * twenty years, and he is not a teacher." Same man, same bar, same warmth, and
 * now the learner knows what he is before they hear him.
 */
export const PERSONA_BODY = `Not a quiz. ${TUTOR_NAME} is an AI tutor with a character we wrote for him: twenty years behind a bar, and not a teacher. He asks about your day, waits while you find the French, and answers what you actually said.`;

/** One first-run surface: what it says, and the file that has to say it. */
export interface FirstRunSurface {
  key: string;
  /** Relative to apps/mobile/src, so a test can read the file and check it. */
  where: string;
  lines: readonly string[];
}

/**
 * Every surface that carries the disclosure, in the order a learner meets them.
 *
 * The order is the point. "Says AI plainly" is worth nothing if it is said
 * after the first conversation, so the test reads this list front to back and
 * holds the first entry to the strictest version of the rule.
 */
export const FIRST_RUN_SURFACES: readonly FirstRunSurface[] = [
  { key: 'welcome', where: 'onboarding/WelcomeScreen.tsx', lines: [WELCOME_SUBLINE] },
  {
    key: 'meet',
    where: 'onboarding/OnboardingFlow.tsx',
    lines: [MEET_TITLE, MEET_AI, MEET_PRIVACY, MEET_MIC, MEET_TYPING, MEET_MORE, MEET_PILL],
  },
  { key: 'persona', where: 'tutor/TutorIntro.tsx', lines: [PERSONA_TITLE, PERSONA_BODY] },
];

/** Everything a learner reads before a conversation is reachable, flattened. */
export const FIRST_RUN_COPY: readonly string[] = FIRST_RUN_SURFACES.flatMap((s) => [...s.lines]);
