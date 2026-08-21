/**
 * Per-turn latency accounting.
 *
 * The tutor's felt slowness is a sum of stages that belong to different owners:
 * turn detection (framework), the brain call (convo.ts), and time to first
 * audio (the TTS). One line per turn with each stage priced separately says
 * *which* owner ate the milliseconds, so tuning work lands where the time
 * actually goes instead of where suspicion points.
 *
 * This module is deliberately pure: a record, a mark, a formatter. No clocks,
 * no logging, no imports. Callers pass their own `performance.now()` so the
 * module never disagrees with the caller about what time it is, and tests can
 * hand it exact numbers. Wiring lives with the owners of each stage: agent.ts
 * marks the state transitions, the TTS cache reports first audio, and convo.ts
 * owns the brain marks.
 *
 * Marks are first-write-wins. A stage names a moment ("the first audio frame"),
 * and the first time it happens is the truth; a second sentence's first frame
 * must not overwrite the turn's.
 */

export type TimingStage = 'eou' | 'brainSent' | 'brainParsed' | 'sayCalled' | 'firstAudio' | 'speaking';

export interface TurnTiming {
  /** 1-based turn number, for correlating lines across a session's log. */
  turn: number;
  /** Absolute timestamps in milliseconds, one per stage that has happened. */
  marks: Partial<Record<TimingStage, number>>;
  /**
   * Whether the turn's first audio came from the disk cache or the vendor.
   * Set by the TTS hook; null until audio happens.
   */
  cache: 'hit' | 'miss' | null;
}

export function createTurnTiming(turn: number): TurnTiming {
  return { turn, marks: {}, cache: null };
}

/** Record the moment a stage happened. The first mark for a stage wins. */
export function mark(t: TurnTiming, stage: TimingStage, nowMs: number): void {
  if (t.marks[stage] === undefined) t.marks[stage] = nowMs;
}

/**
 * The segments a turn is billed in, each defined by its two endpoint marks.
 * Order is chronological, so the printed line reads as the turn unfolded.
 */
const SEGMENTS: ReadonlyArray<readonly [label: string, from: TimingStage, to: TimingStage]> = [
  ['eou→brain', 'eou', 'brainSent'],
  ['brain', 'brainSent', 'brainParsed'],
  ['brain→say', 'brainParsed', 'sayCalled'],
  ['say→audio', 'sayCalled', 'firstAudio'],
  ['audio→speaking', 'firstAudio', 'speaking'],
];

/**
 * One log line per turn, e.g.
 *   [parle:latency] turn=3 eou→brain=120ms brain=980ms say→audio=210ms cache=miss
 * Segments whose endpoint marks are missing are omitted rather than printed as
 * zeros: an absent stage is "did not happen", which is information, and a fake
 * 0ms would hide it.
 */
export function formatTiming(t: TurnTiming): string {
  const parts = [`turn=${t.turn}`];
  for (const [label, from, to] of SEGMENTS) {
    const start = t.marks[from];
    const end = t.marks[to];
    if (start === undefined || end === undefined) continue;
    parts.push(`${label}=${Math.round(end - start)}ms`);
  }
  if (t.cache !== null) parts.push(`cache=${t.cache}`);
  return `[parle:latency] ${parts.join(' ')}`;
}

/**
 * One vendor's own numbers for one stage of a turn.
 *
 * The pipeline already measures what Parle was guessing at: time to the voice
 * vendor's first byte, how long the recogniser took to produce a transcript
 * after the learner stopped, how long the turn decision itself took. It emits
 * all of it on an event nothing here subscribed to, so every turn threw the
 * answer away and the same question got argued about instead.
 *
 * Structurally typed on purpose: this module stays import-free, and the shape
 * below is the subset of the framework's metrics union that says something
 * about latency.
 */
export interface VendorMetrics {
  type?: string;
  ttfbMs?: number;
  durationMs?: number;
  audioDurationMs?: number;
  cancelled?: boolean;
  endOfUtteranceDelayMs?: number;
  transcriptionDelayMs?: number;
  onUserTurnCompletedDelayMs?: number;
}

const VENDOR_FIELDS: Record<string, ReadonlyArray<readonly [label: string, key: keyof VendorMetrics]>> = {
  tts_metrics: [
    ['ttfb', 'ttfbMs'],
    ['synth', 'durationMs'],
    ['audio', 'audioDurationMs'],
  ],
  llm_metrics: [['ttfb', 'ttfbMs']],
  eou_metrics: [
    ['eou', 'endOfUtteranceDelayMs'],
    ['transcript', 'transcriptionDelayMs'],
    ['hook', 'onUserTurnCompletedDelayMs'],
  ],
};

/** Short names, because the label is read next to five others in a log. */
const VENDOR_STAGE: Record<string, string> = {
  tts_metrics: 'tts',
  llm_metrics: 'llm',
  eou_metrics: 'eou',
};

/**
 * One log line per vendor measurement, e.g.
 *   [parle:metrics] tts ttfb=210ms synth=430ms audio=1900ms
 * Null when the payload carries nothing about latency, so callers can stay
 * silent rather than printing an empty line for every VAD tick.
 *
 * An `llm` line in a CONVERSATION is itself the finding: that pipeline model is
 * told it is unused, so any completion it reports was speculative, billed and
 * discarded (H2).
 */
export function formatVendorMetrics(metrics: VendorMetrics): string | null {
  const stage = VENDOR_STAGE[metrics.type ?? ''];
  const fields = VENDOR_FIELDS[metrics.type ?? ''];
  if (stage === undefined || fields === undefined) return null;

  const parts: string[] = [];
  for (const [label, key] of fields) {
    const value = metrics[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    parts.push(`${label}=${Math.round(value)}ms`);
  }
  if (parts.length === 0) return null;
  if (metrics.cancelled === true) parts.push('cancelled');
  return `[parle:metrics] ${stage} ${parts.join(' ')}`;
}
