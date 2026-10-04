/** Explicit Hear only. No shared worker cache, vendor retries, words in logs or events. */
import { createHash } from 'node:crypto';
import { isConversationPack, isTutorVoiceKey, phraseAudioFrench, readPhraseAudioSource, type PhraseAudioSource, type TutorVoiceKey } from '@luvani/core';
import { selectedTutorSynthesisConfiguration } from '../../tutor-agent/src/voiceConfiguration.ts';
import { resolvePhraseAudioManifestSource } from './phraseAudioSource.ts';

type Env = Record<string, string | undefined>;
export interface PhraseAudioManifest { source: PhraseAudioSource; voice: TutorVoiceKey; fr: string; frenchHash: string; fingerprint: string }
export function frenchAudioHash(fr: string): string { return createHash('sha256').update(fr).digest('hex'); }
function dbHeaders(env: Env) { return { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`, 'content-type': 'application/json' }; }
function database(env: Env) { return env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_URL.replace(/\/+$/, '') : null; }
export async function phraseAudioManifest(userId: string, rawSource: unknown, rawVoice: unknown, env: Env, signal: AbortSignal, request: typeof fetch = fetch): Promise<PhraseAudioManifest | null> {
  const source = readPhraseAudioSource(rawSource), config = selectedTutorSynthesisConfiguration(rawVoice, env), root = database(env);
  if (!source || !config || !root || !isTutorVoiceKey(rawVoice) || signal.aborted) return null;
  const fr = await resolvePhraseAudioManifestSource(root, env.SUPABASE_SERVICE_ROLE_KEY!, userId, source, request, signal);
  return fr && !signal.aborted ? { source, voice: rawVoice, fr, frenchHash: frenchAudioHash(fr), fingerprint: config.fingerprint } : null;
}

const MAX_PCM_BYTES = 882_000; // 20s, mono 16-bit PCM at the unchanged 22050Hz pin
/** A private, transient WAV. This route writes neither a server WAV nor a store. */
export function phraseAudioWav(pcm: Uint8Array): Uint8Array {
  if (pcm.length < 2 || pcm.length > MAX_PCM_BYTES || pcm.length % 2) throw new Error('Audio unavailable');
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write('RIFF',0); wav.writeUInt32LE(36 + pcm.length,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16);
  wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(22050,24); wav.writeUInt32LE(44100,28);
  wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(pcm.length,40); wav.set(pcm,44);
  return wav;
}
async function readPcm(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw new Error('Audio unavailable');
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_PCM_BYTES)) throw new Error('Audio unavailable');
  const contentType = response.headers.get('content-type') ?? '';
  if (/json|text|html/i.test(contentType)) throw new Error('Audio unavailable');
  const reader = response.body.getReader(); const pcm = new Uint8Array(MAX_PCM_BYTES); let bytes = 0, emptyChunks = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort',cancel,{once:true});
  try {
    if (signal.aborted) throw new Error('Audio unavailable');
    while (true) {
      const item = await reader.read();
      if (signal.aborted) throw new Error('Audio unavailable');
      if (item.done) break;
      // A synthetic/malformed stream must not starve the deadline with an
      // endless chain of already-resolved zero-byte reads.
      if (item.value.length === 0) { if (++emptyChunks > 1024) throw new Error('Audio unavailable'); continue; }
      if (bytes + item.value.length > MAX_PCM_BYTES) throw new Error('Audio unavailable');
      pcm.set(item.value,bytes); bytes += item.value.length;
    }
    if (declared && Number(declared) !== bytes) throw new Error('Audio unavailable');
    return pcm.subarray(0,bytes);
  } finally { signal.removeEventListener('abort',cancel); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function generatePhraseAudio(userId: string, rawSource: unknown, rawVoice: unknown, expectedFingerprint: unknown, expectedFrenchHash: unknown,
  env: Env, signal: AbortSignal, request: typeof fetch = fetch): Promise<Uint8Array | null> {
  const source = readPhraseAudioSource(rawSource), config = selectedTutorSynthesisConfiguration(rawVoice,env), root = database(env);
  if (env.LUVANI_PHRASE_AUDIO_GENERATION !== '1' || !env.ELEVEN_API_KEY || !root || !source || !config ||
    config.fingerprint !== expectedFingerprint || typeof expectedFrenchHash !== 'string' || !/^[0-9a-f]{64}$/.test(expectedFrenchHash) || signal.aborted) return null;
  // Caller body carries no words or rate. The RPC resolves and permanently
  // reserves both budgets in one transaction, using operator-verified rates.
  const reserved = await request(`${root}/rest/v1/rpc/reserve_phrase_audio`, { method:'POST',headers:dbHeaders(env),signal,redirect:'error',
    body:JSON.stringify({p_user_id:userId,p_pack_id:source.packId,p_kind:source.kind,p_index:source.index,p_voice:rawVoice,p_fingerprint:config.fingerprint}) });
  if (!reserved.ok) throw new Error('Audio unavailable');
  const value: unknown = await reserved.json();
  if (signal.aborted || typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { fr, payload, fingerprint, rateRevision, bucket, globalWindowStart, paidWindowStart } = value as Record<string,unknown>;
  const beforePeriodEnd = (start: unknown) => typeof start === 'string' && Number.isFinite(Date.parse(start)) && Date.parse(start) <= Date.now() && Date.parse(start) + 2592000000 > Date.now() + 30_000;
  if (!isConversationPack(payload) || payload.state !== 'ready' || payload.learnerId !== userId || payload.id !== source.packId || payload.sessionId !== source.packId ||
    phraseAudioFrench(fr) !== fr || typeof fr !== 'string' || fingerprint !== config.fingerprint || typeof rateRevision !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(rateRevision) || frenchAudioHash(fr) !== expectedFrenchHash ||
    (bucket !== 'trial' && bucket !== 'paid') || !beforePeriodEnd(globalWindowStart) || (bucket === 'paid' ? !beforePeriodEnd(paidWindowStart) : paidWindowStart !== null) ||
    phraseAudioFrench(source.kind === 'phrase' ? payload.keyPhrases[source.index]?.fr : payload.corrections[source.index]?.better) !== fr) return null;
  // Observe the DB kill switch and rate again immediately before dispatch.
  // Changes after this check cannot revoke an already dispatched vendor call.
  const allowed = await request(`${root}/rest/v1/rpc/phrase_audio_dispatch_allowed`, {method:'POST',headers:dbHeaders(env),signal,redirect:'error',
    body:JSON.stringify({p_user_id:userId,p_pack_id:source.packId,p_kind:source.kind,p_index:source.index,p_voice:rawVoice,p_fingerprint:config.fingerprint,p_rate_revision:rateRevision,p_expected_fr:fr,p_bucket:bucket,p_global_window_start:globalWindowStart,p_paid_window_start:paidWindowStart})});
  if (!allowed.ok || await allowed.json() !== true || signal.aborted || env.LUVANI_PHRASE_AUDIO_GENERATION !== '1' || !beforePeriodEnd(globalWindowStart) || (bucket === 'paid' && !beforePeriodEnd(paidWindowStart))) return null;
  const live = selectedTutorSynthesisConfiguration(rawVoice,env);
  if (!live || live.fingerprint !== config.fingerprint) return null;
  // Exactly one uncached call, the same settings as live speech. Keep all
  // existing pins, including the language parameter, pending by-ear A/B proof.
  const upstream = await request(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=${config.encoding}&optimize_streaming_latency=${config.streamingLatency}&enable_logging=false`, {
    method:'POST',signal,redirect:'error',headers:{'xi-api-key':env.ELEVEN_API_KEY,'content-type':'application/json',accept:'application/octet-stream'},
    body:JSON.stringify({text:fr,model_id:config.model,language_code:config.languageCode,voice_settings:config.settings}),
  });
  const pcm = await readPcm(upstream,signal);
  return signal.aborted ? null : phraseAudioWav(pcm);
}
