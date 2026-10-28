/** Bounded local windows of server-owned Conversation Packs; never an account archive. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readOwnedCache } from '../storage/ownedRead.ts';
import { isConversationPack, normaliseConversationPacks, type ConversationPack } from '@luvani/core';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { mergeExercises } from '../drill/store.ts';
import { CONVERSATION_NOTE_PREFIX, PAST_CONVERSATION_NOTE, conversationNote, packExercisesFor, reviewPhrasesFor } from './packExercises.ts';
import { addPhrases, rewriteCardNotes } from '../review/store.ts';
import { practiceStatusOf } from './practiceStatus.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { activeUserId, onUserScopeReset, userKey, scopeGeneration, setItemInUserScope } from '../storage/scope.ts';
import { orderedConversationPacks } from './model.ts';

const VERSION = 1;
export const CONVERSATION_PAGE_SIZE = 20;
export const MAX_CACHED_CONVERSATION_PACKS = 200;
const MAX_CACHE_CHARS = 8 * 1024 * 1024;
const KEY = () => userKey('conversationPacks');
interface StoredConversationPacks { version: typeof VERSION; packs: ConversationPack[]; pendingBanking?: string[] }
let writeChain: Promise<unknown> = Promise.resolve();
let pullChain: Promise<unknown> = Promise.resolve();

function serialised<T>(operation: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = KEY(), owner = scopeGeneration();
  const run = () => operation(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => undefined);
  return next;
}
function pull<T>(operation: () => Promise<T>): Promise<T> {
  const next = pullChain.then(operation, operation);
  pullChain = next.catch(() => undefined);
  return next;
}
function readable(value: unknown): value is StoredConversationPacks {
  if (!value || typeof value !== 'object' || (value as {version?:unknown}).version !== VERSION) return false;
  const row = value as {packs?:unknown;pendingBanking?:unknown};
  return Array.isArray(row.packs) && row.packs.every(isConversationPack)
    && (row.pendingBanking === undefined || Array.isArray(row.pendingBanking) && row.pendingBanking.length <= CONVERSATION_PAGE_SIZE
      && row.pendingBanking.every(id => typeof id === 'string') && new Set(row.pendingBanking).size === row.pendingBanking.length);
}
async function readCache(key: string): Promise<StoredConversationPacks> {
  const raw = await AsyncStorage.getItem(key);
  // Earlier builds cached the full archive without a cap. Such a legacy blob
  // cannot be one of this writer's bounded pending pages. Rebuild this cache
  // from the server; earned drills/review and authoritative history stay intact.
  if (raw !== null && raw.length > MAX_CACHE_CHARS) return {version:VERSION,packs:[],pendingBanking:[]};
  const parsed = readOwnedCache(raw, readable);
  if (parsed === null) return {version:VERSION,packs:[],pendingBanking:[]};
  const uid = key.slice('luvani.u.'.length, -'.conversationPacks'.length);
  const pending = parsed.pendingBanking ?? [];
  const byId = new Map(parsed.packs.filter(pack => pack.learnerId === uid).map(pack => [pack.id,pack]));
  if (pending.some(id => !byId.has(id))) throw new Error('conversation recovery source unavailable');
  // Pin pending durable sources before applying the finite cache cap.
  const retained = [...pending.map(id => byId.get(id)!), ...orderedConversationPacks([...byId.values()]).filter(pack => !pending.includes(pack.id))].slice(0,MAX_CACHED_CONVERSATION_PACKS);
  return {version:VERSION,packs:normaliseConversationPacks(retained),pendingBanking:pending};
}
async function writeCache(key: string, owner: number, cache: StoredConversationPacks): Promise<void> {
  const pending = new Set(cache.pendingBanking ?? []);
  const pinned = cache.packs.filter(pack=>pending.has(pack.id));
  if (pinned.length!==pending.size || pinned.length>CONVERSATION_PAGE_SIZE) throw new Error('conversation recovery source unavailable');
  const packs: ConversationPack[]=[];
  let chars=JSON.stringify({...cache,packs:[]}).length;
  for(const pack of [...pinned,...cache.packs.filter(item=>!pending.has(item.id))]) {
    const size=JSON.stringify(pack).length+1;
    if (packs.length>=MAX_CACHED_CONVERSATION_PACKS || chars+size>MAX_CACHE_CHARS) {
      if(pending.has(pack.id)) throw new Error('conversation recovery source exceeds limit');
      continue;
    }
    chars+=size;packs.push(pack);
  }
  const json = JSON.stringify({...cache,packs});
  if (json.length > MAX_CACHE_CHARS) throw new Error('conversation cache exceeds limit');
  await setItemInUserScope(owner,key,json);
}
/** Replaces this finite cache view only; server history and earned learning remain intact. */
export function replaceConversationPacks(packs: readonly ConversationPack[]): Promise<void> {
  return replaceCache(packs, false);
}
function replaceCache(packs: readonly ConversationPack[], allowPendingDeletion: boolean): Promise<void> {
  return serialised(async (key,owner) => {
    const held = await readCache(key);
    const uid = key.slice('luvani.u.'.length,-'.conversationPacks'.length);
    const owned = orderedConversationPacks(packs.filter(pack => pack.learnerId === uid));
    const ids = new Set(owned.map(pack => pack.id));
    const pending = (held.pendingBanking ?? []).filter(id => !allowPendingDeletion || ids.has(id));
    const pinned = [...pending.map(id => held.packs.find(pack => pack.id === id)!), ...owned.filter(pack => !pending.includes(pack.id))].slice(0,MAX_CACHED_CONVERSATION_PACKS);
    await writeCache(key,owner,{version:VERSION,packs:pinned,pendingBanking:pending});
  });
}
export async function loadConversationPacks(): Promise<ConversationPack[]> { return orderedConversationPacks((await readCache(KEY())).packs); }
export interface UnavailablePack {id:string;createdAt:string;payloadBytes:number;reason:'oversize'}
export type ConversationPackSync = {ok:true;packs:ConversationPack[];unavailable:UnavailablePack[];nextCursor:string|null} | {ok:false};
export type ConversationPackLookup = {ok:true;pack:ConversationPack|null} | {ok:false;reason?:'oversize'};
export type ConversationPackMutation = {ok:true;packs:ConversationPack[]} | {ok:false;message:string};

