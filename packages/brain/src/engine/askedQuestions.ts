/**
 * The in-session question guard: what the tutor has already asked.
 *
 * A beginner who is asked "Tu habites où ?" twice in ten minutes hears a
 * machine, and one who has already answered it hears a machine that was not
 * listening. Nothing stopped it: the model sees the history, but a long
 * history is exactly where a model loses track of its own questions.
 *
 * So code reads them back out of the transcript and the turn context names
 * them. Deterministic and local to the session: nothing here is stored, and no
 * learner text is read, only the tutor's own lines. `repeatsQuestion` runs
 * after the turn and only feeds a log line and the eval; it never triggers a
 * second model call, because a regenerated turn costs a learner a second of
 * waiting to fix something they may not even notice.
 */

import type { ChatMessage } from '../llm/client.ts';

/** How many earlier questions the turn context names. Enough for a session, short enough to read. */
export const MAX_ASKED_QUESTIONS = 6;

/** Case, accents, punctuation and apostrophes set aside, so wording is all that is compared. */
export function normaliseQuestion(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every sentence in a line that ends in a question mark, as written. */
function questionsIn(line: string): string[] {
  const out: string[] = [];
  for (const match of line.matchAll(/[^.!?…]*\?/g)) {
    const question = match[0].trim();
    if (normaliseQuestion(question).length > 0) out.push(question);
  }
  return out;
}

/**
 * The tutor's own questions from this session, oldest first, last six unique.
 * Returned as the tutor said them, accents and all, because they are quoted
 * back to the model in the turn context; uniqueness is decided on the
 * normalised form, so "Tu habites où ?" and "tu habites OÙ ?" are one question.
 *
 * Only the character's spoken line counts. History renders a tutor turn as
 * `(narration) …`, `(coach) …`, `Speaker: line` and bracketed notes; a coach
 * line or a note is not a question the scene asked, and quoting it back would
 * tell the model not to ask something it never asked. The speaker prefix goes
 * because it is the same name on every line and would make every question
 * look alike.
 */
export function askedQuestions(history: readonly ChatMessage[]): string[] {
  const seen: { key: string; text: string }[] = [];
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    for (const raw of message.text.split('\n')) {
      const line = raw.trim();
      if (line.startsWith('(')) continue;
      const spoken = line.replace(/^[^:?]{1,40}:\s*/, '');
      for (const question of questionsIn(spoken)) {
        const key = normaliseQuestion(question);
        const at = seen.findIndex((entry) => entry.key === key);
        if (at !== -1) seen.splice(at, 1);
        seen.push({ key, text: question });
      }
    }
  }
  return seen.slice(-MAX_ASKED_QUESTIONS).map((entry) => entry.text);
}

/**
 * Words too common to say what a question is about. French and English, since
 * the tutor asks in both. "tu habites ou" and "vous habitez ou" share no word
 * after this and still overlap on nothing but the verb stem, which is why the
 * comparison also folds the common tu/vous verb endings below.
 */
const STOP_WORDS = new Set([
  'tu', 'vous', 'tes', 'te', 't', 'toi', 'je', 'j', 'me', 'm', 'moi', 'il', 'elle', 'on', 'nous', 'ils', 'elles',
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux', 'a', 'et', 'ou', 'est', 'es', 'c', 'ce',
  'ca', 'qu', 'que', 'qui', 'quoi', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi', 'quand', 'combien',
  'ton', 'ta', 'votre', 'vos', 'en', 'y', 'pas', 'ne', 'n', 'se', 's', 'sa', 'son', 'ses', 'est', 'ce', 'alors',
  'bon', 'bah', 'hein', 'donc', 'aujourd', 'hui', 'bien', 'oui', 'non', 'si', 'dis', 'moi', 'eh',
  'what', 'where', 'when', 'why', 'how', 'who', 'which', 'do', 'does', 'did', 'you', 'your', 'are', 'is', 'the',
  'an', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'it', 'so', 'today',
]);

/** A word reduced to roughly its stem, so "habites" and "habitez" are one word. */
function stem(word: string): string {
  return word.length > 4 ? word.replace(/(ez|es|er|e|s)$/, '') : word;
}

function contentWords(normalised: string): Set<string> {
  return new Set(normalised.split(' ').filter((w) => w.length > 0 && !STOP_WORDS.has(w)).map(stem));
}

/**
 * The share of content words two questions must have in common to count as the
 * same question asked again. Measured against the shorter question, so a
 * reworded question that adds a word still counts. Two thirds is where
 * "Qu'est-ce que tu fais dans la vie ?" and "Tu fais quoi dans la vie ?" meet
 * and "Tu habites où ?" and "Tu travailles où ?" do not.
 */
export const REPEAT_OVERLAP = 2 / 3;

/**
 * Does this reply ask one of the questions already asked?
 *
 * Exact normalised equality first, then content-word overlap. Returns the
 * earlier question it repeats, or null. Advisory only: see the file header.
 */
export function repeatsQuestion(reply: string, asked: readonly string[]): string | null {
  for (const question of questionsIn(reply)) {
    const key = normaliseQuestion(question);
    const words = contentWords(key);
    for (const earlier of asked) {
      const earlierKey = normaliseQuestion(earlier);
      if (earlierKey === key) return earlier;
      const before = contentWords(earlierKey);
      const smaller = Math.min(words.size, before.size);
      if (smaller === 0) continue;
      let shared = 0;
      for (const word of words) if (before.has(word)) shared += 1;
      if (shared / smaller >= REPEAT_OVERLAP) return earlier;
    }
  }
  return null;
}
