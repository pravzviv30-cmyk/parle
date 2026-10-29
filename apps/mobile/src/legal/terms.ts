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

/**
 * How a subscription renews and how to stop it. F914.
 *
 * DRAFT: this section has not had professional legal review and must have it
 * before release (docs/LEGAL_HOSTING.md). It is Luvani's own short summary,
 * not a copy of Apple's or Google's terms, so it sits in its own section with
 * its own cap and leaves the licence paragraph's cap alone.
 *
 * Every line is product truth: the stores take payment and renewal; a paid
 * period's speaking time resets to zero when a new period starts (REV-001,
 * `apply_billing_projection`), so unused minutes end with it; and account
 * deletion asks RevenueCat to erase its record but cannot cancel a store
 * subscription, as the privacy notice's "Your rights" section also says.
 */
export const TERMS_SUBSCRIPTIONS_HEADING = 'Subscriptions';
export const TERMS_SUBSCRIPTIONS: readonly string[] = [
  'A subscription renews automatically until you cancel it. If its price changes, the store tells you first, as its rules require.',
  'To stop the next renewal, cancel at least 24 hours before it, in the App Store or Google Play.',
  'A free trial offered through the App Store or Google Play becomes a paid subscription when it ends, unless you cancel before then.',
  'Speaking minutes are for the period they come with. Unused minutes end with that period and are not rolled over to the next.',
  'Deleting your account does not cancel a subscription. Cancel it in the store too.',
];

/** Everything the terms screen says, flattened, for the copy scans. */
export const TERMS_COPY: readonly string[] = [
  TERMS_TITLE,
  ...TERMS_BODY,
  TERMS_SUBSCRIPTIONS_HEADING,
  ...TERMS_SUBSCRIPTIONS,
  TERMS_LINK_LABEL,
];
