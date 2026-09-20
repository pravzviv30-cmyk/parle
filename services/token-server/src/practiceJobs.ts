/** Durable post-session recovery. Only validated learning artefacts cross this boundary. */
import { isConversationPack, phraseKeyOf, validateExercise, type ConversationPack, type DrillExercise } from '@luvani/core';
import { buildDrillGenerationRequest, buildSystemBlocks } from '@luvani/brain';
import type { LlmClient } from '@luvani/brain/llm';

export interface PracticeJob { pack_id: string; lease_token: string; payload: ConversationPack }
export interface PracticeJobs {
  receive(pack: ConversationPack, final: boolean): Promise<void>;
  claim(): Promise<PracticeJob | null>;
  finish(job: PracticeJob, exercises: DrillExercise[] | null): Promise<boolean>;
}

export function practiceJobs(baseUrl: string, key: string, request: typeof fetch = fetch): PracticeJobs {
  async function rpc(name: string, body: unknown): Promise<unknown> {
    const response = await request(`${baseUrl.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(8_000), body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`practice queue ${name} status=${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
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
    async finish(job, exercises) {
      return await rpc('finish_conversation_practice', {
        p_id: job.pack_id, p_lease: job.lease_token, p_exercises: exercises,
      }) === true;
    },
  };
}

/** Reject unrelated/model-invented card identities and malformed exercise objects. */
export function groundedExercises(pack: ConversationPack, candidates: readonly DrillExercise[]): DrillExercise[] {
  const keys = new Set([...pack.keyPhrases.map((p) => phraseKeyOf(p.fr)), ...pack.corrections.map((p) => phraseKeyOf(p.better))]);
  const seen = new Set<string>();
  return candidates.filter((ex) => {
    try {
      if (!keys.has(ex.phraseKey) || seen.has(ex.id) || !validateExercise(ex).ok) return false;
      seen.add(ex.id);
      return true;
    } catch { return false; }
  }).slice(0, 24);
}

/** One job at a time. SQL owns leases, retry counts and stale-result fencing. */
export async function processPracticeJob(jobs: PracticeJobs, client: Pick<LlmClient, 'drills'>): Promise<'idle' | 'complete' | 'retry' | 'superseded'> {
  const job = await jobs.claim();
  if (!job) return 'idle';
  let exercises: DrillExercise[];
  try {
    const pack = job.payload;
    const phrases = [
      ...pack.keyPhrases,
      ...pack.corrections.map((c) => ({ fr: c.better, en: c.betterEn, frWritten: null })),
    ].slice(0, 12).map((p) => ({ ...p, frWritten: p.frWritten ?? null, register: 'courant' as const, enLiteral: null, note: '' }));
    if (phrases.length === 0) exercises = [];
    else {
      const result = await client.drills({ kind: 'drills', system: buildSystemBlocks(),
        request: buildDrillGenerationRequest({ sessionPhrases: phrases, profilePhrases: [], errorTags: [], topics: pack.topics ?? [pack.title] }),
        signal: AbortSignal.timeout(60_000),
      });
      exercises = groundedExercises(pack, result.batch.exercises);
      if (exercises.length === 0) throw new Error('no valid grounded exercises');
    }
  } catch {
    // No raw model errors, learner text or credentials in the operational log.
    return await jobs.finish(job, null) ? 'retry' : 'superseded';
  }
  // A write timeout is uncertain, NOT a generation failure. Leave the lease to
  // expire; never issue a second, conflicting completion after an uncertain ack.
  return await jobs.finish(job, exercises) ? 'complete' : 'superseded';
}
