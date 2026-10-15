/**
 * Luvani's minimum-age eligibility declaration and Apple's app licence.
 *
 * Apple requires terms of use for an app that sells an auto-renewing
 * subscription, and offers its own standard licence for apps that have not
 * written their own. C2 adds the founder-requested eligibility clause without
 * rewriting Apple's licence. Release remains subject to legal review.
 * Nothing of Apple's document is reproduced here: it is
 * theirs, it is long, and a copy inside the app is a copy that goes stale the
 * first time they revise it.
 *
 * The URL is a constant so the one screen that opens a browser opens a fixed
 * address rather than a string it built. It is the only outward link in the app.
 */

/** What the screen is called, and what the Settings row says. */
export const TERMS_TITLE = 'Terms of use';

/** Declared by the Start/account action; acceptance does not verify age. */
export const TERMS_ELIGIBILITY = 'Luvani is for learners aged 13 and over.';
export const TERMS_DECLARATION = 'By starting practice or creating an account, you confirm that you meet this minimum age and agree to these Terms.';

/** Apple's own standard licence, at the address Apple publishes it at. */
export const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** The label on the one control that leaves the app. */
export const TERMS_LINK_LABEL = "Read Apple's licence";

/**
 * Eligibility comes first, then the app licence and its authoritative source.
 */
export const TERMS_BODY: readonly string[] = [
  TERMS_ELIGIBILITY,
  TERMS_DECLARATION,
  "Luvani is licensed to you under Apple's standard licence agreement for apps.",
  "Apple publishes the full text on its own site, and the link below opens it there rather than reprinting it here.",
];

/** Everything the terms screen says, flattened, for the copy scans. */
export const TERMS_COPY: readonly string[] = [TERMS_TITLE, ...TERMS_BODY, TERMS_LINK_LABEL];