function validCursor(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 256) return false;
  try {
    const row = JSON.parse(value);
    return row && Object.keys(row).length === 2 && typeof row.createdAt === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(row.createdAt)
      && Number.isFinite(Date.parse(row.createdAt)) && typeof row.packId === 'string'
      && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.packId);
  } catch { return false; }
}
function validUnavailable(value:unknown):value is UnavailablePack {
  if(!value || typeof value!=='object')return false;
  const row=value as UnavailablePack;
  return Object.keys(row).length===4 && row.reason==='oversize' && Number.isSafeInteger(row.payloadBytes) && row.payloadBytes>524288
    && validCursor(JSON.stringify({createdAt:row.createdAt,packId:row.id}));
}
/**
 * `practiceStatus` is a late, optional server field. A value this build does
 * not know is read as ready (the old meaning of no field) and not stored, so
 * the cache only ever holds the three values the app draws.
 */
function withKnownPracticeStatus(pack: ConversationPack): ConversationPack {
  const raw = (pack as {practiceStatus?: unknown}).practiceStatus;
  if (raw === undefined || raw === practiceStatusOf(pack)) return pack;
  const {practiceStatus: _unknown, ...rest} = pack as ConversationPack & {practiceStatus?: unknown};
  return rest as ConversationPack;
}
/**
 * After a delete, cards earned from the deleted conversations keep their
 * schedule and evidence but stop naming it. A card that carries the pack id
 * behind its note is matched by that id, exactly (F882). A legacy card with
 * no id falls back to the exact note text, and a title still used by a cached
 * conversation that remains is left alone there, since the note cannot say
 * which of the two it came from. Deleting everything clears every such note.
 */
