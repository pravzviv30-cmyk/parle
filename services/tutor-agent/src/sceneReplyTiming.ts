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

/** A separate confirmed-input cohort; these boundaries are not framework EOU. */
export type ReplyInput = 'typed' | 'spoken';
export type InputReplyStage = 'queueStarted' | 'brainSent' | 'brainParsed' |
  'checkpointStarted' | 'checkpointAcknowledged' | 'viewDispatched' | 'sayCalled';
export interface InputReplyTimingRecord {
  mark(stage: InputReplyStage): void;
  finish(outcome: SceneReplyOutcome, speechDispatched?: boolean): void;
}
const inputStages: readonly InputReplyStage[] = ['queueStarted', 'brainSent', 'brainParsed',
  'checkpointStarted', 'checkpointAcknowledged', 'viewDispatched'];
const intervals = ['queue', 'prepare', 'brain', 'integrate', 'checkpoint', 'dispatch', 'inputToView', 'viewToSay', 'inputToSay'] as const;
const noInputRecord: InputReplyTimingRecord = { mark() {}, finish() {} };

export function createInputReplyTiming(clock: () => number, onRecord?: (line: string) => void) {
  const cohort = () => ({ started: 0, dispatched: 0, failed: 0, cancelled: 0, missing: 0,
    samples: [] as Partial<Record<typeof intervals[number], number>>[] });
  const cohorts = { typed: cohort(), spoken: cohort() };
  const active = new Map<InputReplyTimingRecord, ReplyInput>();
  let closed = false, closedLines: string[] | undefined;
  const emit = (input: ReplyInput, outcome: string, durations?: Partial<Record<typeof intervals[number], number>>) => {
    const numbers = durations ? Object.entries(durations).map(([stage, value]) => ` ${stage}=${Math.round(value!)}ms`).join('') : '';
    // Optional diagnostics must never turn a successfully guarded reply into a failure.
    try { onRecord?.(`[luvani:reply-stages] boundary=confirmed-input-to-view-dispatch input=${input} outcome=${outcome}${numbers}`); } catch { /* diagnostic sink only */ }
  };
  function snapshot(input: ReplyInput) {
    const report = cohorts[input];
    const stages = {} as Record<typeof intervals[number], { n: number; p50Ms: number | null; p95Ms: number | null }>;
    for (const stage of intervals) {
      const sorted = report.samples.flatMap(sample => sample[stage] === undefined ? [] : [sample[stage]!]).sort((a, b) => a - b);
      stages[stage] = { n: sorted.length, p50Ms: percentile(sorted, 0.5), p95Ms: percentile(sorted, 0.95) };
    }
    return { started: report.started, dispatched: report.dispatched, failed: report.failed, cancelled: report.cancelled,
      missing: report.missing, active: [...active.values()].filter(value => value === input).length, n: report.samples.length, stages };
  }
  function format(input: ReplyInput) {
    const report = snapshot(input);
    const stages = Object.entries(report.stages).map(([name, stage]) => ` ${name}-n=${stage.n}` +
      (stage.n ? ` ${name}-p50=${Math.round(stage.p50Ms!)}ms ${name}-p95=${Math.round(stage.p95Ms!)}ms` : '')).join('');
    return `[luvani:reply-stage-summary] boundary=confirmed-input-to-view-dispatch input=${input} window=last${WINDOW}` +
      ` n=${report.n} started=${report.started} dispatched=${report.dispatched} failed=${report.failed}` +
      ` cancelled=${report.cancelled} missing=${report.missing} active=${report.active}${stages} phone-receipt=unmeasured phone-audible=unmeasured`;
  }
  return {
    snapshot, format,
    begin(input: ReplyInput): InputReplyTimingRecord {
      if (closed) return noInputRecord;
      const report = cohorts[input]; report.started++;
      if (active.size >= WINDOW) { report.missing++; emit(input, 'missing'); return noInputRecord; }
      const received = clock();
      const marks: Partial<Record<InputReplyStage, number>> = {};
      let finished = false;
      const record: InputReplyTimingRecord = {
        mark(stage) { if (!closed && !finished && marks[stage] === undefined) marks[stage] = clock(); },
        finish(outcome, speechDispatched = false) {
          if (finished) return;
          finished = true; active.delete(record);
          if (outcome !== 'dispatched') { report[outcome]++; emit(input, outcome); return; }
          report.dispatched++;
          const ordered = [received, ...inputStages.map(stage => marks[stage])];
          // Speech may start before the view is published: a streamed turn
          // speaks as soon as its spoken fields are in (VOICE-003). So a say is
          // held only to come after the spoken fields were parsed.
          const said = marks.sayCalled;
          const sayInOrder = !speechDispatched || (said !== undefined && Number.isFinite(said) && said >= marks.brainParsed!);
          if (!ordered.every((value, index) => value !== undefined && Number.isFinite(value) && value >= 0 &&
            (index === 0 || value >= ordered[index - 1]!)) || !sayInOrder
            || Math.max(ordered.at(-1)!, speechDispatched ? said! : 0) - received > 15 * 60_000) {
            report.missing++; emit(input, 'missing'); return;
          }
          const durations: Partial<Record<typeof intervals[number], number>> = {
            queue: marks.queueStarted! - received, prepare: marks.brainSent! - marks.queueStarted!,
            brain: marks.brainParsed! - marks.brainSent!, integrate: marks.checkpointStarted! - marks.brainParsed!,
            checkpoint: marks.checkpointAcknowledged! - marks.checkpointStarted!, dispatch: marks.viewDispatched! - marks.checkpointAcknowledged!,
            inputToView: marks.viewDispatched! - received,
            ...(speechDispatched ? {
              inputToSay: said! - received,
              // Only meaningful when the say followed the view; an early say has none.
              ...(said! >= marks.viewDispatched! ? { viewToSay: said! - marks.viewDispatched! } : {}),
            } : {}),
          };
          report.samples.push(durations); if (report.samples.length > WINDOW) report.samples.shift();
          emit(input, outcome, durations);
        },
      };
      active.set(record, input); return record;
    },
    close() {
      if (closedLines) return closedLines;
      closed = true;
      for (const record of [...active.keys()]) record.finish('cancelled');
      closedLines = [format('typed'), format('spoken')]; return closedLines;
    },
  };
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
