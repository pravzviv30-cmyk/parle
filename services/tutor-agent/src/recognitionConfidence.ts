import { stt } from '@livekit/agents';
import type { ReadableStream } from 'node:stream/web';

/** Recognition segments are not learner turns or evidence of language ability. */
export class RecognitionConfidence {
  private known = 0;
  private unavailable = 0;

  observe(event: stt.SpeechEvent | string): string | null {
    if (typeof event === 'string' || event.type !== stt.SpeechEventType.FINAL_TRANSCRIPT) return null;
    // The first alternative is the one the pipeline consumes. Never substitute
    // another alternative's confidence, even if the first is unavailable.
    const value: unknown = event.alternatives?.[0]?.confidence;
    const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
    if (valid) this.known++; else this.unavailable++;
    return `[luvani:recognition] finalSegments=${this.known + this.unavailable} ` +
      `known=${this.known} unavailable=${this.unavailable} confidence=${valid ? value.toFixed(3) : 'unavailable'}`;
  }
}

/** Observe only metadata, without a second audio reader or a retained transcript. */
export async function* observeRecognitionConfidence(
  events: ReadableStream<stt.SpeechEvent | string> | AsyncIterable<stt.SpeechEvent | string>,
  log: (line: string) => void = line => console.info(line),
): AsyncGenerator<stt.SpeechEvent | string> {
  // Counts belong to this STT stream, and reset on reconnection. Missing values
  // are counted separately and never converted into a zero or a learner grade.
  const confidence = new RecognitionConfidence();
  for await (const event of events as AsyncIterable<stt.SpeechEvent | string>) {
    const line = confidence.observe(event);
    if (line !== null) {
      try { log(line); } catch { /* Operator telemetry must not interrupt STT. */ }
    }
    yield event;
  }
}
