import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deletionJournal } from '../../services/token-server/src/deletionJournal.ts';
import { memoryStore } from './memoryStore.ts';
import { handle } from './worker.ts';
import { sha256Names } from './store.ts';

const projectUrl = 'https://wtexbzuyfersdtiekrvp.supabase.co';
const token = 'j'.repeat(48);
const env = { JOURNAL_TOKEN: token, PROJECT_SHA256: createHash('sha256').update(projectUrl).digest('hex') };
const config = { endpoint: 'https://journal.test', token, key: Buffer.alloc(32, 9).toString('base64url'), projectUrl };
const user = () => randomUUID();

function wire(store = memoryStore(), workerEnv: typeof env = env) {
  const request: typeof fetch = async (url, init) => handle(new Request(String(url), init), workerEnv, store);
  return { store, request, journal: deletionJournal(config, request) };
}
const raw = (store: ReturnType<typeof memoryStore>, path: string, init: RequestInit = {}, auth = token) =>
  handle(new Request(`https://journal.test${path}`, { ...init, headers: { authorization: `Bearer ${auth}`, ...init.headers } }), env, store);

test('record writes once, reads back the exact bytes, and a duplicate is idempotent through 412', async () => {
  const { store, journal } = wire(); const id = user();
  await journal.record(id);
  assert.equal(store.rows.length, 1); const { name, body } = store.rows[0]!;
  assert.ok(!body.includes(id));
  const got = await raw(store, `/records/${name}`);
  assert.equal(got.status, 200); assert.equal(got.headers.get('content-type'), 'application/json'); assert.equal(await got.text(), body);
  const again = await raw(store, `/records/${name}`, { method: 'PUT', headers: { 'if-none-match': '*', 'content-type': 'application/json' }, body: body.replace(/"tag":"[^"]+"/, `"tag":"${Buffer.alloc(16).toString('base64url')}"`) });
  assert.equal(again.status, 412);
  await journal.record(id);
  assert.equal(store.rows.length, 1); assert.equal(store.rows[0]!.body, body);
});

test('replay through a sealed snapshot returns exactly the recorded users and excludes later writes', async () => {
  const { store, request, journal } = wire(); const ids = [user(), user(), user()];
  for (const id of ids) await journal.record(id);
  const applied: string[] = [];
  assert.equal(await journal.replay(async id => { applied.push(id); }), 3);
  assert.deepEqual(applied.sort(), [...ids].sort());

  // Seal, then write, then list: the late record is outside the high-water mark.
  const sealed = await raw(store, '/snapshots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, project: env.PROJECT_SHA256 }) });
  assert.equal(sealed.status, 201); const snapshot = await sealed.json() as { snapshotId: string; totalRecords: number };
  assert.equal(snapshot.totalRecords, 3);
  await deletionJournal(config, request).record(user());
  const page = await (await raw(store, `/snapshots/${snapshot.snapshotId}/records`)).json() as { keys: string[]; nextCursor: null };
  assert.equal(page.keys.length, 3); assert.equal(page.nextCursor, null);
  assert.deepEqual(page.keys, store.rows.slice(0, 3).map(r => r.name).sort());
});

test('paging over more than 100 keys verifies the full key hash', async () => {
  const { journal } = wire(); const ids = Array.from({ length: 205 }, user);
  for (const id of ids) await journal.record(id);
  const applied = new Set<string>(); let verified = 0;
  assert.equal(await journal.replay(async id => { applied.add(id); }, s => { verified = s.totalRecords; }), 205);
  assert.equal(applied.size, 205); assert.equal(verified, 205);
});

test('wrong token, wrong project and misconfigured worker are refused', async () => {
  const { request } = wire();
  await assert.rejects(deletionJournal({ ...config, token: 'x'.repeat(48) }, request).record(user()), /journal-write-unavailable/);
  await assert.rejects(deletionJournal({ ...config, projectUrl: 'https://other.supabase.co' }, request).replay(async () => assert.fail()), /journal-snapshot-unavailable/);
  const store = memoryStore();
  assert.equal((await raw(store, '/records/' + 'a'.repeat(64), {}, 'x'.repeat(48))).status, 401);
  assert.equal((await handle(new Request('https://journal.test/records/' + 'a'.repeat(64)), env, store)).status, 401);
  assert.equal((await handle(new Request('https://journal.test/x', { headers: { authorization: 'Bearer short' } }), { ...env, JOURNAL_TOKEN: 'short' }, store)).status, 503);
  assert.equal((await raw(store, '/snapshots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, project: 'f'.repeat(64) }) })).status, 403);
});

test('oversized, malformed and unconditional writes are refused; unknown reads and routes are 404/405', async () => {
  const store = memoryStore(); const name = 'b'.repeat(64);
  const put = (body: string, headers: Record<string, string> = { 'if-none-match': '*', 'content-type': 'application/json' }) => raw(store, `/records/${name}`, { method: 'PUT', headers, body });
  const good = { version: 1, nonce: Buffer.alloc(12).toString('base64url'), ciphertext: 'AAAA', tag: Buffer.alloc(16).toString('base64url') };
  assert.equal((await put(JSON.stringify({ ...good, ciphertext: 'A'.repeat(3000) }))).status, 413);
  assert.equal((await put('{not json')).status, 400);
  assert.equal((await put(JSON.stringify({ ...good, extra: 1 }))).status, 400);
  assert.equal((await put(JSON.stringify({ ...good, version: 2 }))).status, 400);
  assert.equal((await put(JSON.stringify({ ...good, nonce: 'AAAA' }))).status, 400);
  assert.equal((await put(JSON.stringify({ ...good, tag: good.tag.slice(0, -1) + 'B' }))).status, 400);
  assert.equal((await put(JSON.stringify(good), { 'content-type': 'application/json' })).status, 400);
  assert.equal((await put(JSON.stringify(good), { 'if-none-match': '*', 'content-type': 'text/plain' })).status, 400);
  assert.equal(store.rows.length, 0);
  assert.equal((await put(JSON.stringify(good))).status, 201);
  assert.equal((await raw(store, '/records/' + 'c'.repeat(64))).status, 404);
  assert.equal((await raw(store, '/records/NOTHEX')).status, 404);
  assert.equal((await raw(store, `/records/${name}`, { method: 'DELETE' })).status, 405);
  assert.equal((await raw(store, '/snapshots')).status, 405);
  assert.equal((await raw(store, '/')).status, 404);
  assert.equal((await raw(store, `/snapshots/${randomUUID()}/records`)).status, 404);
});

test('expired snapshots answer 410', async () => {
  let clock = Date.now(); const store = memoryStore(() => clock);
  const sealed = await (await raw(store, '/snapshots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, project: env.PROJECT_SHA256 }) })).json() as { snapshotId: string; expiresAt: string };
  assert.equal(Date.parse(sealed.expiresAt) - clock, 24 * 60 * 60_000);
  clock += 24 * 60 * 60_000 - 1;
  assert.equal((await raw(store, `/snapshots/${sealed.snapshotId}/records`)).status, 200);
  clock += 1;
  assert.equal((await raw(store, `/snapshots/${sealed.snapshotId}/records`)).status, 410);
});

test('every response stays under the client 16 KiB cap', async () => {
  const { store, journal } = wire();
  for (let i = 0; i < 120; i++) await journal.record(user());
  const sealed = await (await raw(store, '/snapshots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, project: env.PROJECT_SHA256 }) })).json() as { snapshotId: string };
  const body = await (await raw(store, `/snapshots/${sealed.snapshotId}/records`)).text();
  assert.ok(Buffer.byteLength(body) <= 16_384);
});

test('schema refuses UPDATE and DELETE on records and snapshots', () => {
  const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  for (const table of ['records', 'snapshots']) for (const op of ['UPDATE', 'DELETE'])
    assert.match(sql, new RegExp(`BEFORE ${op} ON ${table} BEGIN SELECT RAISE\\(ABORT`));
  assert.match(sql, /name TEXT NOT NULL UNIQUE CHECK \(length\(name\) = 64\)/);
  assert.match(sql, /rowid INTEGER PRIMARY KEY AUTOINCREMENT/);
  assert.doesNotMatch(sql, /DROP|DELETE FROM|UPDATE \w+ SET/i);
});

const seal = async (store: ReturnType<typeof memoryStore>) => (await raw(store, '/snapshots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, project: env.PROJECT_SHA256 }) })).text();

test('seal reuses the unexpired snapshot while the high water is unchanged, and reseals after a write or expiry', async () => {
  let clock = Date.now(); const { store, request } = wire(memoryStore(() => clock));
  await deletionJournal(config, request).record(user());
  const first = await seal(store); const second = await seal(store);
  assert.equal(second, first); assert.equal(store.sealsComputed, 1);
  await deletionJournal(config, request).record(user());
  const third = await seal(store);
  assert.notEqual(JSON.parse(third).snapshotId, JSON.parse(first).snapshotId); assert.equal(JSON.parse(third).totalRecords, 2); assert.equal(store.sealsComputed, 2);
  clock += 24 * 60 * 60_000;
  assert.notEqual(JSON.parse(await seal(store)).snapshotId, JSON.parse(third).snapshotId); assert.equal(store.sealsComputed, 3);
});

test('5,000-record seal matches the reference hash of sorted raw names', async () => {
  const store = memoryStore();
  for (let i = 0; i < 5000; i++) await store.insertOnce(createHash('sha256').update(String(i)).digest('hex'), '{}');
  const expected = createHash('sha256').update(Buffer.concat(store.rows.map(r => r.name).sort().map(n => Buffer.from(n, 'hex')))).digest('hex');
  const names = store.rows.map(r => r.name).sort();
  const started = performance.now(); const hash = await sha256Names(names); const elapsed = performance.now() - started;
  assert.equal(hash, expected);
  const sealed = JSON.parse(await seal(store));
  assert.equal(sealed.keysSha256, expected); assert.equal(sealed.totalRecords, 5000);
  console.log(`sha256Names over 5000 names: ${elapsed.toFixed(2)} ms (Node; Workers CPU is comparable V8)`);
  await assert.rejects(sha256Names(['G'.repeat(64)]), /invalid-name/);
});
