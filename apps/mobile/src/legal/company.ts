/**
 * Every fact about the company, in one place, with the rules over them.
 *
 * Two of the three are not supplied yet. That is the whole reason this module
 * exists rather than three strings written into whichever screen needed one:
 * an unset fact has to draw NOTHING, and a screen that spells its own address
 * has no way to be absent. This is `appVersionLine`'s shape (ProfileTab.tsx)
 * applied to three facts instead of one, and `company.test.ts` walks the source
 * to keep it that way.
 *
 * ## What a placeholder is worth
 *
 * `companyFrom` refuses a blank, a whitespace-only string and a placeholder
 * like `TBC`, and refuses an address with no at sign in it. The refusal matters
 * more than it looks: the mockups this replaced put the company in France under
 * a name that is not ours, and the way that happens a second time is somebody
 * typing `TBC` into a literal to see the row render and then shipping it. A
 * fact that is not known yet reads as `null` here, and every consumer answers
 * nothing for `null` rather than drawing a dead row a learner would tap.
 *
 * The same rule is applied to the name, which IS supplied, for the reason a
 * one-off exception always gives: a rule with one field outside it is a rule
 * somebody will read as advice. There is exactly one way a fact reaches glass.
 *
 * ## Where the paragraph came from
 *
 * `privacyNote` is the Profile footer's own text, kept because it was already
 * the most honest sentence in the app: it says what is implemented, and it says
 * a reviewed policy is still owing rather than implying one exists. It is also
 * the source of the vendor phrase `onboarding/disclosure.ts` copies character
 * for character, so this module and the first run keep one vocabulary for one
 * pipeline. `disclosure.test.ts` reads both.
 */

/**
 * The three facts. `null` means nobody has supplied it, never "empty".
 *
 * `registeredName` is nullable with the others even though it is known today,
 * so no consumer can assume one of the three is always safe to print.
 */
export interface CompanyFacts {
  supportEmail: string | null;
  registeredName: string | null;
  companyNumber: string | null;
}

/** A contact the app is willing to draw: a label, and something to write to. */
export interface ContactRow {
  label: string;
  address: string;
}

/** The row's own label. Named for the action, not for a department. */
export const CONTACT_ROW = 'Contact us';

/**
 * The words that mean "not supplied", lowercased.
 *
 * Short on purpose. This is a guard against a placeholder shipped by accident,
 * not a parser for every way a person might write "unknown", and a long list
 * would eventually refuse a real company name.
 */
const PLACEHOLDERS: readonly string[] = ['tbc', 'tbd', 'todo', 'unknown', 'n/a', 'na', 'xxx', 'placeholder'];

/** Trimmed, or null for anything blank or standing in for an answer. */
function fact(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (value.length === 0) return null;
  if (PLACEHOLDERS.includes(value.toLowerCase())) return null;
  return value;
}

/**
 * An address, or null for anything that is not one.
 *
 * Deliberately not a full address grammar. What it has to catch is a fact typed
 * in the wrong shape: a note to self, a phone number, a placeholder. One at sign
 * with something either side of it and no spaces is enough for that, and a
 * stricter pattern here would refuse a valid address on somebody's launch day.
 */
