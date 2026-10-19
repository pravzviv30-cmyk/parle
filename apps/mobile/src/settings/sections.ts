/**
 * Every word the Settings screen says, and every word the row that leads to it says.
 *
 * The Profile tab used to be one scroll holding three unrelated things: what a
 * learner chooses about their learning, who the account belongs to, and what the
 * law and the store require the app to say. The second and third moved behind
 * one row. This file is the vocabulary of what moved.
 *
 * ## Why the labels are consts rather than JSX text
 *
 * apps/mobile has no renderer (docs/TESTING.md), so a sentence written inside a
 * `.tsx` is a sentence no test can read back. `profile/dailyGoal.ts` set the
 * convention and `reminders/reminder.ts` gave it the copy list: every string a
 * learner meets is exported, and `SETTINGS_COPY` flattens them so the guilt scan
 * and the em dash walk read the whole surface rather than the exports somebody
 * remembered to name. A row added here is covered the moment it is added.
 *
 * ## What is deliberately not in this file
 *
 * Three groups of words belong to the modules that own the facts behind them,
 * and copying them here would be a second place they could be edited:
 *
 * - `CONTACT_ROW` and the company line are `legal/company.ts`, because whether
 *   they render at all depends on facts that are not supplied yet.
 * - `TERMS_TITLE` is `legal/terms.ts` and `POLICY_TITLE` is `legal/policy.ts`.
 *   Only the Settings row's own wording for the policy lives here, because
 *   `Privacy` is what the document is called and `Privacy policy` is what a
 *   settings row has to say for the tap to be predictable.
 * - The subscription rows are `purchases/subscription.ts`, the consent row is
 *   `analytics/consent.ts` and the phone rows are `settings/phone.ts`. Each of
 *   those has a rule about when it is drawn at all, and the rule and the words
 *   belong together.
 *
 * The delete sheet's own sentences are not here either. They are literals in the
 * screen because `auth/apple.test.ts` names them there: an account with no
 * password this app can check has to be told what will happen instead, and that
 * test was written against the sentence rather than after it.
 *
 * ## No count, anywhere
 *
 * Nothing on either screen carries a digit. There is no minutes row and no
 * remaining time: F377 is the standing decision, the meter is settled on the
 * server at token issuance, and a number the phone cannot verify is the dead
 * switch F239 refused. Both supplied mockups drew one; it stays unbuilt.
 */

/** The screen's own headline, and the label on the row that opens it. */
export const SETTINGS_TITLE = 'Settings';

/** The one row Profile keeps of everything that moved. */
export const SETTINGS_ROW = 'Settings';

/**
 * What is behind the row, in the order the groups appear.
 *
 * It names four of the seven groups rather than all of them, because a row's
 * second line is a promise about where a tap lands and not a table of contents.
 * The reminder is one of the four because it moved here with revamp A, and a
 * learner who set one on Profile has to be able to find it again.
 */
export const SETTINGS_ROW_SUB = 'Account, your plan, reminders and about Luvani';

// ───────────────────────────────────────────────────────────── group headings

export const ACCOUNT_GROUP = 'Account';
/**
 * Over the plan card, which moved here from Profile with revamp A (F576).
 *
 * "Plan" rather than "Your plan": it is a group heading on a screen of group
 * headings, and Account and Subscription either side of it name a subject
 * rather than address the learner. The card under it draws no label of its own.
 */
export const PLAN_GROUP = 'Plan';
export const SUBSCRIPTION_GROUP = 'Subscription';
export const PRIVACY_GROUP = 'Data and privacy';
export const PHONE_GROUP = 'Phone';
export const DISPLAY_ROW = 'Display';
export const DISPLAY_SUB = 'Follow your device, or choose Light or Dark';
export const HELP_GROUP = 'Help';
export const ABOUT_GROUP = 'About';

/** The seven, in the order the screen draws them. A test reads this list. */
export const SETTINGS_GROUPS: readonly string[] = [
  ACCOUNT_GROUP,
  PLAN_GROUP,
  SUBSCRIPTION_GROUP,
  PRIVACY_GROUP,
  PHONE_GROUP,
  HELP_GROUP,
  ABOUT_GROUP,
];

// ───────────────────────────────────────────────────────────────────── account

export const EMAIL_ROW = 'Email';

/**
 * Shown in place of an address the session does not carry.
 *
 * A learner signed in through Apple's private relay, or through a provider that
 * gave us no address, still has an account. The row says so rather than drawing
 * an empty value that reads as a bug.
 */
export const EMAIL_UNKNOWN = 'Signed in';