async function forgetDeletedNames(before: readonly ConversationPack[], after: readonly ConversationPack[], all: boolean): Promise<void> {
  if (all) { await rewriteCardNotes(card => card.context.startsWith(CONVERSATION_NOTE_PREFIX), PAST_CONVERSATION_NOTE); return; }
  const goneIds = new Set(before.filter(pack => !after.some(left => left.id === pack.id)).map(pack => pack.id));
  if (goneIds.size === 0) return;
  const kept = new Set(after.map(pack => conversationNote(pack.title.en)));
  const goneNotes = new Set(before.filter(pack => goneIds.has(pack.id)).map(pack => conversationNote(pack.title.en)).filter(note => !kept.has(note)));
  await rewriteCardNotes(card => typeof card.contextPackId === 'string'
    ? goneIds.has(card.contextPackId) && card.context.startsWith(CONVERSATION_NOTE_PREFIX)
    : goneNotes.has(card.context), PAST_CONVERSATION_NOTE);
}
async function getReply(url: string, token: string, request: typeof fetch): Promise<{status:number;body:unknown}> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const stopped = new Promise<never>((_resolve,reject) => { timer=setTimeout(() => {controller.abort();reject(new Error('conversation request timed out'));},8000); });
    const work = async () => {
      const response=await request(url,{headers:{authorization:`Bearer ${token}`},signal:controller.signal});
      const text=await response.text();
      if (controller.signal.aborted || text.length>2*1024*1024) throw new Error('conversation response unavailable');
      return {status:response.status,body:text?JSON.parse(text) as unknown:null};
    };
    return await Promise.race([work(),stopped]);
  } finally {if(timer)clearTimeout(timer);controller.abort();}
}
async function bankPage(packs: readonly ConversationPack[], current:()=>boolean): Promise<boolean> {
  if (packs.length>CONVERSATION_PAGE_SIZE || !current()) return false;
  if (await addPhrases(packs.filter(pack=>pack.state==='ready').flatMap(reviewPhrasesFor),{source:'conversation',stagger:true})!=='durable' || !current()) return false;
  if (await mergeExercises(packs.flatMap(pack=>pack.exercises))!=='durable' || !current()) return false;
  if (await mergeExercises(packs.flatMap(packExercisesFor))!=='durable' || !current()) return false;
  return true;
}
async function recoverPending(current:()=>boolean): Promise<boolean> {
  if (!current()) return false;
  const held=await readCache(KEY());
  if (!current()) return false;
  const pending=held.pendingBanking ?? [];
  if (!pending.length) return true;
  const page=pending.map(id=>held.packs.find(pack=>pack.id===id)!);
  if (!(await bankPage(page,current))) return false;
  await serialised(async(key,owner)=>{
    const cache=await readCache(key);
    if (!current()) throw new Error('conversation scope changed');
    // Serialized pulls cannot replace this pending page until it is banked.
    await writeCache(key,owner,{...cache,pendingBanking:[]});
  });
  return current();
}
async function cacheAndBank(packs: readonly ConversationPack[], current:()=>boolean): Promise<boolean> {
  if (!current() || packs.length>CONVERSATION_PAGE_SIZE) return false;
  await serialised(async(key,owner)=>{
    const held=await readCache(key);
    if (!current() || (held.pendingBanking?.length ?? 0)>0) throw new Error('conversation recovery pending');
    const ids=new Set(packs.map(pack=>pack.id));
    const merged=[...packs,...held.packs.filter(pack=>!ids.has(pack.id))].slice(0,MAX_CACHED_CONVERSATION_PACKS);
    await writeCache(key,owner,{version:VERSION,packs:normaliseConversationPacks(merged),pendingBanking:packs.map(pack=>pack.id)});
  });
  if (!current()) return false;
  return recoverPending(current);
}
/** Fetch one explicit page; pending prior-page recovery is bounded20, not whole-account backfill. */
export function refreshConversationPacks(user:AuthUser,adapter:AuthAdapter,request:typeof fetch=fetch,after:string|null=null):Promise<ConversationPackSync> {
  const owner=scopeGeneration(),current=()=>activeUserId()===user.id && scopeGeneration()===owner;
  return pull(async()=>{
    if(adapter.kind!=='supabase' || !current() || (after!==null && !validCursor(after))) return {ok:false};
    try {
      if (!(await recoverPending(current))) return {ok:false};
      const token=await adapter.getAccessToken();
      if (!token || !current()) return {ok:false};
      const reply=await getReply(`${TOKEN_SERVER}/conversation-packs${after?`?after=${encodeURIComponent(after)}`:''}`,token,request);
      if (!current() || reply.status!==200 || !reply.body || typeof reply.body!=='object') return {ok:false};
      const page=reply.body as {packs?:unknown;unavailable?:unknown;nextCursor?:unknown};
      const unavailable=page.unavailable??[];
      if (!Array.isArray(page.packs) || !Array.isArray(unavailable) || unavailable.some(row=>!validUnavailable(row))
        || page.packs.length+unavailable.length>CONVERSATION_PAGE_SIZE || page.packs.some(pack=>!isConversationPack(pack) || pack.learnerId!==user.id)
        || new Set([...page.packs,...unavailable].map(pack=>pack.id)).size!==page.packs.length+unavailable.length || (page.nextCursor!==null && !validCursor(page.nextCursor))
        || (page.nextCursor!==null && (page.packs.length+unavailable.length===0 || page.nextCursor===after))) return {ok:false};
      const packs=normaliseConversationPacks(page.packs as ConversationPack[]).map(withKnownPracticeStatus);
      if (!(await cacheAndBank(packs,current)) || !current()) return {ok:false};
      return {ok:true,packs,unavailable,nextCursor:page.nextCursor as string|null};
    } catch {return {ok:false};}
  });
}
/** The authoritative ID lookup keeps old bookmarks/revisits outside the cached window usable. */
export function loadConversationPackForLearner(user:AuthUser,adapter:AuthAdapter,packId:string,request:typeof fetch=fetch):Promise<ConversationPackLookup> {
  const owner=scopeGeneration(),current=()=>activeUserId()===user.id && scopeGeneration()===owner;
  return pull(async()=>{
    if(!current()) return {ok:false};
    try {
      if(adapter.kind!=='supabase') {
        const packs=await loadConversationPacks();
        return current()?{ok:true,pack:packs.find(pack=>pack.id===packId)??null}:{ok:false};
      }
      if (!(await recoverPending(current))) return {ok:false};
      const token=await adapter.getAccessToken();
      if(!token || !current()) return {ok:false};
      const reply=await getReply(`${TOKEN_SERVER}/conversation-packs/${encodeURIComponent(packId)}`,token,request);
      if(!current()) return {ok:false};
      if(reply.status===404) return {ok:true,pack:null};
      if(reply.status===413) return {ok:false,reason:'oversize'};
      const pack=(reply.body as {pack?:unknown}|null)?.pack;
      if(reply.status!==200 || !isConversationPack(pack) || pack.learnerId!==user.id || pack.id!==packId) return {ok:false};
      if(!(await cacheAndBank([withKnownPracticeStatus(pack)],current))) return {ok:false};
      return {ok:true,pack:withKnownPracticeStatus(normaliseConversationPacks([pack])[0]!)};
    } catch {return {ok:false};}
  });
}

