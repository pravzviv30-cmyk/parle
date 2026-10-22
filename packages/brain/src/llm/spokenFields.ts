/**
 * Notice, while a structured turn is still streaming in, the moment its spoken
 * fields are complete.
 *
 * Strict structured output writes the turn's properties in schema order, and
 * `TurnSchema` puts every field the spoken line depends on first, ending with
 * `sceneReply`, whose own first two properties are `speaker` and `fr`. Only
 * `sceneReply.fr` is ever spoken from the reply (`frWritten` and `en` are
 * display only), so the moment the string value of `fr` inside the top-level
 * `sceneReply` has closed, the text received so far plus two closing braces is
 * a complete JSON object holding exactly the spoken fields. It is parsed and
 * validated against `EarlySpokenTurnSchema`, the same rules the full turn is
 * held to, and handed over only if it passes. Anything unexpected (a different
 * key order, a value that does not validate, malformed text) simply means no
 * early hand-over: the full turn still arrives and is handled exactly as before.
 *
 * The scanner is a few lines of state, not a JSON parser: it tracks string and
 * escape state and nesting depth, and only cares about keys at the top level
 * and, inside the top-level `sceneReply` object, at the level below. A `fr`
 * key anywhere else (the narration, a coach item) never triggers it.
 */

import { EarlySpokenTurnSchema } from '../contract/schemas.ts';
import type { EarlySpokenTurn } from '../contract/types.ts';

/** The top-level key holding the spoken reply. */
export const LAST_SPOKEN_FIELD = 'sceneReply';
/** The key inside the reply whose string value is the last thing spoken. */
export const LAST_SPOKEN_KEY = 'fr';

export class SpokenFieldsWatcher {
  private text = '';
  private scanned = 0;
  private inString = false;
  private escaped = false;
  private depth = 0;
  /** The next string at this depth is a key (after `{` or `,`) rather than a value. */
  private expectingKey = false;
  private stringStart = -1;
  /** The current key at depth 1. */
  private topKey: string | null = null;
  /** The current key at depth 2, tracked only inside the top-level reply object. */
  private innerKey: string | null = null;
  /** Whether depth 2 is the top-level reply's own object (not an array or another value). */
  private inReply = false;
  private done = false;

  /**
   * Feed the next chunk of streamed text. Returns the validated spoken fields
   * the first time they are complete, and null every other time.
   */
  feed(chunk: string): EarlySpokenTurn | null {
    if (this.done) return null;
    this.text += chunk;
    for (; this.scanned < this.text.length; this.scanned += 1) {
      const ch = this.text[this.scanned]!;
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === '\\') this.escaped = true;
        else if (ch === '"') {
          this.inString = false;
          const tracked = this.depth === 1 || (this.depth === 2 && this.inReply);
          if (tracked && this.expectingKey) {
            let key: string | null;
            try { key = JSON.parse(this.text.slice(this.stringStart, this.scanned + 1)) as string; }
            catch { key = null; }
            if (this.depth === 1) { this.topKey = key; this.innerKey = null; this.inReply = false; }
            else this.innerKey = key;
            this.expectingKey = false;
          } else if (this.depth === 2 && this.inReply && this.innerKey === LAST_SPOKEN_KEY) {
            // The reply's spoken French has closed: close the reply and the turn.
            return this.handOver(this.scanned + 1);
          }
        }
        continue;
      }
      if (ch === '"') { this.inString = true; this.stringStart = this.scanned; continue; }
      if (ch === '{' || ch === '[') {
        this.depth += 1;
        if (this.depth === 1) this.expectingKey = true;
        else if (this.depth === 2 && ch === '{' && this.topKey === LAST_SPOKEN_FIELD) {
          this.inReply = true;
          this.expectingKey = true;
        }
        continue;
      }
      if (ch === '}' || ch === ']') {
        this.depth -= 1;
        if (this.depth === 1) {
          // The reply closed without a string `fr`: not a reply that can be spoken early.
          if (this.inReply) { this.done = true; return null; }
          this.inReply = false;
        }
        continue;
      }
      if (ch === ',' && (this.depth === 1 || (this.depth === 2 && this.inReply))) this.expectingKey = true;
    }
    return null;
  }

  private handOver(end: number): EarlySpokenTurn | null {
    this.done = true;
    this.scanned = this.text.length;
    return earlySpokenFrom(this.text.slice(0, end));
  }
}

/**
 * The leading text of a turn, ending just after the closing quote of
 * `sceneReply.fr`, closed (reply object, then turn) and validated, or null.
 */
export function earlySpokenFrom(prefix: string): EarlySpokenTurn | null {
  try {
    const parsed = EarlySpokenTurnSchema.safeParse(JSON.parse(`${prefix.trimEnd()}}}`));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
