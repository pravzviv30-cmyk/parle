/**
 * What a stored answer about usage data means, and the words a learner reads.
 *
 * `consentStore.ts` answers what is on the disk. This file answers the only
 * question anything else ever asks about it: may this event be sent. The split
 * is deliberate — a store that decided would have to decide for a blob it could
 * not parse, and the safe reading of an unparseable permission is not a storage
 * question.
 *
 * ## Only a literal true
 *
 * `analyticsAllowed` takes `unknown` rather than `StoredConsent | null`, which
 * looks like a weaker type and is a stronger check. The value has been through
 * a JSON blob and a device's disk, and the compiler's word for what came back
 * is a claim about a build rather than about a byte. Taking `unknown` means the
 * rule is written where a test can point junk at it: a missing record, a
 * half-written blob, a version this build does not know, a string `'true'`, a
 * `1`, and nobody signed in all read as no.
 *
 * The asymmetry only runs one way, and it is the whole point. Reading anything
 * but a real `true` as agreement would send events for a learner who never said
 * yes. Reading a genuine yes as no costs that learner nothing at all: nothing in
 * the product works differently either way, which is the promise
 * PRIVACY_AND_SAFETY.md makes under "Analytics: consent, opt-out and retention".
 *
 * ## Citations here name a section, never a line
 *
 * Both references below used to carry a line number into that file, and both
 * had rotted before anybody noticed: every edit above them moved the paragraph
 * they pointed at, and a comment cannot be moved by the edit that invalidates
 * it. So a citation names the heading it is under (F486). A heading is renamed
 * deliberately and rarely, and the test that walks these files reads the
 * document to check the heading is still there.
 *
 * ## Three sentences, and what they may not say
 *
 * The row is off until somebody turns it on, so the copy has nothing to
 * persuade anyone of. It names no count of events, because a count rots the day
 * a sixth one lands, and it names no retention, because the scheduled delete
 * that would make a period true does not exist yet, which
 * PRIVACY_AND_SAFETY.md records under "Not true yet". The full account of both
 * lives in `legal/policy.ts`, where it can be as long as it needs to be.
 */

/**
 * True only for a stored literal `true`. Everything else is no.
 *
 * Read fresh by `trackProductEvent` on every event rather than cached, so a
 * withdrawal takes effect on the next event rather than on the next launch.
 */
export function analyticsAllowed(stored: unknown): boolean {
  if (typeof stored !== 'object' || stored === null) return false;
  return (stored as { allowed?: unknown }).allowed === true;
}

/** The switch itself. Named for what it does, not for what it would give us. */
export const CONSENT_ROW = 'Share usage data';

/**
 * What is in an event, and the half that matters more: what is never in one.
 *
 * "Never what you say" is the sentence a learner is actually asking about when
 * they read the row, so it is in the row rather than one screen deeper.
 */
export const CONSENT_SUB = 'How you use the app, such as finishing a situation. Never what you say.';

/** Where the switch starts, and that the answer is not final. */
export const CONSENT_HINT = 'Off unless you turn it on. You can change it later in Settings.';

/**
 * Every word this decision says to a learner, flattened, the way `REMINDER_COPY`
 * is. The guilt scan reads the list rather than the exports one by one, so a
 * fourth sentence is covered the moment it is added here.
 */
export const CONSENT_COPY: readonly string[] = [CONSENT_ROW, CONSENT_SUB, CONSENT_HINT];