/** The demo account, which exists on exactly one phone and says so. */
export const DEMO_ROW = 'Account';
export const DEMO_VALUE = 'Demo, stored on this device only';

export const SIGN_OUT_ROW = 'Sign out';
export const DELETE_ROW = 'Delete account';

// ────────────────────────────────────────────────────────── data and privacy

export const SAVED_ROW = 'Saved conversations';
export const SAVED_SUB = 'Manage in My French';

export const DOWNLOAD_ROW = 'Download my data';
export const DOWNLOAD_SUB = 'A copy of your learning history';

/** While the export is being built. A wait, not a percentage. */
export const DOWNLOAD_BUSY = 'Preparing…';
export const DATA_USE_ROW = 'How your data is used';
export const DATA_USE_SUB = 'Providers, saved learning and retention';
export const CONNECTION_HELP_ROW = 'Connection and practice help';
export const CONNECTION_HELP_SUB = 'Pause, typing and audio controls';
export const LOCAL_PRACTICE_ROW = 'Free local practice';
export const LOCAL_PRACTICE_SUB = 'Hear, say and compare without a live room';

// ─────────────────────────────────────────────────────────────────────── about

/**
 * The row, which is longer than the document's own title on purpose.
 *
 * `POLICY_TITLE` is `Privacy`, which is right at the top of a page somebody is
 * already reading. On a list of rows, `Privacy` alone could be a group of
 * settings; `Privacy policy` can only be a document.
 */
export const PRIVACY_POLICY_ROW = 'Privacy policy';

export const ACKNOWLEDGEMENTS_ROW = 'Acknowledgements';

// ────────────────────────────────────────────────────── when the phone refuses

/**
 * Said when a tap that should have opened something opened nothing.
 *
 * One sentence for all three doors out of this screen: the phone's own settings,
 * a mail app, and Apple's licence in a browser sheet. They fail the same way and
 * for the same kind of reason, and three sentences would be three chances to
 * word the same event differently.
 *
 * It does three things, in the shape `REMINDER_SCHEDULE_TROUBLE` set. It puts
 * the refusal on the phone, because that is where it happened and the learner
 * did nothing wrong. It says "just now", so the state reads as a moment rather
 * than a verdict. And it leaves a way forward, which is simply tapping again.
 *
 * A tap that quietly did nothing is the dead switch F239 refused, and on the
 * Contact row it is worse than that: the address is drawn under the label, so
 * somebody whose phone has no mail app can still write to us by reading it.
 */
export const LINK_TROUBLE = 'Your phone would not open that just now. You can try again.';

/**
 * Said when the disk refuses the consent write, and only then.
 *
 * `saveConsent` reports a failed write in one word rather than swallowing it,
 * because this store is the only record of a decision made with a single tap. A
 * switch left showing one answer over a disk holding the other is a withdrawal
 * that is simply gone at the next launch, and nobody is ever told.
 *
 * It lives here rather than in `analytics/consent.ts` for the reason
 * `REMINDER_SAVE_TROUBLE` lives on the screen rather than in `reminder.ts`: this
 * sentence is about this phone, not about the decision. The consent module owns
 * what sharing usage data means; a full disk is somebody else's subject.
 */
export const CONSENT_SAVE_TROUBLE = 'Your phone did not save that. The switch is unchanged, and you can try again.';

/**
 * Every word this file says to a learner, flattened, the way `REMINDER_COPY` is.
 *
 * The scans read the list rather than the exports one by one, so a label added
 * above is covered the moment it is added rather than when somebody remembers.
 */
export const SETTINGS_COPY: readonly string[] = [
  DATA_USE_ROW, DATA_USE_SUB, CONNECTION_HELP_ROW, CONNECTION_HELP_SUB,
  LOCAL_PRACTICE_ROW, LOCAL_PRACTICE_SUB,
  SETTINGS_TITLE,
  DISPLAY_ROW, DISPLAY_SUB,
  SETTINGS_ROW,
  SETTINGS_ROW_SUB,
  ...SETTINGS_GROUPS,
  EMAIL_ROW,
  EMAIL_UNKNOWN,
  DEMO_ROW,
  DEMO_VALUE,
  SIGN_OUT_ROW,
  DELETE_ROW,
  SAVED_ROW,
  SAVED_SUB,
  DOWNLOAD_ROW,
  DOWNLOAD_SUB,
  DOWNLOAD_BUSY,
  PRIVACY_POLICY_ROW,
  ACKNOWLEDGEMENTS_ROW,
  LINK_TROUBLE,
  CONSENT_SAVE_TROUBLE,
];
