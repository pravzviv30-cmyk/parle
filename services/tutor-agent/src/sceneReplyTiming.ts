/** Numeric-only worker dispatch timing. No audio, words or account identifiers. */
export type SceneReplyStage = 'brainSent' | 'brainParsed' | 'sayCalled';
export type SceneReplyOutcome = 'dispatched' | 'failed' | 'cancelled';
export interface SceneReplyTimingRecord {
  mark(stage: SceneReplyStage): void;
  finish(outcome: SceneReplyOutcome): void;
  firstFrame?(): void;
}

const WINDOW = 128;
const noRecord: SceneReplyTimingRecord = { mark() {}, finish() {} };

function percentile(sorted: readonly number[], fraction: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
}

export function createSceneReplyTiming(clock: () => number) {
  let speechEnd: number | undefined;
  let ambiguous = false;
  let pendingEnds = 0;
  let closed = false;
  let closeLine: string | undefined;
  let started = 0, dispatched = 0, failed = 0, cancelled = 0, missing = 0;
  const samples: number[] = [];
  const audioSamples: number[] = [];
  let audioSeen = 0, audioInvalid = 0;
  const active = new Set<SceneReplyTimingRecord>();

  function snapshot() {
    const sorted = [...samples].sort((a, b) => a - b);
    return {
      started, dispatched, failed, cancelled, missing, active: active.size,
      n: sorted.length, p50Ms: percentile(sorted, 0.5), p95Ms: percentile(sorted, 0.95),
    };
  }
  function format() {
    const report = snapshot();
    const quantiles = report.n === 0 ? '' :
      ` p50=${Math.round(report.p50Ms!)}ms p95=${Math.round(report.p95Ms!)}ms`;
    return `[luvani:scene-latency] boundary=framework-eou-to-say window=last${WINDOW}` +
      ` n=${report.n}${quantiles} started=${started} dispatched=${dispatched}` +
      ` failed=${failed} cancelled=${cancelled} missing=${missing} active=${active.size}` +
      ' first-audio=unmeasured phone-audible=unmeasured';
  }
  function begin(eligible = true): SceneReplyTimingRecord {
    if (closed) return noRecord;
    const observedAt = clock();
    const eou = !ambiguous && speechEnd !== undefined && Number.isFinite(observedAt) &&
      speechEnd <= observedAt ? speechEnd : undefined;
    speechEnd = undefined;
    pendingEnds = Math.max(0, pendingEnds - 1);
    ambiguous = pendingEnds > 0;
    if (!eligible) return noRecord;
    started++;
    const marks: Partial<Record<SceneReplyStage, number>> = {};
    let finished = false;
    let dispatchedReply = false;
    let frameSeen = false;
    const record: SceneReplyTimingRecord = {
      mark(stage) {
        if (finished || marks[stage] !== undefined) return;
        marks[stage] = clock();
      },
      firstFrame() {
        if (closed || frameSeen || !dispatchedReply) return;
        frameSeen = true; audioSeen++;
        const now = clock();
        const ordered = [eou, marks.brainSent, marks.brainParsed, marks.sayCalled, now];
        const valid = ordered.every((value, index) => value !== undefined && Number.isFinite(value) &&
          (index === 0 || value >= ordered[index - 1]!));
        if (!valid || now - eou! > 15 * 60_000) { audioInvalid++; return; }
        audioSamples.push(now - eou!); if (audioSamples.length > WINDOW) audioSamples.shift();
      },
      finish(outcome) {
        if (finished) return;
        finished = true;
        active.delete(record);
        if (outcome === 'failed') { failed++; return; }
        if (outcome === 'cancelled') { cancelled++; return; }
        dispatchedReply = true;
        dispatched++;
        const ordered = [eou, marks.brainSent, marks.brainParsed, marks.sayCalled];
        const valid = ordered.every((value, index) =>
          value !== undefined && Number.isFinite(value) &&
          (index === 0 || value >= ordered[index - 1]!));
        if (!valid) { missing++; return; }
        samples.push(marks.sayCalled! - eou!);
        if (samples.length > WINDOW) samples.shift();
      },
    };
    active.add(record);
    return record;
  }
  return {
    begin, snapshot, format,
    audioSnapshot() {
      const sorted = [...audioSamples].sort((a, b) => a - b);
      return { n: sorted.length, p50Ms: percentile(sorted, 0.5), p95Ms: percentile(sorted, 0.95), audioSeen, audioInvalid, noFrame: dispatched - audioSeen };
    },
    audioFormat() {
      const sorted = [...audioSamples].sort((a, b) => a - b);
      const quantiles = sorted.length === 0 ? '' : ` p50=${Math.round(percentile(sorted, 0.5)!)}ms p95=${Math.round(percentile(sorted, 0.95)!)}ms`;
      return `[luvani:scene-first-frame] boundary=framework-eou-to-worker-tts-frame window=last${WINDOW}` +
        ` n=${sorted.length}${quantiles} invalid=${audioInvalid} no-frame=${dispatched - audioSeen} phone-audible=unmeasured`;
    },
    invalidate() {
      if (pendingEnds > 0) ambiguous = true;
      speechEnd = undefined;
    },
    speechStarted() {
      // A newer utterance may precede the old utterance's delayed callback.
      // Clearing only its timestamp would let the newer EOU replace it.
      if (pendingEnds > 0) ambiguous = true;
      speechEnd = undefined;
    },
    speechEnded(nowMs: number) {
      if (closed) return;
      if (pendingEnds > 0) ambiguous = true;
      pendingEnds++;
      speechEnd = Number.isFinite(nowMs) && nowMs >= 0 ? nowMs : undefined;
    },
    close() {
      if (closeLine !== undefined) return closeLine;
      closed = true;
      speechEnd = undefined;
      ambiguous = false;
      pendingEnds = 0;
      for (const record of [...active]) record.finish('cancelled');
      closeLine = format();
      return closeLine;
    },
  };
}
