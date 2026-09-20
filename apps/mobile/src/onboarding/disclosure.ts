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
 * These are values rather than JSX literals for the reason `answers.ts`
 * gives: apps/mobile has no renderer, so a promise that only exists inside a
 * screen is a promise nothing can check. Here, "the first run says AI" and "no
 * first-run copy claims a person is listening" are assertions a test can make
 * about values, and `disclosure.test.ts` makes them.
 *
 * Four surfaces read from here, and `FIRST_RUN_SURFACES` names them in the
 * order a learner meets them:
 *
 *   1. the welcome subline, before an account exists,
 *   2. the meet page, which says what the tutor is,
 *   3. the voice step, where the learner meets the eight and picks one,
 *   4. TutorIntro's persona page, at the door of the tutor itself.
 *
 * Every line that names the tutor is a function of the persona rather than a
 * constant, and so is the flattened copy list, because two of the eight voices
 * are women. A page that hardcodes "Luc" and "him" introduces Céline as a man,
 * and the learner believes the voice, not the screen.
 *
 * WHICH persona is the screen's question, never this module's. A screen holding
 * a profile passes `tutorPersonaOf(existing)`; a screen read before an account
 * exists passes `DEFAULT_TUTOR_PERSONA` in as many words, so naming the default
 * is a decision somebody made on the one surface where it is true, rather than
 * something this file did on every surface at once.
 *
 * That second half is F300. Onboarding had `existing` in hand and read the
 * default name anyway, so a learner migrated with Céline already chosen was
 * told to meet Luc, read that Luc greets them by name, read that Luc is who the
 * speech services answer as, and was then introduced to Céline.
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

import { DEFAULT_TUTOR_PERSONA, type TutorPersona } from '../tutor/tutorName.ts';

/**
 * The English pronouns a sentence about the tutor has to agree with.
 *
 * Two of the eight catalogue voices are women, so every sentence that used to
 * say "him" is now a sentence that says the wrong thing to a quarter of the
 * people who read it. `TutorPersona` carries the subject pronoun and nothing
 * else, because that is all a prompt needs; copy needs two more forms of it,
 * and deriving them here is what stops eight screens each writing their own
 * `persona.pronoun === 'she' ? ... : ...`.
 *
 * Capital `Subject` is a field rather than a `.toUpperCase()` at the call site
 * on purpose: a template that upper-cases a pronoun is a template that will one
 * day upper-case a name, and this table is the one place either decision is
 * made.
 */
export interface Pronouns {
  subject: 'he' | 'she';
  /** Sentence-initial, so copy never has to case a word by hand. */
  Subject: 'He' | 'She';
  object: 'him' | 'her';
}

/** The pronouns for one persona. Total: the union has two members. */
export function pronouns(persona: TutorPersona): Pronouns {
  return persona.pronoun === 'she'
    ? { subject: 'she', Subject: 'She', object: 'her' }
    : { subject: 'he', Subject: 'He', object: 'him' };
}

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
 *
 * It is read before an account exists, so there is no profile to ask. The
 * pre-account flow passes the persona selected in its compact draft; a fresh
 * draft starts at the catalogue default, which is the only case where that
 * name is shown without a learner choosing it. The copy stays a function of a
 * persona so a selected voice and the words beside it cannot disagree.
 */
export function WELCOME_SUBLINE(persona: TutorPersona): string {
  const p = pronouns(persona);
  return `${persona.name} is an AI tutor. ${p.Subject} talks with you in French, steps in when you stall, and never makes you feel silly.`;
}

/** The meet page: the one readiness screen, immediately before the chooser. */
export function MEET_TITLE(persona: TutorPersona): string {
  return `Meet ${persona.name}`;
}

/**
 * The persona, introduced as a persona.
 *
 * It says why the character exists rather than apologising for it. A learner
 * who knows Luc is written can still enjoy him; a learner who finds out later
 * was tricked, and the second one stops trusting everything else on the screen.
 */
export function MEET_AI(persona: TutorPersona): string {
  const p = pronouns(persona);
  return `${persona.name} is an AI tutor with a character we wrote for ${p.object}. ${p.Subject} helps you practise natural French, explains useful patterns, and builds on the learning you choose to save.`;
}