async function authorisedDelete(
  user: AuthUser,
  adapter: AuthAdapter,
  path: string,
  locally: (packs: readonly ConversationPack[]) => ConversationPack[],
  request: typeof fetch = fetch,
  all = false,
): Promise<ConversationPackMutation> {
  const owner = scopeGeneration();
  const owned = () => activeUserId() === user.id && owner === scopeGeneration();
  const switched = (): ConversationPackMutation => ({ok:false,message:'The account changed. Open your Tutor history again.'});
  if (!owned()) return switched();
  const current = await loadConversationPacks();
  if (!owned()) return switched();
  // The local adapter has no server-owned Pack table. Keeping this path useful
  // for demos makes its privacy control truthful without pretending there was
  // anything to delete remotely.
  if (adapter.kind !== 'supabase') {
    const packs = locally(current);
    await replaceCache(packs, true);
    if (!owned()) return switched();
    await forgetDeletedNames(current, packs, all).catch(() => undefined);
    if (!owned()) return switched();
    return { ok: true, packs };
  }
  const token = await adapter.getAccessToken();
  if (!owned()) return switched();
  if (!token) return { ok: false, message: 'Please sign in again before changing your Tutor history.' };
  try {
    const response = await request(`${TOKEN_SERVER}${path}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, message: 'Your Tutor history was not changed. Please try again.' };
    if (!owned()) return switched();
    const packs = locally(current).filter((pack) => pack.learnerId === user.id);
    await replaceCache(packs, true);
    if (!owned()) return switched();
    await forgetDeletedNames(current, packs, all).catch(() => undefined);
    if (!owned()) return switched();
    return { ok: true, packs };
  } catch {
    return { ok: false, message: 'Your Tutor history was not changed. Check your connection and try again.' };
  }
}

/** Delete one Pack from the server and then replace only the local cache view. */
export function deleteConversationPackForLearner(
  user: AuthUser,
  adapter: AuthAdapter,
  packId: string,
  request: typeof fetch = fetch,
): Promise<ConversationPackMutation> {
  const owner = scopeGeneration();
  return pull(() => owner === scopeGeneration()
    ? authorisedDelete(user, adapter, `/conversation-packs/${encodeURIComponent(packId)}`, (packs) => packs.filter((pack) => pack.id !== packId), request)
    : Promise.resolve({ok:false,message:'The account changed. Open your Tutor history again.'}));
}

/** Delete all curated conversation history while leaving earned drills intact. */
export function deleteAllConversationPacksForLearner(
  user: AuthUser,
  adapter: AuthAdapter,
  request: typeof fetch = fetch,
): Promise<ConversationPackMutation> {
  const owner = scopeGeneration();
  return pull(() => owner === scopeGeneration()
    ? authorisedDelete(user, adapter, '/conversation-packs', () => [], request, true)
    : Promise.resolve({ok:false,message:'The account changed. Open your Tutor history again.'}));
}

onUserScopeReset(() => {
  writeChain = Promise.resolve();
  pullChain = Promise.resolve();
});
