/**
 * What onboarding asks, and what it hands over.
 *
 * Three pages: the age gate, a name, and one page that says what the learner
 * is about to talk to. The goal page is gone from the first run and lives in
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
 */

/**
 * The three pages, in order. The dots at the top count these, `docs/ONBOARDING.md`
 * counts them too, and a test holds the doc to this array.
 */
export const PAGES = ['age', 'name', 'meet'] as const;
export type Page = (typeof PAGES)[number];

/** The name page: encouraged, never required. */
export const NAME_QUESTION = 'What should we call you?';
export const NAME_LABEL = 'Your name';
export const NAME_SKIP_HINT = 'You can leave this empty and add it later.';

/** The age page. One tap through, one honest way of saying no. */
export const AGE_QUESTION = 'How old are you?';
export const AGE_SUB = 'Parle is made for teens and adults.';
export const AGE_CONFIRM = 'I am 13 or older';
export const AGE_DENY = 'I am younger than that';
export const AGE_REFUSAL = 'Parle is for learners thirteen and up. Come back and find us then.';

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
