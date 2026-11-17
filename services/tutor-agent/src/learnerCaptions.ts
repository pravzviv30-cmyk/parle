/**
 * The learner's own words, live (F985), joined cleanly (F986), and the words
 * the pipeline dropped over an uninterruptible line split off (F987).
 *
 * Fed from the sttNode observer chain. Holds only the finals since the last
 * hook exit, bounded, and nothing once `take` runs. Logs no words.
 * Behind LUVANI_LEARNER_CAPTIONS=1 (default off, VOICE-022).
 */
import { stt } from '@livekit/agents';
import type { ReadableStream } from 'node:stream/web';

export const CAPTION_MAX_BYTES = 500;
/** Four frames a second at most. */
export const CAPTION_MIN_INTERVAL_MS = 250;
export const CAPTION_MAX_SEGMENTS = 32;

export function learnerCaptionsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.LUVANI_LEARNER_CAPTIONS === '1';
}

/** One capital that is not an acronym or the English "I". */
function lowerFirst(text: string): string {
  return /^\p{Lu}(?!\p{Lu})/u.test(text) && !/^I(?![\p{L}])/u.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;
}

/** A standalone `--` goes, and the word after it loses its capital. */
function dropDashes(text: string): string {
  return text.replace(/\s+--\s+(\S)/gu, (_m, next: string) => ` ${lowerFirst(next)}`).replace(/^--\s+|\s+--$/u, '').trim();
}

/** Flux finals joined the way a sentence reads: no mid-sentence capital, dash or ellipsis at a split. */
export function joinHeard(segments: readonly string[]): string {
  let out = '';
  for (const raw of segments) {
    let segment = dropDashes(raw.trim());
    if (!segment) continue;
    if (out) {
      out = out.replace(/\s*(?:--|\.\.\.|…)$/u, '');
      if (!/[.!?]$/u.test(out)) segment = lowerFirst(segment);
      out = `${out} ${segment}`;
    } else out = segment;
  }
  return out;
}

export interface SplitHeard { text: string; overheard: string | null; dropped: number }

/**
 * The committed text, and the leading finals the SDK dropped. The SDK joins
 * finals with one space; when its text is exactly a trailing run of the
 * captured finals, the ones before it were said over an uninterruptible line.
 * Anything else keeps the SDK's text with only the dash rule.
 */
export function splitHeard(segments: readonly string[], committed: string): SplitHeard {
  const captured = segments.map((s) => s.trim()).filter(Boolean);
  const target = committed.trim();
  for (let k = 0; k < captured.length; k += 1) {
    if (captured.slice(k).join(' ') === target) {
      return { text: joinHeard(captured.slice(k)), overheard: k > 0 ? joinHeard(captured.slice(0, k)) : null, dropped: k };
    }
  }
  return { text: dropDashes(target), overheard: null, dropped: 0 };
}

type Clock = {
  now(): number;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(timer: unknown): void;
};
const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

/** The tail of a caption that fits the byte cap: the newest words matter most. */
function capped(text: string): string {
  let out = text;
  while (Buffer.byteLength(out) > CAPTION_MAX_BYTES) out = out.slice(out.indexOf(' ') > 0 ? out.indexOf(' ') + 1 : 1);
  return out;
}

export class LearnerCaptions {
  private finals: string[] = [];
  private interim = '';
  private shown = '';
  private lastAt = -Infinity;
  private pending: unknown;
  private frames = 0;
  private readonly publish: (text: string) => void;
  private readonly clock: Clock;

  constructor(publish: (text: string) => void, clock: Clock = realClock) {
    this.publish = publish;
    this.clock = clock;
  }

  observe(event: stt.SpeechEvent | string): void {
    if (typeof event === 'string') return;
    const text = event.alternatives?.[0]?.text?.trim() ?? '';
    if (event.type === stt.SpeechEventType.FINAL_TRANSCRIPT) {
      if (text) { this.finals.push(text); if (this.finals.length > CAPTION_MAX_SEGMENTS) this.finals.shift(); }
      this.interim = '';
    } else if (event.type === stt.SpeechEventType.INTERIM_TRANSCRIPT || event.type === stt.SpeechEventType.PREFLIGHT_TRANSCRIPT) {
      this.interim = text;
    } else return;
    this.show();
  }

  private show(): void {
    if (this.pending !== undefined) return; // the trailing frame reads the latest text
    const wait = this.lastAt + CAPTION_MIN_INTERVAL_MS - this.clock.now();
    if (wait > 0) { this.pending = this.clock.setTimeout(() => { this.pending = undefined; this.show(); }, wait); return; }
    const caption = capped([...this.finals, this.interim].filter(Boolean).join(' '));
    if (caption === this.shown) return;
    this.shown = caption;
    this.lastAt = this.clock.now();
    this.frames += 1;
    this.publish(caption);
  }

  /** At a hook exit: split the committed text, then forget every segment. */
  take(committed: string): SplitHeard & { frames: number; segments: number } {
    const result = { ...splitHeard(this.finals, committed), frames: this.frames, segments: this.finals.length };
    if (this.pending !== undefined) this.clock.clearTimeout(this.pending);
    this.pending = undefined;
    this.finals = [];
    this.interim = '';
    this.shown = '';
    this.frames = 0;
    return result;
  }
}

/** Pass every event through, showing the learner's words as they come. */
export async function* observeLearnerCaptions(
  events: ReadableStream<stt.SpeechEvent | string> | AsyncIterable<stt.SpeechEvent | string>,
  captions: LearnerCaptions,
): AsyncGenerator<stt.SpeechEvent | string> {
  for await (const event of events as AsyncIterable<stt.SpeechEvent | string>) {
    try { captions.observe(event); } catch { /* A caption must never interrupt recognition. */ }
    yield event;
  }
}
