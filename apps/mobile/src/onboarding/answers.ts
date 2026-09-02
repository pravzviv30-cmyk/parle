/**
 * What onboarding asks, and what it hands over.
 *
 * Four pages: the age gate, a name, one page that says what the learner is
 * about to talk to, and one where they meet the eight voices and pick one or
 * walk past it. The goal page is gone from the first run and lives in
 * Profile, the date of birth page is gone entirely — a product for teens and
 * adults needs to know that somebody is thirteen, which is one tap, not a date
 * — and the why page is gone too.
 *
 * ## The order, which is the part that changed
 *
 * Age is asked FIRST. It used to be second, behind the name, which meant the
 * app took a personal detail from a learner it was about to turn away. Nothing
 * is stored on refusal, so the record was never written, but the question was
 * still asked and the answer still sat in memory. Asking the gate first is
 * data minimisation in the only form that survives a screen reorder: do not
 * open your mouth about somebody you have not decided to serve.
 *
 * ## The why page, and why it is not here
 *
 * It asked a good question and nothing ever read the answer. `motivation` was
 * written to storage, defaulted on upgrade, merged by the sync policy and
 * reported as one analytics boolean, and not one line of the product changed
 * shape because of it. So it went, and the FIELD stayed: stored records still
 * carry it, `upgradeStored` still defaults it, the merge policy still merges
 * it, and this flow simply passes null. If a feature ever wants the answer, it
 * can ask in Profile with a reader attached, which is the honest order.
 *
 * Everything here is the decision, not the drawing. `OnboardingFlow.tsx` used
 * to hold all of it inline, which meant that "an empty name is stored as an
 * empty string" and "a missing why becomes 'want'" were rules nothing could
 * check, because apps/mobile has no renderer. This is the same move
 * `tutor/gate.ts`, `tutor/choosingView.ts` and `practice/statusLine.ts` made.
 *
 * The two rules worth naming out loud:
 *
 * A skipped answer is **null**, never a value invented on the learner's
 * behalf. An empty string is a name somebody typed; null is a question they
 * declined. Storing '' for a skip is the app putting words in their mouth, and
 * it is what made the greeting read "Bonjour, " with nothing after it.
 *
 * Age is a **gate, not a field**. `ageGate` is the one place that decides who
 * is let through, and it refuses in plain words with no scolding and no second
 * chance dressed up as a retry, because a learner who cannot say they are
 * thirteen is not someone this product is for yet.
 *
 * ## The second door into the gate
 *
 * That gate has two doors now. The first is this flow, once. The second is a
 * learner whose account is carrying an age stop — the tutor ended a session
 * because they said in a scene that they are under thirteen, and
 * `profile/store.ts` wrote it down. `entryFor` is where the two are ordered,
 * and it is one function rather than two booleans on purpose: the gate lives
 * inside onboarding, so anything that asks the questions separately can show
 * the standalone gate to somebody who has never seen onboarding at all.
 */

import type { TutorVoiceKey } from '@luvani/core';
import { ageStopStanding } from '../profile/age.ts';

/**
 * The four pages, in order. The dots at the top count these, `docs/ONBOARDING.md`
 * counts them too, and a test holds the doc to this array.
 *
 * `voice` is the one addition, and it is the only page here that costs a
 * learner a screen without asking a question they have to answer. It earns its
 * place the way nothing else on this path does: it is the one setting in the
 * product that changes who is talking, two of the eight voices are women, and a
 * learner who never opens Profile would otherwise never learn the choice
 * exists. It is one tap past, and skipping is a real answer rather than a
 * question deferred.
 *
 * It comes AFTER `meet` and not before it, because `meet` is where the app says
 * the tutor is AI. Meeting eight named people first and being told what they
 * are afterwards is the order this whole module exists to prevent.
 */
export const PAGES = ['age', 'name', 'meet', 'voice'] as const;
export type Page = (typeof PAGES)[number];

/** The name page: encouraged, never required. */
export const NAME_QUESTION = 'What should we call you?';
export const NAME_LABEL = 'Your name';
export const NAME_SKIP_HINT = 'You can leave this empty and add it later.';

/** The age page. One tap through, one honest way of saying no. */
export const AGE_QUESTION = 'How old are you?';
export const AGE_SUB = 'Luvani is made for teens and adults.';
export const AGE_CONFIRM = 'I am 13 or older';
export const AGE_DENY = 'I am younger than that';
export const AGE_REFUSAL = 'Luvani is for learners thirteen and up. Come back and find us then.';

/**
 * The same page, reached the second way: a session ended because the learner
 * said in a scene that they are under thirteen, and the account remembered it.
 *
 * Two things this copy will not do. It will not say what happened, because a
 * child who meets this boundary should not be made to feel caught, and because
 * the classifier is sometimes wrong and an adult reading an accusation over a
 * misheard sentence is worse. And it will not apologise, because the boundary
 * is not a mistake. What it does say is the one thing anyone on either side of
 * it actually wants to know: nothing of theirs has been taken away.
 *
 * The buttons and the refusal are the ones above, unchanged. There is exactly
 * one age gate; this is a second door into it, not a second gate.
 */
export const AGE_RETURN_TITLE = 'Before we carry on';
export const AGE_RETURN_SUB = 'Luvani is made for learners thirteen and up. Everything you have learned is still here.';