/**
 * Where the words go, in the footer's vocabulary, and who does not hear them.
 *
 * It ended "and nothing is shared with anyone else" until F500, which is the
 * same flat denial F481 struck out of the notice and F497 struck off the
 * Settings footer, left standing on the one page every learner reads. It was
 * narrower here than in either of those, because the subject is what a learner
 * says during a session and neither the company that takes the payment nor the
 * counter store is ever sent that. It was still not true: the short summary the
 * session leaves behind is derived from what was said, and it is kept in a
 * database another company runs for us.
 *
 * So this bounds what it says by the purposes what a learner says leaves for,
 * in `privacyNote`'s own words, rather than by denying that anything leaves.
 * Three of the notice's four purposes, because taking a payment is the one no
 * word of French ever reaches, and a first-run line that named it would be
 * longer and less true at once. `disclosure.test.ts` reads the notice's list
 * and holds this line to it, so a purpose added there cannot leave this behind.
 *
 * It stays two sentences. A learner is ninety seconds into the app here, and
 * the notice is a tap away in Settings for everything this does not say.
 */
export function MEET_PRIVACY(persona: TutorPersona): string {
  return `No person hears you. What you say goes to ${VENDOR_PHRASE} so ${persona.name} can answer, and nothing about it goes anywhere for any purpose other than carrying a conversation, answering you and keeping what you have learned.`;
}

/**
 * The microphone, said before the system dialog rather than after it.
 *
 * Deliberately stops at the ask. The permission prompt is real and arrives at
 * the first scene; what happens to the audio afterwards is a claim this repo
 * cannot fully make yet, so the sentence does not make it.
 */
export const MEET_MIC = 'Your phone will ask to use the microphone when you start a scene.';

/** Typing offered as a choice in any scene, named after the real control. */
export const MEET_TYPING = 'You can also type. Tap Type instead in a scene and write your answer.';

/**
 * Where the rest of it lives.
 *
 * A pointer to text that exists rather than to a policy that does not. It said
 * Profile until the note, the export and the deletion moved behind Settings,
 * and a pointer that names the wrong screen is worse than none: a learner who
 * looks and finds nothing reads it as a claim that was never true.
 */
export const MEET_MORE = 'Settings has the rest of what Luvani keeps.';

/**
 * The one action that ends the first run.
 *
 * It used to sit on the Meet page, which was the last one. The voice step now
 * comes after it, so this pill moved with the end rather than staying with the
 * page it was named for: the sentence a learner reads on the last screen has to
 * be the true one about what happens next, and "Choose your first scene" is
 * only true where there is nothing after it. The Meet page says Continue.
 */
export const MEET_PILL = 'Choose your first scene';

/**
 * TutorIntro's first page, at the door of the conversation.
 *
 * A function of the persona rather than a constant, and that is the whole of
 * F294. A learner who chose Céline was read a page that called her Luc and
 * called her him, which is the same defect F281 fixed for the home town: the
 * screen said one thing and the voice said another, and the one they believe is
 * the voice.
 */
export function PERSONA_TITLE(persona: TutorPersona): string {
  return `You'll be talking to ${persona.name}`;
}

/**
 * The rewritten persona page.
 *
 * The sentence this replaces was "Luc is from Lyon, he ran a bar there for
 * twenty years, and he is not a teacher." Same person, same bar, same warmth,
 * and now the learner knows what they are before they hear them.
 *
 * "AI tutor" is not a phrase the persona is allowed to move. That sentence IS
 * the disclosure — it is the only place on this page a learner is told what
 * they are talking to — so the gender words and the pronouns follow the voice
 * around it and it stays exactly where it is. `disclosure.test.ts` fails for
 * every one of the eight personas if it goes.
 *
 * The teaching role is explicit. No age, place or fabricated life story is
 * claimed; the warmth comes from attentive teaching, not a human biography.
 */
export function PERSONA_BODY(persona: TutorPersona): string {
  const p = pronouns(persona);
  return `Not a quiz. ${persona.name} is an AI tutor who teaches through conversation. ${p.Subject} responds to what you mean, explains one useful point when needed, and helps you try it again. Saved learning context helps the next conversation build on the last.`;
}

