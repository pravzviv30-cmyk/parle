/**
 * Luvani deletion journal: append-only encrypted erasure records outside the main database's rollback domain.
 * Implements exactly the contract of services/token-server/src/deletionJournal.ts. Web Crypto only (no nodejs_compat).
 */
import { d1Store, type D1Like } from './d1.ts';
import type { JournalStore } from './store.ts';

export interface Env { DB: D1Like; JOURNAL_TOKEN: string; PROJECT_SHA256: string }

const NAME = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_RECORD = 2048;
const MAX_REQUEST = 4096;
const PAGE = 100;

const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (status: number, error: string) => json(status, { error });

/** Canonical unpadded base64url of exactly `bytes` bytes (or any length when bytes is undefined). */
function base64url(value: unknown, bytes?: number): boolean {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return false;
  if (bytes !== undefined && value.length !== Math.ceil(bytes * 4 / 3)) return false;
  const spare = (value.length * 6) % 8; // unused low bits in the last character must be zero
  const last = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.indexOf(value.at(-1)!);
  return (last & ((1 << spare) - 1)) === 0;
}

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
/** Constant-time over fixed-length digests, so neither content nor length of the token leaks through timing. */
async function tokenMatches(header: string | null, token: string): Promise<boolean> {
  const presented = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const [a, b] = await Promise.all([digest(presented), digest(token)]);
  let diff = presented.length === 0 ? 1 : 0;
  for (let i = 0; i < 32; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Read at most `limit` bytes; null when larger, undefined when not valid UTF-8. */
async function boundedText(request: Request, limit: number): Promise<string | null | undefined> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength; if (size > limit) return null;
      parts.push(chunk.value);
    }
  } finally { void reader.cancel().catch(() => {}); }
  const all = new Uint8Array(size); let at = 0;
  for (const part of parts) { all.set(part, at); at += part.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(all); } catch { return undefined; }
}
function isJson(request: Request) { return (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase() === 'application/json'; }
function parseObject(text: string): Record<string, unknown> | null {
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

export async function handle(request: Request, env: Pick<Env, 'JOURNAL_TOKEN' | 'PROJECT_SHA256'>, store: JournalStore): Promise<Response> {
  if (typeof env.JOURNAL_TOKEN !== 'string' || env.JOURNAL_TOKEN.length < 32 || !NAME.test(env.PROJECT_SHA256 ?? '')) return fail(503, 'misconfigured');
  if (!(await tokenMatches(request.headers.get('authorization'), env.JOURNAL_TOKEN))) return fail(401, 'unauthorized');
  const url = new URL(request.url);
  if (url.hash || url.username) return fail(404, 'not-found');
  const path = url.pathname.split('/').filter(Boolean);

  if (path[0] === 'records' && path.length === 2) {
    const name = path[1]!;
    if (!NAME.test(name)) return fail(404, 'not-found');
    if (url.search) return fail(400, 'bad-request');
    if (request.method === 'GET') {
      const body = await store.get(name);
      return body === null ? fail(404, 'not-found') : new Response(body, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    if (request.method !== 'PUT') return fail(405, 'method-not-allowed');
    if (request.headers.get('if-none-match') !== '*' || !isJson(request)) return fail(400, 'bad-request');
    const text = await boundedText(request, MAX_RECORD);
    if (text === null) return fail(413, 'too-large');
    if (text === undefined) return fail(400, 'bad-request');
    const value = parseObject(text);
    if (!value || Object.keys(value).length !== 4 || value.version !== 1
      || !base64url(value.nonce, 12) || !base64url(value.tag, 16) || !base64url(value.ciphertext)) return fail(400, 'bad-request');
    return (await store.insertOnce(name, text)) === 'inserted' ? new Response(null, { status: 201 }) : new Response(null, { status: 412 });
  }

  if (path[0] === 'snapshots' && path.length === 1) {
    if (request.method !== 'POST') return fail(405, 'method-not-allowed');
    if (url.search || !isJson(request)) return fail(400, 'bad-request');
    const text = await boundedText(request, MAX_REQUEST);
    if (text === null) return fail(413, 'too-large');
    if (text === undefined) return fail(400, 'bad-request');
    const value = parseObject(text);
    if (!value || Object.keys(value).length !== 2 || value.version !== 1 || typeof value.project !== 'string') return fail(400, 'bad-request');
    if (value.project !== env.PROJECT_SHA256) return fail(403, 'wrong-project');
    const s = await store.seal();
    return json(201, { version: 1, snapshotId: s.snapshotId, project: env.PROJECT_SHA256, totalRecords: s.totalRecords, keysSha256: s.keysSha256, expiresAt: s.expiresAt });
  }

  if (path[0] === 'snapshots' && path[2] === 'records' && path.length === 3) {
    if (request.method !== 'GET') return fail(405, 'method-not-allowed');
    const snapshotId = path[1]!;
    const params = [...url.searchParams.keys()];
    const after = url.searchParams.get('after') ?? '';
    if (!UUID.test(snapshotId) || params.some(k => k !== 'after') || params.length > 1 || (url.searchParams.has('after') && !NAME.test(after))) return fail(400, 'bad-request');
    const page = await store.page(snapshotId, after, PAGE);
    if (page === null) return fail(404, 'unknown-snapshot');
    if (page === 'expired') return fail(410, 'snapshot-expired');
    return json(200, { snapshotId, keys: page.keys, nextCursor: page.nextCursor });
  }
  return fail(404, 'not-found');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return await handle(request, env, d1Store(env.DB)); }
    catch { return fail(500, 'internal'); }
  },
};
