/**
 * Bring a real moment: the situations a learner can bring, and the seed they
 * become (F548).
 *
 * The seed topic already rides end to end: the conversation route carries it,
 * the token server signs it into the join credential, and the agent opens the
 * scene on it. Two facts about that pipe shape everything here. The agent
 * speaks the French half aloud as the opening line, so typed English must
 * never land in that slot: the French is authored, one title per kind. And
 * the server drops a seed whose halves exceed its cap, silently, opening a
 * generic conversation instead, and drops a brief over its own cap.
 *
 * Since F929 the kind's name is the whole title, and the learner's words ride
 * in the tutor-only brief, cut on a word to fit, with both caps held equal to
 * the server's by a test that reads the server's source. The brief is what the
 * agent screens for safety. Nothing here reads the words, keeps them, or sends
 * them anywhere but that one slot.
 */

import { includedInMax } from '../access/includedInMax.ts';

export type RealMomentKey =
  | 'interview'
  | 'date'
  | 'hotel-call'
  | 'family-dinner'
  | 'doctor'
  | 'meeting'
  | 'neighbour'
  | 'other';

export interface RealMomentKind {
  key: RealMomentKey;
  /** The authored French the tutor opens on. */
  fr: string;
  /** The kind in the learner's language. */
  en: string;
  /** One line under it saying what the scene asks of them. */
  gloss: string;
}

export const REAL_MOMENTS: readonly RealMomentKind[] = [
  { key: 'interview', fr: 'Un entretien d’embauche', en: 'A job interview', gloss: 'Questions about you, answered calmly.' },
  { key: 'date', fr: 'Un rendez-vous', en: 'A date', gloss: 'Small talk that goes somewhere.' },
  { key: 'hotel-call', fr: 'Un appel à l’hôtel', en: 'A call to a hotel', gloss: 'Booking, asking, confirming.' },
  { key: 'family-dinner', fr: 'Un dîner en famille', en: 'A family dinner', gloss: 'Being asked how things are, and answering.' },
  { key: 'doctor', fr: 'Chez le médecin', en: 'At the doctor', gloss: 'Saying how you feel, and understanding the answer.' },
  { key: 'meeting', fr: 'Une réunion au travail', en: 'A work meeting', gloss: 'Following along and adding your point.' },
  { key: 'neighbour', fr: 'Une conversation avec un voisin', en: 'Meeting a neighbour', gloss: 'Hello, how are things, and a little more.' },
  { key: 'other', fr: 'Une situation à vous', en: 'Something else', gloss: 'Describe it in a line and your tutor sets the scene.' },
];

/** The server's own cap on each half of a seed. Held equal to it by a test. */
export const MAX_SEED_TOPIC_CHARS = 120;
/** The server's cap on the tutor-only brief. Held equal to it by a test. */
export const MAX_SEED_BRIEF_CHARS = 240;

/**
 * The brief's opening (F929). The kind's own name is the title the room shows
 * and the tutor says; the brief, which nobody sees, tells the tutor this is a
 * rehearsal and carries the learner's words. A seed with a brief opens as a
 * fresh topic ("Let's talk about it"), never as a continuation.
 */
const BRIEF_LEAD = 'Help me rehearse a real moment coming up: ';

export function kindOf(key: string): RealMomentKind | null {
  return REAL_MOMENTS.find((kind) => kind.key === key) ?? null;
}

function briefHead(kind: RealMomentKind): string {
  return `${BRIEF_LEAD}${kind.en}.`;
}

/** How many characters of the learner's own words fit in the brief beside this kind. */
export function detailCap(kind: RealMomentKind): number {
  return Math.max(0, MAX_SEED_BRIEF_CHARS - briefHead(kind).length - 1);
}

/**
 * The learner's words, trimmed and cut to what fits. A cut lands on a word
 * boundary when there is one, so the tutor never reads half a word. Never
 * padded, never invented.
 */
export function fitDetail(kind: RealMomentKind, detail: string): string {
  const text = detail.trim();
  const cap = detailCap(kind);
  if (text.length <= cap) return text;
  const cut = text.slice(0, cap);
  const space = cut.lastIndexOf(' ');
  return (space > cap / 2 && !/\s/.test(text[cap] ?? ' ') ? cut.slice(0, space) : cut).trim();
}

export function seedFor(kind: RealMomentKind, detail: string): { fr: string; en: string; brief: string } {
  const fitted = fitDetail(kind, detail);
  return { fr: kind.fr, en: kind.en, brief: fitted.length === 0 ? briefHead(kind) : `${briefHead(kind)} ${fitted}` };
}

/**
 * What the screen opens on when Explore hands it words (B1, 2026-10-20). The
 * typed line lands in "Something else", because Explore asked what is coming
 * up rather than which kind it is, cut to what fits beside that kind. No
 * words, no choice: the screen opens empty as before. Nothing is stored.
 */
export function prefillFor(detail: unknown): { key: RealMomentKey | null; detail: string } {
  const text = typeof detail === 'string' ? detail.trim() : '';
  if (text.length === 0) return { key: null, detail: '' };
  const other = kindOf('other')!;
  return { key: 'other', detail: fitDetail(other, text) };
}

export const REAL_MOMENT_TITLE = 'Prepare for a real moment';
export const REAL_MOMENT_SUB = 'Something coming up? Rehearse it in French with your tutor, at your own pace.';
export const DETAIL_LABEL = 'What do you need to say? (optional)';
export const DETAIL_PLACEHOLDER = 'e.g. Asking a waiter for a table by the window';
export const REHEARSE_ACTION = 'Start my rehearsal';
export const REHEARSE_AGAIN_LABEL = 'Rehearse again';
export const MAX_ONLY_LINE = 'Personal rehearsals are included with Max. Everyday missions and open conversations are available separately.';
export const SEE_PLANS = 'See what Max includes';
/** The plan notice above the situations, one line per answer (Stage 3A). */
export const PLAN_CHECKING = 'Checking your plan…';
/** Shown only once the plan opens rehearsals, which only Max does (F935). */
export const PLAN_INCLUDED = 'Included in Max.';

/** The included line for the plan's real rehearsal capability (`customRehearsal`), null when it does not open them. */
export function planIncluded(customRehearsal: boolean): string | null {
  return includedInMax('realMoment', customRehearsal) === null ? null : PLAN_INCLUDED;
}
export const PLAN_READ_FAILED = 'We could not check your plan. Your choices will stay here while you try again.';

/** Every line this module can say, for the copy sweeps. */
export const REAL_MOMENT_COPY: readonly string[] = [
  ...REAL_MOMENTS.flatMap((kind) => [kind.fr, kind.en, kind.gloss]),
  REAL_MOMENT_TITLE,
  REAL_MOMENT_SUB,
  DETAIL_LABEL,
  DETAIL_PLACEHOLDER,
  REHEARSE_ACTION,
  REHEARSE_AGAIN_LABEL,
  MAX_ONLY_LINE,
  SEE_PLANS,
  PLAN_CHECKING,
  PLAN_INCLUDED,
  PLAN_READ_FAILED,
];
