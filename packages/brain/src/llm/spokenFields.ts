/**
 * Notice, while a structured turn is still streaming in, the moment its spoken
 * fields are complete.
 *
 * Strict structured output writes the turn's properties in schema order, and
 * `TurnSchema` puts every field the spoken line depends on first, ending with
 * `sceneReply`. So once the top-level `sceneReply` value has closed, the text
 * received so far plus one closing brace is a complete JSON object holding
 * exactly those fields. It is parsed and validated against
 * `EarlySpokenTurnSchema`, the same rules the full turn is held to, and handed
 * over only if it passes. Anything unexpected (a different key order, a value
 * that does not validate, malformed text) simply means no early hand-over: the
 * full turn still arrives and is handled exactly as before.
 *
 * The scanner is a few lines of state, not a JSON parser: it tracks string and
 * escape state and nesting depth, and only cares about keys at the top level.
 */

import { EarlySpokenTurnSchema } from '../contract/schemas.ts';
import type { EarlySpokenTurn } from '../contract/types.ts';

/** The top-level key whose closing marks the end of the spoken fields. */
export const LAST_SPOKEN_FIELD = 'sceneReply';

export class SpokenFieldsWatcher {
  private text = '';
  private scanned = 0;
  private inString = false;
  private escaped = false;
  private depth = 0;
  /** At depth 1, the next string is a key (after `{` or `,`) rather than a value. */
  private expectingKey = false;
  private stringStart = -1;
  private currentKey: string | null = null;
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
          if (this.depth === 1 && this.expectingKey) {
            try { this.currentKey = JSON.parse(this.text.slice(this.stringStart, this.scanned + 1)) as string; }
            catch { this.currentKey = null; }
            this.expectingKey = false;
          }
        }
        continue;
      }
      if (ch === '"') { this.inString = true; this.stringStart = this.scanned; continue; }
      if (ch === '{' || ch === '[') {
        this.depth += 1;
        if (this.depth === 1) this.expectingKey = true;
        continue;
      }
      if (ch === '}' || ch === ']') {
        this.depth -= 1;
        if (this.depth === 1 && this.currentKey === LAST_SPOKEN_FIELD) return this.handOver(this.scanned + 1);
        continue;
      }
      if (ch === ',' && this.depth === 1) {
        // A scalar or null value for the last spoken key ends at this comma.
        if (this.currentKey === LAST_SPOKEN_FIELD) return this.handOver(this.scanned);
        this.expectingKey = true;
      }
    }
    return null;
  }

  private handOver(end: number): EarlySpokenTurn | null {
    this.done = true;
    this.scanned = this.text.length;
    return earlySpokenFrom(this.text.slice(0, end));
  }
}

/** The leading text of a turn, closed and validated, or null. */
export function earlySpokenFrom(prefix: string): EarlySpokenTurn | null {
  try {
    const parsed = EarlySpokenTurnSchema.safeParse(JSON.parse(`${prefix.trimEnd()}}`));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
