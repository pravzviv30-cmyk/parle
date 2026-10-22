/**
 * "Report this reply": what the closed beta's report control writes, and only that.
 *
 * Luvani keeps no transcript, so a report that arrives as "the tutor said
 * something odd" cannot be matched to anything. The one thing that makes it
 * answerable is a reference: the session id, which the server's own session
 * record already carries, and the app version, which says which build drew the
 * room. That is the whole subject. There is no body, and nothing the learner
 * or the tutor said is ever attached: the learner writes what they want, in
 * their own words, or nothing at all.
 *
 * Pure on purpose, with no Expo or React Native import, so `node --test` can
 * load it and the subject's shape is executed rather than read. The mail app
 * itself is reached through `settings/links.ts` `openMail`, the one file
 * allowed to hand a learner to the OS mail app (`phoneSettings.test.ts`).
 */

import { contactRow, type CompanyFacts, COMPANY } from '../legal/company.ts';

/** A part we know, or null for one we do not. Blank strings count as unknown. */
function known(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * "Luvani report, session <id>, app <version>", each part dropped when unknown.
 *
 * The full session id, never shortened: a prefix is a reference that might
 * match two sessions.
 */
export function reportSubject({ sessionId, version }: { sessionId: string | null | undefined; version: string | null | undefined }): string {
  const parts = ['Luvani report'];
  const session = known(sessionId);
  const app = known(version);
  if (session !== null) parts.push(`session ${session}`);
  if (app !== null) parts.push(`app ${app}`);
  return parts.join(', ');
}

/**
 * Where a report goes, or null when there is nowhere to send one.
 *
 * Read through `contactRow` so the report control and the Contact us row stand
 * or fall together: no supplied address, no control (`legal/company.ts`).
 */
export function reportAddress(facts: CompanyFacts = COMPANY): string | null {
  return contactRow(facts)?.address ?? null;
}

/** Every word the report sheet and its links say. */
export const REPORT_COPY = {
  title: 'Report this reply',
  /** `what` is "said" in the room and "said in this session" on the end cards. */
  body: (tutorName: string, what: 'reply' | 'session' = 'reply') =>
    `Did something ${tutorName} said${what === 'session' ? ' in this session' : ''} seem wrong or odd? Tell us by email. Your mail app opens with a reference number for this session. Nothing you said is attached.`,
  reply: 'We read every report and reply within two working days.',
  safety: 'This is not an emergency line. If you are in danger, call your local emergency number.',
  write: 'Write to us',
  notNow: 'Not now',
  close: 'Close',
  failed: (address: string) => `Your phone would not open your mail app. You can write to ${address}.`,
  endLink: 'Something felt off? Tell us',
  control: 'Report this reply',
} as const;
