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
 * generic conversation instead, so the learner's own words are cut to fit
 * beside the kind's English before they are sent, and the cap is held equal to
 * the server's by a test that reads the server's source.
 *
 * The learner's words ride the English half only, which is the half the agent
 * screens for safety. Nothing here reads them, keeps them, or sends them
 * anywhere but that one slot.
 */

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

/** The kind and the detail meet with this between them. */
const JOIN = '. ';

export function kindOf(key: string): RealMomentKind | null {
  return REAL_MOMENTS.find((kind) => kind.key === key) ?? null;
}

/** How many characters of the learner's own words fit beside this kind. */
export function detailCap(kind: RealMomentKind): number {
  return Math.max(0, MAX_SEED_TOPIC_CHARS - kind.en.length - JOIN.length);
}

/** The learner's words, trimmed and cut to what fits. Never padded, never invented. */
export function fitDetail(kind: RealMomentKind, detail: string): string {
  return detail.trim().slice(0, detailCap(kind)).trim();
}

export function seedFor(kind: RealMomentKind, detail: string): { fr: string; en: string } {
  const fitted = fitDetail(kind, detail);
  return { fr: kind.fr, en: fitted.length === 0 ? kind.en : `${kind.en}${JOIN}${fitted}` };
}

export const REAL_MOMENT_TITLE = 'Bring a real moment';
export const REAL_MOMENT_SUB = 'Something coming up in your life. Your tutor sets the scene and you run it in French first.';
export const DETAIL_LABEL = 'One line about it, if you like';
export const DETAIL_PLACEHOLDER = 'Who is there, and what you want to say';
export const REHEARSE_ACTION = 'Rehearse it';
export const REHEARSE_AGAIN_LABEL = 'Rehearse again';
export const MAX_ONLY_LINE = 'Rehearsing a moment of your own comes with the Max plan.';
export const SEE_PLANS = 'See the plans';

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
];