/** What the pages are holding while the learner fills them in. */
export interface OnboardingDraft {
  /** Exactly what is in the text field, spaces and all. */
  name: string;
  /** The learner tapped the confirmation. */
  ageConfirmed: boolean;
  /**
   * Always null from the flow now that the why page is gone. The field is kept
   * rather than removed because `StoredProfile`, `upgradeStored` and the sync
   * merge policy all still carry it, and a shape that quietly drops a stored
   * value on its way past is how a synced record loses a field it was holding.
   */
  motivation: string | null;
  /**
   * Who they picked on the voice step, or null for a skip.
   *
   * Null is a skip and never the default key spelled out. The default is what
   * null already means everywhere else that reads this field, so writing
   * `'luc'` here would record a choice the learner did not make and would make
   * the Profile row unable to tell the two apart.
   */
  tutorVoice: TutorVoiceKey | null;
}

/**
 * What the flow hands to the profile store.
 *
 * Deliberately narrower than `profile/store.ts`'s `OnboardingAnswers`, which is
 * still transitionally wide: this shape cannot carry a date of birth, so the
 * data-minimisation promise is a type rather than a habit. It assigns straight
 * across because it is a subset.
 */
export interface OnboardingAnswers {
  name: string | null;
  ageConfirmed: boolean;
  motivation: string | null;
  /**
   * The voice step's answer, riding out with the rest.
   *
   * It travels as an answer rather than being written from inside a page
   * because onboarding runs outside `ProfileProvider`: there is no profile to
   * write to until the flow has handed these back. `withChosenVoice` in
   * `voiceStep.ts` is what applies it, through the same door the Profile sheet
   * uses.
   */
  tutorVoice: TutorVoiceKey | null;
}

/** A typed name, trimmed. Nothing typed is null, never the empty string. */
export function nameFrom(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** The draft, as the profile store will read it. */
export function answersFrom(draft: OnboardingDraft): OnboardingAnswers {
  return {
    name: nameFrom(draft.name),
    ageConfirmed: draft.ageConfirmed,
    // Null, because nothing asks any more. Before it was null because they
    // skipped a page, and before that it was 'want' because a flow defaulted
    // it, which is the app deciding why somebody is here.
    motivation: draft.motivation,
    // Straight through, null included. A skipped voice step is a null the same
    // way a skipped name is: the question was offered and declined, and the app
    // does not answer it on the learner's behalf.
    tutorVoice: draft.tutorVoice,
  };
}

export type AgeGate = { go: true; refusal: null } | { go: false; refusal: string };

/**
 * Who is let through, and what the rest are told.
 *
 * There is no third answer on purpose. The confirmation is the only way past,
 * and the refusal is a full stop rather than a nudge to try the other button.
 */
export function ageGate(confirmed: boolean): AgeGate {
  return confirmed ? { go: true, refusal: null } : { go: false, refusal: AGE_REFUSAL };
}

/** Where Continue goes from here, or null when this page is the last one. */
export function pageAfter(page: Page): Page | null {
  const next = PAGES[PAGES.indexOf(page) + 1];
  return next ?? null;
}

/** Where the back chevron goes, or null when there is nothing behind. */
export function pageBefore(page: Page): Page | null {
  const index = PAGES.indexOf(page);
  return index > 0 ? (PAGES[index - 1] ?? null) : null;
}

/**
 * The three things a launch can be, in the order the navigator has to try them.
 *
 * `frontend-engineer` wires this in `nav/RootNavigator.tsx`; it is here because
 * apps/mobile has no renderer, so a routing rule inside a component is a rule
 * nothing can ask a question about. The order is the whole value of returning
 * one answer instead of two booleans: onboarding contains the age gate, so a
 * navigator that asked the two questions separately could show the standalone
 * gate to somebody who has never seen any of it.
 *
 * `'age-gate'` is the new one. It is not a smaller onboarding: the learner keeps
 * their name, their goal, their history and everything the tutor knows about
 * them, and the only thing between them and the app is the one question they
 * are being asked again. See AGE_RETURN_TITLE for the copy and for why it does
 * not say what happened.
 */
export type Entry = 'onboarding' | 'age-gate' | 'app';

/** What this launch shows first. */
export function entryFor(profile: { name: string | null; ageConfirmed: boolean | null; ageStopAt: number | null } | null): Entry {
  if (needsOnboarding(profile)) return 'onboarding';
  return ageStopStanding(profile) ? 'age-gate' : 'app';
}

/**
 * Whether this learner still has to be asked.
 *
 * The rule this replaces was `profile === null || profile.name === null`, and
 * it was safe right up until the moment the name became optional. Before that,
 * a null name could only mean a version-1 record migrated from before the
 * question existed, so re-asking was exactly right. Now it also means a learner
 * who was offered the question and declined it — so the old guard sent them
 * back to page one, took their answer again, stored null again, and sent them
 * back again, on that launch and every launch after it. Forever, on the one
 * journey this milestone exists to open.
 *
 * So the guard moves onto the question nobody can decline. `ageConfirmed` is
 * null exactly when the age gate has never been passed: version-1 records, and
 * version-2 or -3 records whose stored date of birth could not answer it. It is
 * `true` for everyone who has been through the flow, whatever else they chose
 * to skip. A stored `false` is not a value this app writes, and reading one as
 * "not asked" is the safe direction to be wrong in.
 *
 * The deeper lesson, which is worth keeping: this is a question about a
 * JOURNEY, and it was being answered from a FIELD. A field a learner is allowed
 * to leave empty can never stand in for a step they are required to complete.
 */
export function needsOnboarding(profile: { name: string | null; ageConfirmed: boolean | null } | null): boolean {
  if (profile === null) return true;
  return profile.ageConfirmed !== true;
}