function address(raw: string | null | undefined): string | null {
  const value = fact(raw);
  if (value === null) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

/** The rules, applied to whatever the literals say today. */
export function companyFrom(raw: Partial<CompanyFacts>): CompanyFacts {
  return {
    supportEmail: address(raw.supportEmail),
    registeredName: fact(raw.registeredName),
    companyNumber: fact(raw.companyNumber),
  };
}

/**
 * The literals. Editing them is how the two missing facts arrive.
 *
 * `companyNumber` is the Companies House number, and UK consumer rules expect
 * a trader to be identifiable, so the company line is incomplete until it is
 * set. `supportEmail` gates both the Contact row and the hosted support page.
 */
export const COMPANY: CompanyFacts = companyFrom({
  registeredName: 'Vision Strategies Ltd',
  companyNumber: null,
  supportEmail: 'hello@luvani.app',
});

/** The contact, or nothing at all. A row with no address is a row that lies. */
export function contactRow(facts: CompanyFacts = COMPANY): ContactRow | null {
  if (facts.supportEmail === null) return null;
  return { label: CONTACT_ROW, address: facts.supportEmail };
}

/**
 * Who Luvani is, in one line, or nothing while the name is unset.
 *
 * The number is a second sentence rather than a clause, so its absence leaves a
 * complete line behind instead of a trailing comma.
 */
export function companyLine(facts: CompanyFacts = COMPANY): string | null {
  if (facts.registeredName === null) return null;
  const registered = `${facts.registeredName}, registered in the UK.`;
  return facts.companyNumber === null ? registered : `${registered} Company number ${facts.companyNumber}.`;
}

/**
 * The sentence that stays true until a lawyer has read the documents.
 *
 * Verbatim from the Profile footer, and pinned by `disclosure.test.ts`. Accurate
 * words are not cleared words, and the app should not imply otherwise.
 */
export const LEGAL_REVIEW_PENDING = 'Our privacy policy and terms still need legal review before Luvani can be released.';

/**
 * Whether this build shows `LEGAL_REVIEW_PENDING` (founder decision 24, F929).
 *
 * Development and staging builds say it; a production build never does, since
 * a released app telling its learners it cannot be released is not true of
 * the app in their hand. The review itself is tracked on the release checklist
 * (docs/RELEASE_GATE.md, "Policy and operational checks"), which is what stops a production build until
 * it is done. Unset (local web, tests) is not a release, so it shows.
 */
export function legalReviewNoteShown(profile: string | undefined = bundledBuildProfile()): boolean {
  return profile !== 'production';
}

/** Expo inlines EXPO_PUBLIC_* at build time, so this must stay one static access (as in wall/preview.ts). */
function bundledBuildProfile(): string | undefined {
  return process.env.EXPO_PUBLIC_LUVANI_BUILD_PROFILE;
}

/**
 * The short, honest paragraph about what Luvani keeps.
 *
 * It is the footer's four sentences: what is recorded, where live speech goes,
 * what bounds where anything else can go, and that a review is still owing. The
 * contact sentence is added only when there is somewhere to write to, which is
 * the same rule the row follows and the reason this reads the facts at all.
 *
 * "speech and language services" is `VENDOR_PHRASE` in
 * `onboarding/disclosure.ts`, character for character. It is written out here
 * rather than imported, because the point of that constant is that two surfaces
 * describing one pipeline are held together by a test that reads both, and an
 * import would make the check true by construction on the day somebody rewrites
 * only one of the two sentences around it. `disclosure.test.ts` reads this.
 *
 * ## Why the second sentence is a bound and not a denial
 *
 * It read "Nothing is shared with anyone else or sold for advertising" until
 * F497. That was defensible while the sentence before it named the only
 * recipients there were, because every one of them was a speech or language
 * service; it stopped being defensible when F481, F484 and F488 established the
 * language model, the rented database, the counter store and the company that
 * takes the payment as recipients too. So this says what the notice says, in
 * fewer words: nothing is sold, and what leaves is bounded by the purposes it
 * leaves for. A count of companies is falsified by the next company. A purpose
 * is not, and a new one is a new word here rather than a lie nobody noticed.
 * `policy.test.ts` holds this sentence against the notice's own bound.
 */
export function privacyNote(facts: CompanyFacts = COMPANY, reviewNote: boolean = legalReviewNoteShown()): string {
  const contact = facts.supportEmail === null ? '' : ` You can reach us at ${facts.supportEmail}.`;
  return (
    'Your account stores your email, name, age confirmation and learning. Spoken or typed words are processed by speech and language ' +
    'services for tutor replies and practice. You control memory, saved conversation text and optional usage data. ' +
    `You can export your data or delete your account here.${reviewNote ? ` ${LEGAL_REVIEW_PENDING}` : ''}${contact}`
  );
}
