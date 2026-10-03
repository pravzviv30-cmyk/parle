/** Manifest lookup only. Billed generation must resolve+reserve in one SQL transaction. */
import { isConversationPack, phraseAudioFrench, readPhraseAudioSource, type PhraseAudioSource } from '@luvani/core';

export async function resolvePhraseAudioManifestSource(base: string, key: string, userId: string, source: PhraseAudioSource,
  request: typeof fetch = fetch, signal?: AbortSignal, timeoutMs = 5_000): Promise<string | null> {
  const parsed = readPhraseAudioSource(source);
  if (signal?.aborted || parsed === null) return null;
  const deadline = AbortSignal.timeout(Math.max(1, Math.min(5_000, Math.floor(timeoutMs))));
  const readSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const root = base.replace(/\/+$/, '');
  const headers = { apikey: key, authorization: `Bearer ${key}` };
  const response = await request(`${root}/rest/v1/conversation_packs?id=eq.${encodeURIComponent(parsed.packId)}&user_id=eq.${encodeURIComponent(userId)}&state=eq.ready&select=payload,state,session_id&limit=1`,
    { headers, signal: readSignal, redirect: 'error' });
  if (!response.ok) throw new Error('Saved audio source unavailable');
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0] !== 'object' || rows[0] === null) return null;
  const row = rows[0]; const pack: unknown = row.payload;
  if (row.state !== 'ready' || !isConversationPack(pack) || pack.state !== 'ready' || pack.id !== parsed.packId ||
    pack.sessionId !== parsed.packId || row.session_id !== parsed.packId || pack.learnerId !== userId) return null;
  if (readSignal.aborted) return null;
  const proof = await request(`${root}/rest/v1/session_usage?session_id=eq.${encodeURIComponent(parsed.packId)}&user_id=eq.${encodeURIComponent(userId)}&select=session_id,user_id&limit=1`,
    { headers, signal: readSignal, redirect: 'error' });
  if (!proof.ok) throw new Error('Saved audio completion unavailable');
  const completed: unknown = await proof.json();
  if (readSignal.aborted) return null;
  if (!Array.isArray(completed) || completed.length !== 1 || completed[0]?.session_id !== parsed.packId || completed[0]?.user_id !== userId) return null;
  return phraseAudioFrench(parsed.kind === 'phrase' ? pack.keyPhrases[parsed.index]?.fr : pack.corrections[parsed.index]?.better);
}