/**
 * The voice step: eight people, and what picking one actually changes.
 *
 * ## Why this is here at all
 *
 * The original contract put the voice on a Profile row and nowhere else. The
 * founder overrode that: a learner who never opens Profile never learns that
 * the eight exist, and the one setting in this product that changes who they
 * are talking to is the one they would never find. So it is a first-run step.
 *
 * ## The three rules it is written against
 *
 * **Skippable.** A learner who wants to talk is one tap from the chooser and
 * the skip is a real answer, not a deferral: the default voice is a person
 * with a name, and `withChosenVoice` writes nothing at all on a skip so the
 * profile still reads "never chosen". Nobody is held at a menu on the way to
 * their first French sentence.
 *
 * **Nothing comparative.** The eight descriptions are the catalogue's own
 * `sound` lines, rendered untouched, and `voices.ts` states the rule they are
 * written to: gender, accent, and "young" for the one voice whose age band is
 * known. Three Parisian men therefore read alike, which is the honest outcome.
 * The sample is what tells them apart. Nothing on this page says one is better,
 * clearer or more native, because none of that has been measured and a learner
 * who picks by adjective and then dislikes the voice has been mis-sold.
 *
 * **It still says AI.** This is a first-run surface and the whole doctrine of
 * this module applies to it. It is also the page most likely to be re-written
 * as a personality parade, which is exactly the copy that needs the disclosure
 * next to it.
 *
 * ## And "how they work"
 *
 * The founder's phrase. A chooser with eight French names on it reads, to
 * somebody who does not know the product, like picking a difficulty or picking
 * which French to be taught. It is neither, so the body says so in the sentence
 * before the list rather than in a help article nobody opens.
 */
export const VOICE_TITLE = 'Choose a voice';

/** What the choice does, said before the list rather than after the regret. */
export const VOICE_BODY =
  'Whoever you pick does the talking, in every conversation. The French you learn is the same either way, and so is the way it is taught.';

/** The disclosure, on the page most likely to read as a cast list. */
export const VOICE_AI = 'All eight are voices for one AI tutor. Tap the ear to hear one, tap a name to keep it.';

/** The way past, worded as an answer rather than as a deferral. */
export const VOICE_SKIP = 'Skip for now';

/**
 * What skipping actually does, so the skip is an informed one.
 *
 * A function of the persona for a reason a first-ever run cannot show. A skip
 * writes nothing, so a learner who already has a voice keeps the one they have;
 * telling them they would come out talking to the default would be the screen
 * promising something `withChosenVoice` does not do.
 */
export function VOICE_SKIP_HINT(persona: TutorPersona): string {
  return `You do not have to pick. Skip and you talk to ${persona.name}, and you can change it in Profile whenever you like.`;
}

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
 *
 * A function of the persona throughout, because every surface names whoever
 * this learner is talking to. On a first-ever run that is the default on all
 * four and deliberately so: nobody has chosen, and the default is who answers
 * if they never do. On a second pass through the flow it is the voice already
 * on the record, which is the only person the screen is entitled to name.
 *
 * The eight names and their `sound` lines are deliberately NOT in this list.
 * They are not written here — they come off the catalogue in `@luvani/core`,
 * untouched, and `tutor/tutorVoice.test.ts` already polices them for vendors,
 * comparatives, em dashes and guilt. Copying them in would put one rule in two
 * places, and would trip F281's city guard on "from Quebec": a `sound` line
 * saying where an accent is from is a verified fact about a recording, which is
 * the opposite of a biography claiming a home town.
 */
export function firstRunSurfaces(persona: TutorPersona): readonly FirstRunSurface[] {
  return [
    { key: 'welcome', where: 'onboarding/PreAccountOnboarding.tsx', lines: [WELCOME_SUBLINE(persona)] },
    {
      key: 'meet',
      where: 'onboarding/OnboardingFlow.tsx',
      lines: [MEET_TITLE(persona), MEET_AI(persona), MEET_PRIVACY(persona), MEET_MIC, MEET_TYPING, MEET_MORE],
    },
    {
      key: 'voice',
      where: 'onboarding/OnboardingFlow.tsx',
      lines: [VOICE_TITLE, VOICE_BODY, VOICE_AI, VOICE_SKIP, VOICE_SKIP_HINT(persona), MEET_PILL],
    },
    { key: 'persona', where: 'tutor/TutorIntro.tsx', lines: [PERSONA_TITLE(persona), PERSONA_BODY(persona)] },
  ];
}

/**
 * The surfaces as the default voice reads them.
 *
 * Kept as a constant because `surfaceContract.test.ts` reads `where` off it to
 * pin the accessibility list to this one, and that question has nothing to do
 * with who the learner chose.
 */
export const FIRST_RUN_SURFACES: readonly FirstRunSurface[] = firstRunSurfaces(DEFAULT_TUTOR_PERSONA);

/** Everything a learner reads before a conversation is reachable, flattened. */
export function firstRunCopy(persona: TutorPersona): readonly string[] {
  return firstRunSurfaces(persona).flatMap((s) => [...s.lines]);
}

/** The same, for the voice a learner gets when they never choose one. */
export const FIRST_RUN_COPY: readonly string[] = firstRunCopy(DEFAULT_TUTOR_PERSONA);
