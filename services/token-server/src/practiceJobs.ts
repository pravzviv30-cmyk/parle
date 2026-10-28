/** Durable post-session recovery. Only validated learning artefacts cross this boundary. */
import { groundedDrills, isConversationPack, phraseKeyOf, type ConversationPack, type DrillExercise } from '@luvani/core';
import { buildDrillGenerationRequest, buildSystemBlocks, transferPhraseKeys, transferPhrasesFrom } from '@luvani/brain';
import { BrainParseError, BrainRefusalError, priceUsage, type LlmClient, type LlmUsage } from '@luvani/brain/llm';
// This pure canonical policy is shared with live tutors; no second safety net.
import { safetyDecision, outputGuard } from '../../tutor-agent/src/safety.ts';
import { boundedFetchJson } from '../../shared/boundedFetch.ts';

export interface PracticeJob { pack_id: string; lease_token: string; payload: ConversationPack }
export interface PracticeJobs {
  receive(pack: ConversationPack, final: boolean): Promise<void>;
  claim(): Promise<PracticeJob | null>;
  active(job: PracticeJob): Promise<boolean>;
  finish(job: PracticeJob, exercises: DrillExercise[] | null): Promise<boolean>;
}

export function practiceJobs(baseUrl: string, key: string, request: typeof fetch = fetch): PracticeJobs {
  async function rpc(name: string, body: unknown): Promise<unknown> {
    const response = await boundedFetchJson(request, `${baseUrl.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, {timeoutMs:8000,maxBytes:512*1024});
    if (response.status < 200 || response.status >= 300) throw new Error('practice-queue-unavailable');
    return response.value;
  }
  return {
    async receive(pack, final) {
      if (!isConversationPack(pack) || pack.id !== pack.sessionId || pack.state !== 'ready') throw new Error('invalid practice pack');
      await rpc('receive_conversation_practice', { p_pack: pack, p_final: final });
    },
    async claim() {
      const rows = await rpc('claim_conversation_practice', {});
      if (!Array.isArray(rows)) throw new Error('invalid practice queue response');
      if (rows.length === 0) return null;
      const job = rows[0];
      if (!isConversationPack(job?.payload) || job.payload.id !== job.pack_id ||
        job.payload.sessionId !== job.pack_id || typeof job.lease_token !== 'string') throw new Error('invalid practice job');
      return job;
    },
    async active(job) {
      const value=await rpc('practice_job_active_v1',{p_pack_id:job.pack_id,p_lease:job.lease_token});
      if(typeof value!=='boolean')throw new Error('invalid-practice-lease');
      return value;
    },
    async finish(job, exercises) {
      return await rpc('finish_conversation_practice', {
        p_id: job.pack_id, p_lease: job.lease_token, p_exercises: exercises,
      }) === true;
    },
  };
}

/** Reject unrelated/model-invented card identities and malformed exercise objects. The filter itself is core's `groundedDrills`, shared with the live tutor. */
/**
 * The pack's wins that earn one harder, changed-situation exercise each. Never
 * a phrase that was corrected in the session, quoted or offered.
 */
export function packTransferPhrases(pack: ConversationPack): { fr: string; en: string }[] {
  return transferPhrasesFrom(pack.wins ?? [], {
    corrected: pack.corrections.flatMap((c) => [c.quote, c.better]),
    known: pack.keyPhrases,
  });
}

export function groundedExercises(pack: ConversationPack, candidates: readonly DrillExercise[]): DrillExercise[] {
  // Transfer wins are grounded too: they are French the learner said this session.
  const keys = new Set([
    ...pack.keyPhrases.map((p) => phraseKeyOf(p.fr)),
    ...pack.corrections.map((p) => phraseKeyOf(p.better)),
    ...transferPhraseKeys(packTransferPhrases(pack)),
  ]);
  return groundedDrills(candidates, keys, { screen: outputGuard, band: pack.cefr });
}

export type PracticeFailure = 'no-valid' | 'parse' | 'refusal' | 'unsafe-source' | 'stopped' | 'other';
/**
 * Numbers-only outcome of one claimed job (never for 'idle'). No text, ids or names.
 * `generationMs` is claim to finish wall time. `sinceSessionEndMs` is now minus
 * (pack.createdAt + durationSec): with the tutor lifecycle on, createdAt is the
 * session START (tutor-agent convo.ts), so this estimates session end to practice
 * ready on a shared host clock. The claim RPC returns no queue timestamp; null when
 * durationSec is absent, the date is unparseable or the result is negative.
 */
export interface PracticeOutcome {
  result: 'complete' | 'retry' | 'superseded';
  proposed: number | null; accepted: number | null; failure: PracticeFailure | null;
  generationMs: number | null; sinceSessionEndMs: number | null; usdEstimate: number | null;
}
export interface PracticeJobOptions {
  signal?: AbortSignal; generationMs?: number; leasePollMs?:number;
  clientFor?:(job:PracticeJob,signal:AbortSignal)=>Promise<Pick<LlmClient,'drills'>>;
  onUsage?: (usage:LlmUsage)=>void; onOutcome?: (outcome:PracticeOutcome)=>void; now?: ()=>number;
}
interface Track { claimedAt: number | null; pack: ConversationPack | null; proposed: number | null; accepted: number | null; failure: PracticeFailure | null; usd: number | null }

function failureOf(error: unknown): PracticeFailure {
  if (error instanceof BrainParseError) return 'parse';
  if (error instanceof BrainRefusalError) return 'refusal';
  const message = error instanceof Error ? error.message : '';
  if (message === 'no valid grounded exercises') return 'no-valid';
  if (message === 'unsafe-practice-source') return 'unsafe-source';
  if (message === 'practice-generation-stopped' || (error instanceof Error && error.name === 'AbortError')) return 'stopped';
  return 'other';
}

function sinceSessionEnd(pack: ConversationPack | null, at: number): number | null {
  if (!pack || typeof pack.durationSec !== 'number' || !Number.isFinite(pack.durationSec)) return null;
  const started = Date.parse(pack.createdAt);
  if (!Number.isFinite(started)) return null;
  const ms = at - (started + pack.durationSec * 1000);
  return ms >= 0 ? ms : null;
}

/** One job at a time. SQL owns leases, retry counts and stale-result fencing. */
export async function processPracticeJob(jobs: PracticeJobs, client: Pick<LlmClient, 'drills'>,
  options: PracticeJobOptions = {},
): Promise<'idle' | 'complete' | 'retry' | 'superseded'> {
  const now = options.now ?? Date.now;
  const track: Track = { claimedAt: null, pack: null, proposed: null, accepted: null, failure: null, usd: null };
  const onUsage = (usage: LlmUsage) => {
    const usd = priceUsage(usage).usd;
    if (Number.isFinite(usd)) track.usd = (track.usd ?? 0) + usd;
    options.onUsage?.(usage);
  };
  const result = await runPracticeJob(jobs, client, { ...options, onUsage }, track, now);
  if (result !== 'idle' && options.onOutcome) {
    const at = now();
    options.onOutcome({ result, proposed: track.proposed, accepted: track.accepted, failure: track.failure,
      generationMs: track.claimedAt === null ? null : Math.max(0, at - track.claimedAt),
      sinceSessionEndMs: result === 'complete' ? sinceSessionEnd(track.pack, at) : null, usdEstimate: track.usd });
  }
  return result;
}

async function runPracticeJob(jobs: PracticeJobs, client: Pick<LlmClient, 'drills'>,
  options: PracticeJobOptions, track: Track, now: () => number,
): Promise<'idle' | 'complete' | 'retry' | 'superseded'> {
  const job = await jobs.claim();
  if (!job) return 'idle';
  track.claimedAt = now(); track.pack = job.payload;
  if(options.signal?.aborted || !await jobs.active(job))return 'superseded';
  let exercises: DrillExercise[];
  try {
    const pack = job.payload;
    const phrases = [
      ...pack.keyPhrases,
      ...pack.corrections.map((c) => ({ fr: c.better, en: c.betterEn, frWritten: null })),
    ].slice(0, 12).map((p) => ({ ...p, frWritten: p.frWritten ?? null, register: 'courant' as const, enLiteral: null, note: '' }));
    if (phrases.length === 0) exercises = [];
    else {
      const generationMs=options.generationMs ?? 90_000;
      if (!Number.isInteger(generationMs) || generationMs < 1 || generationMs > 90_000) throw new Error('invalid-practice-deadline');
      // Full stored learner-derived fields pass the same policy before dispatch.
      for(const phrase of phrases) {
        for(const text of [phrase.fr,phrase.en,phrase.frWritten ?? ''])if(safetyDecision(text) || outputGuard(text))throw new Error('unsafe-practice-source');
      }
      const transferPhrases=packTransferPhrases(pack);
      for(const phrase of transferPhrases) {
        for(const text of [phrase.fr,phrase.en])if(safetyDecision(text) || outputGuard(text))throw new Error('unsafe-practice-source');
      }
      const topics=pack.topics?.length ? pack.topics : [pack.title];
      for(const topic of topics) {
        for(const text of [topic.fr,topic.en])if(safetyDecision(text) || outputGuard(text))throw new Error('unsafe-practice-source');
      }
      const pollMs=options.leasePollMs ?? 2000;
      if(!Number.isInteger(pollMs) || pollMs<1 || pollMs>2000)throw new Error('invalid-practice-poll');
      const controller=new AbortController();const signal=options.signal ? AbortSignal.any([controller.signal,options.signal]) : controller.signal;
      let timer:ReturnType<typeof setTimeout>|undefined;let rejectStop=(_error:unknown)=>{};
      const stopped=new Promise<never>((_resolve,reject)=>{rejectStop=reject;});const stop=()=>rejectStop(new Error('practice-generation-stopped'));
      signal.addEventListener('abort',stop,{once:true});
      let poll:ReturnType<typeof setTimeout>|undefined;let monitoring=true;
      const check=async()=>{
        try{if(!await jobs.active(job))controller.abort();}catch{controller.abort();}
        if(monitoring && !signal.aborted)poll=setTimeout(()=>{void check();},pollMs);
      };
      poll=setTimeout(()=>{void check();},pollMs);
      let result: Awaited<ReturnType<LlmClient['drills']>>;
      try {
        if(signal.aborted)throw new Error('practice-generation-stopped');
        timer=setTimeout(()=>controller.abort(),generationMs);
        const admittedClient=options.clientFor ? await options.clientFor(job,signal) : client;
        result = await Promise.race([admittedClient.drills({ kind: 'drills', system: buildSystemBlocks(),
        request: buildDrillGenerationRequest({ sessionPhrases: phrases, profilePhrases: [], errorTags: [], topics, transferPhrases }),
        signal,
        }),stopped]);
      } finally { monitoring=false;if(poll)clearTimeout(poll);if(timer)clearTimeout(timer);signal.removeEventListener('abort',stop);controller.abort(); }
      options.onUsage?.(result.usage);
      track.proposed = result.batch.exercises.length;
      exercises = groundedExercises(pack, result.batch.exercises);
      track.accepted = exercises.length;
      if (exercises.length === 0) throw new Error('no valid grounded exercises');
    }
  } catch(error) {
    if ((error instanceof BrainParseError || error instanceof BrainRefusalError) && error.usage) options.onUsage?.(error.usage);
    track.failure = failureOf(error);
    // No raw model errors, learner text or credentials in the operational log.
    if(options.signal?.aborted || !await jobs.active(job))return 'superseded';
    return await jobs.finish(job, null) ? 'retry' : 'superseded';
  }
  // A write timeout is uncertain, NOT a generation failure. Leave the lease to
  // expire; never issue a second, conflicting completion after an uncertain ack.
  if(options.signal?.aborted || !await jobs.active(job))return 'superseded';
  return await jobs.finish(job, exercises) ? 'complete' : 'superseded';
}
