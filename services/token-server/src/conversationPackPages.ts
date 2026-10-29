import { validConversationPackFor } from './conversationPacks.ts';
import { HttpInputError } from './requestBoundary.ts';
import { boundedFetchJson } from '../../shared/boundedFetch.ts';
import { isListedConversation, type ConversationPack } from '@luvani/core';

export const CONVERSATION_PAGE_SIZE = 20;
/** Learner-facing summary of the durable drill job; never its attempts, lease or errors. */
export type PracticeStatus = 'preparing' | 'ready' | 'failed';
export type ListedPack = ConversationPack & { practiceStatus?: PracticeStatus };
function practiceStatusOf(status: unknown): PracticeStatus | null {
  return status === 'pending' || status === 'running' ? 'preparing' : status === 'complete' ? 'ready' : status === 'failed' ? 'failed' : null;
}
/**
 * One bounded, owner-scoped service read: the jobs table has no owner column and
 * no learner grant, so it is reached only through the learner's own packs.
 * A missing job row means a non-durable or legacy pack, which is already final.
 * If the status read fails the field is omitted; the library is never withheld.
 */
async function withPracticeStatus(base: string, secret: string, userId: string, packs: ConversationPack[], request: typeof fetch): Promise<ListedPack[]> {
  if (!packs.length) return packs;
  const ids = packs.map(pack => pack.id);
  const url = `${base.replace(/\/+$/, '')}/rest/v1/conversation_packs?select=id,conversation_practice_jobs(status)`
    + `&user_id=eq.${encodeURIComponent(userId)}&id=in.(${ids.map(encodeURIComponent).join(',')})&limit=${ids.length}`;
  try {
    const response = await boundedFetchJson(request, url, { method: 'GET', headers: { apikey: secret, authorization: `Bearer ${secret}` } }, { maxBytes: 64 * 1024 });
    if (response.status !== 200 || !Array.isArray(response.value)) return packs;
    const found = new Map<string, PracticeStatus>();
    for (const row of response.value as Array<{ id?: unknown; conversation_practice_jobs?: unknown }>) {
      if (!row || typeof row.id !== 'string' || !ids.includes(row.id)) continue;
      const embed = row.conversation_practice_jobs;
      const job = Array.isArray(embed) ? embed[0] : embed;
      if (job === undefined || job === null) { found.set(row.id, 'ready'); continue; }
      const status = practiceStatusOf((job as { status?: unknown }).status);
      if (status) found.set(row.id, status);
    }
    return packs.map(pack => found.has(pack.id) ? { ...pack, practiceStatus: found.get(pack.id)! } : pack);
  } catch { return packs; }
}
export interface PackCursor { createdAt: string; packId: string }
export interface UnavailablePack { id:string; createdAt:string; payloadBytes:number; reason:'oversize' }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function packCursor(raw: string): PackCursor | null {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 256) return null;
  try {
    const value = JSON.parse(raw);
    return value && Object.keys(value).length === 2 && typeof value.createdAt === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value.createdAt)
      && Number.isFinite(Date.parse(value.createdAt)) && typeof value.packId === 'string' && uuid.test(value.packId)
      ? value : null;
  } catch { return null; }
}
function key(cursor: PackCursor): string {
  const [date, suffix] = cursor.createdAt.replace('+00:00', 'Z').split('.');
  return `${date!.replace(/Z$/, '')}.${suffix ? suffix.replace(/Z$/, '').padEnd(6, '0') : '000000'}Z/${cursor.packId.toLowerCase()}`;
}
async function lookup(base: string, secret: string, userId: string, after: PackCursor | null, packId: string | null, request: typeof fetch) {
  const response = await boundedFetchJson(request, `${base.replace(/\/+$/, '')}/rest/v1/rpc/conversation_pack_page_v1`, {
    method: 'POST', headers: { apikey: secret, authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_user_id: userId, p_after_created_at: after?.createdAt ?? null, p_after_id: after?.packId ?? null, p_pack_id: packId }),
  }, { maxBytes: 2 * 1024 * 1024 });
  if (response.status !== 200) throw new Error('conversation-page-unavailable');
  const value = response.value as { kind?: unknown; version?: unknown; rows?: unknown; nextCursor?: unknown } | null;
  if (value?.kind === 'inactive') throw new HttpInputError(403, 'Account is not active');
  if (!value || value.kind !== (packId ? 'pack' : 'page') || value.version !== 1 || !Array.isArray(value.rows) || value.rows.length > (packId ? 1 : CONVERSATION_PAGE_SIZE)) throw new Error('invalid-conversation-page');
  const packs: ConversationPack[] = [];
  const unavailable:UnavailablePack[]=[];
  let previous = after;
  const ids = new Set<string>();
  for (const row of value.rows) {
    const cursor = row && packCursor(JSON.stringify({ createdAt: row.createdAt, packId: row.id }));
    if (!cursor || (packId && row.id!==packId) || ids.has(row.id)
      || (previous && key(cursor) >= key(previous))) throw new Error('invalid-conversation-page');
    ids.add(row.id); previous = cursor;
    if(row.payload===null && row.unavailable==='oversize' && Object.keys(row).length===5 && Number.isSafeInteger(row.payloadBytes) && row.payloadBytes>524288)unavailable.push({id:row.id,createdAt:row.createdAt,payloadBytes:row.payloadBytes,reason:'oversize'});
    else if(validConversationPackFor(row.payload,userId,packId??undefined) && row.payload.id===row.id && row.unavailable===undefined){
      // A session with no reply in the scene is kept, never listed or opened as a conversation (F904).
      if(isListedConversation(row.payload))packs.push(row.payload);
    }
    else throw new Error('invalid-conversation-page');
  }
  const nextCursor = value.nextCursor === null ? null : packCursor(JSON.stringify(value.nextCursor));
  if (value.nextCursor !== null && (!nextCursor || packId || value.rows.length===0 || !previous || key(nextCursor) !== key(previous))) throw new Error('invalid-conversation-page');
  return { packs: await withPracticeStatus(base, secret, userId, packs, request), unavailable, nextCursor: nextCursor ? JSON.stringify(nextCursor) : null };
}
/** SQL fetches at most21 indexed rows; its JSON scalar bypasses REST row caps/count scans. */
export async function conversationPackPage(base: string, secret: string, userId: string, after: string | null, request: typeof fetch = fetch): Promise<{ packs: ListedPack[]; unavailable:UnavailablePack[]; nextCursor: string | null }> {
  const cursor = after === null ? null : packCursor(after);
  if (after !== null && !cursor) throw new HttpInputError(400, 'invalid conversation cursor');
  let page = await lookup(base, secret, userId, cursor, null, request);
  // Zero-reply sessions are dropped after the database pages (F904), so a page
  // can come back holding only hidden rows. Read on from where it ended, a
  // bounded number of times, rather than hand the app an empty page with an
  // "Older" link. Past the bound the cursor is returned as it stands.
  for (let extra = 0; extra < HIDDEN_PAGE_READS && page.packs.length === 0 && page.unavailable.length === 0 && page.nextCursor !== null; extra++) {
    // Fail soft: an extra read that errors hands back the last good page and
    // its cursor, so "Older" can retry. Only the first read may fail the request.
    try { page = await lookup(base, secret, userId, packCursor(page.nextCursor), null, request); }
    catch { break; }
  }
  return page;
}
/** Extra page reads allowed when every row of a page was a hidden session. */
export const HIDDEN_PAGE_READS = 3;
/** Old bookmarks remain independently addressable outside a bounded library page. */
export async function conversationPackById(base: string, secret: string, userId: string, packId: string, request: typeof fetch = fetch): Promise<ListedPack | null> {
  if (!uuid.test(packId)) throw new HttpInputError(400, 'invalid Conversation Pack id');
  const result=await lookup(base, secret, userId, null, packId, request);
  if(result.unavailable.length)throw new HttpInputError(413,'This historical conversation exceeds the detail byte limit');
  return result.packs[0] ?? null;
}
