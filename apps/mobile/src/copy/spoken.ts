/**
 * Short labels read aloud as sentences.
 *
 * A screen reader pauses on a full stop, so a label built from parts reads
 * each part as its own sentence. A part that already ends one ("… s’il vous
 * plaît.", "Ta journée, ça a été ?") keeps its own mark rather than gaining a
 * second, which read as "plaît.." and "été ?." before this was shared.
 */

/**
 * A line that already closes a sentence, allowing closing quotes or brackets
 * after the mark. French sets a space, often a no-break one, before « », so
 * whitespace may sit between the mark and each closer.
 */
export const SENTENCE_END = /[.!?…](?:\s*[»"”’)\]])*$/;

/** The parts as sentences, trimmed, skipping absent or blank ones. */
export function asSentences(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim())
    .map((part) => (SENTENCE_END.test(part) ? part : `${part}.`))
    .join(' ');
}
