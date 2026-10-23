/**
 * Live pronunciation scoring, beside the turn and never in front of it (VOICE-004).
 *
 * One scorer for both session shapes: the scripted lesson and the free
 * conversation. Words and sounds stay separate. The turn is graded and answered
 * from the transcript; the audio goes to the scorer here, nobody waits for it,
 * and whatever has landed by the end is what the end card reports.
 */
import { matchAcceptable, type LessonTurn, type PhonemeObservation } from '@luvani/core';
import { scoreUtterance } from '../../shared/pronunciation.ts';
import { toSpeechaceWav } from '../../shared/liveScoringAudio.ts';
import { safeError } from './safeError.ts';
import type { RuntimeLifecycle } from './sessionLifecycle.ts';

/**
 * How long a finishing session waits for scores still in flight before it
 * writes the end card without them. Short, because the learner is looking at
 * a spinner: a score that has not landed by now is reported as not assessed,
 * which is honest, rather than awaited.
 */
export const SCORE_SETTLE_MS = 2_500;

/** Under this many seconds left before the hard limit, a finishing session does not wait for scores. */
export const SETTLE_DEADLINE_MARGIN_SEC = 5;

/** How long one background score may take: the most `scoreUtterance` allows. */
export const LIVE_SCORE_TIMEOUT_MS = 10_000;

let conversionWarned = false;
/** Once per process: a capture the paid scorer cannot take is a fleet-wide fact, not a per-turn one. */
function warnConversionOnce(error: unknown): void {
  if (conversionWarned) return;
  conversionWarned = true;
  console.warn('[luvani] live audio could not be converted for scoring; these utterances stay unscored:', safeError(error));
}

/** Is the session too close to its hard limit to spend any time waiting on a score? */
export function nearHardLimit(lifecycle: Pick<RuntimeLifecycle, 'maxSeconds' | 'elapsedSeconds'> | undefined): boolean {
  return lifecycle ? lifecycle.maxSeconds - lifecycle.elapsedSeconds() < SETTLE_DEADLINE_MARGIN_SEC : false;
}

/**
 * Did the learner say the line the scorer will compare them against?
 *
 * Accuracy scoring force-aligns the reference text to the whole clip, so it
 * means something only when the clip is that line and nothing else. The line
 * itself, the line with hesitation fillers, or the line with one recognition
 * slip all count, which keeps an accented learner whose transcript came back a
 * little off in scope. Grading's looser content match does not: "un café et un
 * croissant s'il vous plaît" carries every content word of the reference, but
 * the extra words would be scored against reference sounds and name a focus
 * the learner never got wrong.
 */
export function saidTheLine(reference: string, transcript: string): boolean {
  // Reference only: no accepted alternatives and no options, so nothing but the line itself matches.
  const line: LessonTurn = { id: 'scored-line', tutor: '', tutorEn: '', target: reference, targetEn: '', targetIpa: '',
    reference, focusPhonemes: [], options: [], hint: '', accepts: [] };
  const match = matchAcceptable(line, transcript);
  return match.via === 'exact' || match.via === 'filler' || match.via === 'typo';
}

export interface LiveScoringOptions {
  /** The paid transport. When set, audio is converted to the gate's exact WAV first. */
  scoringRequest?: typeof fetch;
  scorer?: typeof scoreUtterance;
  /** Read per score: the lifecycle may be attached after construction. */
  signal?: () => AbortSignal | undefined;
  /** The reviewed scoring envelope: no more than this many scores are asked for. */
  maxScores?: number;
}

export class LiveScoring {
  private readonly scoringRequest: typeof fetch | undefined;
  private readonly scorer: typeof scoreUtterance;
  private readonly signal: () => AbortSignal | undefined;
  private readonly maxScores: number;
  /**
   * Sound evidence gathered beside the turns, one entry per scored utterance.
   * Kept out of the session state on purpose: a score lands whenever the
   * vendor answers, and the turns and the checkpoints never wait for it.
   */
  private readonly scored: PhonemeObservation[][] = [];
  private readonly pending = new Set<Promise<void>>();
  private closed = false;
  private requested = 0;

  constructor(options: LiveScoringOptions = {}) {
    this.scoringRequest = options.scoringRequest;
    this.scorer = options.scorer ?? scoreUtterance;
    this.signal = options.signal ?? (() => undefined);
    this.maxScores = options.maxScores ?? Infinity;
  }

  get utterances(): readonly PhonemeObservation[][] { return this.scored; }

  /** Utterances that came back with evidence. */
  get scoredCount(): number { return this.scored.length; }

  /**
   * Score one utterance without anybody waiting for it.
   *
   * Through the paid transport the audio must be the gate's exact 16 kHz mono
   * WAV, made here from the PCM the tap already holds rather than by the
   * external decoder (F805). Anything that cannot be made into it, a vendor
   * that times out or returns nothing, a score past the envelope, and a score
   * landing after the end card was written all leave no evidence, which the
   * card reports as not assessed.
   *
   * `onScored`, when given, hears each utterance that came back with evidence,
   * with the audio exactly as it was scored. The lesson uses it to offer a
   * consented dataset clip (VOICE-007); it never runs after `settle` closes.
   */
  score(wav: Uint8Array, reference: string, onScored?: (observations: PhonemeObservation[], audio: Uint8Array) => void): void {
    if (this.closed || this.requested >= this.maxScores) return;
    let audio: Uint8Array;
    try { audio = this.scoringRequest ? toSpeechaceWav(wav) : wav; } catch (error) {
      warnConversionOnce(error);
      return;
    }
    this.requested += 1;
    const signal = this.signal();
    const work: Promise<void> = Promise.resolve().then(() => this.scorer({ reference, audio }, {
      // Nobody waits on this, so it gets the vendor's full budget: a cold
      // TonePerfect call measured past five seconds on 2026-10-22, then 1 to 2.5.
      timeoutMs: LIVE_SCORE_TIMEOUT_MS,
      ...(this.scoringRequest ? { fetchFn: this.scoringRequest } : {}),
      ...(signal ? { signal } : {}),
    })).then((observations) => {
      if (this.closed || observations.length === 0) return;
      this.scored.push(observations);
      // The caller's business. A throw there must not cost the session its evidence.
      try { onScored?.(observations, audio); } catch { /* the score still counts */ }
    }).catch(() => {}).finally(() => { this.pending.delete(work); });
    this.pending.add(work);
  }

  /**
   * Give scores still in flight a short, bounded chance to land, then close.
   *
   * Called before the lifecycle completes, because completing aborts the
   * signal every score is running on. Nothing after this adds evidence.
   * `skip` is for a safety stop or a session at its hard limit: neither waits.
   */
  async settle(options: { skip: boolean }): Promise<void> {
    if (this.pending.size > 0 && !options.skip) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.allSettled([...this.pending]),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, SCORE_SETTLE_MS); }),
      ]);
      if (timer) clearTimeout(timer);
    }
    this.closed = true;
  }
}
