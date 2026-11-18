import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { deletionJournal } from '../../services/token-server/src/deletionJournal.ts';
import { d1Store, type D1Like } from './d1.ts';
import { memoryStore } from './memoryStore.ts';
import worker, { handle } from './worker.ts';
import * as journalStore from './store.ts';
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

// Real SQL for d1.ts and the triggers: a small D1Like over node:sqlite (positional ?1 binds, meta.changes).
function sqliteD1(): D1Like & { db: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  return { db, prepare: sql => ({ bind: (...values) => {
    const statement = () => db.prepare(sql), args = values as never[];
    return {
      first: async () => (statement().get(...args) ?? null) as never,
      all: async () => ({ results: statement().all(...args) as never[] }),
      run: async () => ({ meta: { changes: Number(statement().run(...args).changes) } }),
    };
  } }) };
}
const sqlFile = (file: string) => readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
const freshD1 = () => { const d1 = sqliteD1(); d1.db.exec(sqlFile('schema.sql')); return d1; };
/** schema.sql as every live journal was created before migration 0002. */
const OLD_SCHEMA = `CREATE TABLE IF NOT EXISTS records (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE CHECK (length(name) = 64),
  body TEXT NOT NULL CHECK (length(body) <= 2048),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  high_water INTEGER NOT NULL,
  total INTEGER NOT NULL,
  keys_sha256 TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS records_no_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT, 'records are append-only'); END;
CREATE TRIGGER IF NOT EXISTS records_no_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT, 'records are append-only'); END;
CREATE TRIGGER IF NOT EXISTS snapshots_no_update BEFORE UPDATE ON snapshots BEGIN SELECT RAISE(ABORT, 'snapshots are immutable'); END;
CREATE TRIGGER IF NOT EXISTS snapshots_no_delete BEFORE DELETE ON snapshots BEGIN SELECT RAISE(ABORT, 'snapshots are immutable'); END;
`;
/** The contract's trigger text, whitespace-collapsed. It is load-bearing: schema.sql and the migration must carry it exactly. */
const RECORD_TRIGGERS = [
  "CREATE TRIGGER records_completion_only BEFORE UPDATE ON records WHEN NEW.rowid IS NOT OLD.rowid OR NEW.name IS NOT OLD.name OR NEW.body IS NOT OLD.body OR NEW.created_at IS NOT OLD.created_at OR NEW.completed_at IS NOT datetime('now') BEGIN SELECT RAISE(ABORT, 'records change only by completion'); END;",
  "CREATE TRIGGER records_delete_after_keep BEFORE DELETE ON records WHEN OLD.completed_at IS NULL OR OLD.completed_at > datetime('now', '-37 days') BEGIN SELECT RAISE(ABORT, 'record is inside its keep period'); END;",
];
const DAY = 24 * 60 * 60_000;
const KEEP_MS = 37 * DAY;
const [nameA, nameB, nameC, nameD] = ['a', 'b', 'c', 'd'].map(ch => ch.repeat(64)) as [string, string, string, string];
/** INSERT is not guarded, so a test can plant a stamp in the past; the Worker never inserts one. */
const plant = (db: DatabaseSync, name: string, stamp: string | null) =>
  db.prepare(`INSERT INTO records (name, body, completed_at) VALUES (?1, '{}', ${stamp ?? 'NULL'})`).run(name);
const names = (db: DatabaseSync) => (db.prepare('SELECT name FROM records ORDER BY name').all() as Array<{ name: string }>).map(r => r.name);

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

test('schema refuses UPDATE and DELETE on snapshots and guards records with the completion and keep triggers', () => {
  const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  for (const op of ['UPDATE', 'DELETE']) assert.match(sql, new RegExp(`BEFORE ${op} ON snapshots BEGIN SELECT RAISE\\(ABORT`));
  for (const trigger of RECORD_TRIGGERS) assert.ok(sql.includes(trigger), trigger);
  assert.equal(sql.match(/ON records/g)?.length, 2);
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

test('completion is stamped by the store, repeats move it forward, and an unknown record is 404', async () => {
  let clock = Date.now(); const { store, journal } = wire(memoryStore(() => clock));
  await journal.record(user()); const { name } = store.rows[0]!;
  const mark = (path = `/records/${name}/completion`, init: RequestInit = { method: 'POST' }, auth = token) => raw(store, path, init, auth);
  assert.equal(store.rows[0]!.completedAt, null);
  assert.equal((await mark()).status, 204); assert.equal(store.rows[0]!.completedAt, clock);
  clock += 60_000;
  assert.equal((await mark()).status, 204); assert.equal(store.rows[0]!.completedAt, clock);
  const stamped = clock; clock += 60_000;
  assert.equal((await mark(`/records/${'c'.repeat(64)}/completion`)).status, 404);
  assert.equal((await mark('/records/NOTHEX/completion')).status, 404);
  assert.equal((await mark(undefined, { method: 'GET' })).status, 405);
  assert.equal((await mark(undefined, { method: 'PUT', body: '{}' })).status, 405);
  assert.equal((await mark(`/records/${name}/completion?at=0`)).status, 400);
  assert.equal((await mark(undefined, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"completedAt":0}' })).status, 400);
  assert.equal((await mark(undefined, undefined, 'x'.repeat(48))).status, 401);
  assert.equal(store.rows[0]!.completedAt, stamped);
});

test('the D1 store passes the completion, removal and seal checks on real SQLite', async () => {
  const d1 = freshD1(); const clock = Date.now(); const store = d1Store(d1, () => clock);
  plant(d1.db, nameD, "datetime('now', '-37 days', '-1 second')");
  for (const name of [nameA, nameB, nameC]) assert.equal(await store.insertOnce(name, '{}'), 'inserted');
  assert.equal(await store.insertOnce(nameA, '{"other":1}'), 'exists'); assert.equal(await store.get(nameA), '{}');
  assert.equal(await store.complete(nameA), 'completed'); assert.equal(await store.complete(nameA), 'completed');
  assert.equal(await store.complete('e'.repeat(64)), 'missing');
  assert.deepEqual({ ...d1.db.prepare("SELECT completed_at = datetime('now') AS now FROM records WHERE name = ?1").get(nameA) }, { now: 1 });
  const sealed = await store.seal(); assert.equal(sealed.totalRecords, 4);
  assert.equal(await store.removeDue(), 0, 'an unexpired snapshot holds cleanup back');
  assert.equal(await d1Store(d1, () => clock + DAY).removeDue(), 1);
  assert.deepEqual(names(d1.db), [nameA, nameB, nameC]);
  const resealed = await store.seal();
  assert.notEqual(resealed.snapshotId, sealed.snapshotId);
  assert.equal(resealed.totalRecords, 3); assert.equal(resealed.keysSha256, await sha256Names([nameA, nameB, nameC]));
  assert.deepEqual(await store.page(resealed.snapshotId, '', 100), { keys: [nameA, nameB, nameC], nextCursor: null });
  assert.equal(await d1Store(d1, () => clock + DAY).removeDue(), 0, 'a fresh completion and unmarked records stay');
});

test('the schema lets a record change only by a completion stamped now, and refuses delete until 37 days after it', () => {
  const { db } = freshD1();
  plant(db, nameA, null);
  const refusedUpdate = /records change only by completion/, refusedDelete = /record is inside its keep period/;
  for (const set of ["completed_at = datetime('now', '-1 day')", "completed_at = datetime('now', '+1 day')", 'completed_at = NULL',
    "body = '{\"x\":1}', completed_at = datetime('now')", `name = '${nameB}', completed_at = datetime('now')`,
    "created_at = '2000-01-01 00:00:00', completed_at = datetime('now')", "rowid = 99, completed_at = datetime('now')"])
    assert.throws(() => db.prepare(`UPDATE records SET ${set} WHERE name = ?1`).run(nameA), refusedUpdate, set);
  assert.throws(() => db.prepare('DELETE FROM records WHERE name = ?1').run(nameA), refusedDelete, 'unmarked');
  assert.equal(db.prepare("UPDATE records SET completed_at = datetime('now') WHERE name = ?1").run(nameA).changes, 1);
  assert.throws(() => db.prepare('DELETE FROM records WHERE name = ?1').run(nameA), refusedDelete, 'marked now');
  plant(db, nameB, "datetime('now', '-37 days', '+1 second')");
  assert.throws(() => db.prepare('DELETE FROM records WHERE name = ?1').run(nameB), refusedDelete, 'a second inside the keep period');
  plant(db, nameC, "datetime('now', '-37 days', '-1 second')");
  assert.equal(db.prepare('DELETE FROM records WHERE name = ?1').run(nameC).changes, 1);
  assert.throws(() => db.exec('DELETE FROM records'), refusedDelete);
  assert.deepEqual(names(db), [nameA, nameB]);
  db.prepare("INSERT INTO snapshots (id, high_water, total, keys_sha256, expires_at) VALUES ('s', 1, 1, 'k', '2000-01-01')").run();
  assert.throws(() => db.exec("UPDATE snapshots SET total = 0"), /snapshots are immutable/);
  assert.throws(() => db.exec('DELETE FROM snapshots'), /snapshots are immutable/);
});

/** Statements of a migration file, a trigger's BEGIN ... END kept whole. */
function statements(sql: string): string[] {
  const out: string[] = []; let current = '';
  for (const line of sql.split('\n')) {
    if (!current && (line.trim() === '' || line.startsWith('--'))) continue;
    current += line + '\n';
    if (/;\s*$/.test(line) && (!/\bBEGIN\b/.test(current) || /\bEND;\s*$/.test(line))) { out.push(current); current = ''; }
  }
  assert.equal(current.trim(), ''); return out;
}
const collapse = (sql: string) => sql.replace(/\s+/g, ' ').replace(/ IF NOT EXISTS /g, ' ').trim();
const master = (db: DatabaseSync) => db.prepare('SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name').all().map(r => ({ ...r }));
const shape = (db: DatabaseSync) => ({
  columns: db.prepare("SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_xinfo('records')").all().map(r => ({ ...r })),
  triggers: (db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all() as Array<{ name: string; sql: string }>).map(t => [t.name, collapse(t.sql)]),
});
function assertGuarded(db: DatabaseSync, step: string) {
  const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'records'").all() as Array<{ sql: string }>).map(t => collapse(t.sql)).join(' ');
  assert.match(sql, /BEFORE UPDATE ON records/, `update unguarded after: ${step}`);
  assert.match(sql, /BEFORE DELETE ON records/, `delete unguarded after: ${step}`);
}

test('the migration turns the old schema into schema.sql without an unguarded moment, and the rollback restores it', () => {
  const live = sqliteD1().db; live.exec(OLD_SCHEMA); live.prepare("INSERT INTO records (name, body) VALUES (?1, '{}')").run(nameA);
  const before = master(live); const MIGRATE = sqlFile('migrate-0002-removal.sql');
  for (const trigger of RECORD_TRIGGERS) assert.ok(collapse(MIGRATE).includes(trigger), trigger);
  const migrate = statements(MIGRATE); assert.ok(migrate.length >= 5);
  for (const step of migrate) { live.exec(step); assertGuarded(live, step); }
  assert.deepEqual(shape(live), shape(freshD1().db));
  assert.deepEqual({ ...live.prepare('SELECT name, body, completed_at FROM records').get() }, { name: nameA, body: '{}', completed_at: null }, 'existing entries stay, unstamped');
  assert.equal(live.prepare("UPDATE records SET completed_at = datetime('now') WHERE name = ?1").run(nameA).changes, 1);
  const rollback = statements(sqlFile('rollback-0002-removal.sql')); assert.ok(rollback.length >= 5);
  for (const step of rollback) { live.exec(step); assertGuarded(live, step); }
  assert.deepEqual(master(live), before);
  assert.deepEqual(names(live), [nameA]);
  assert.throws(() => live.exec('DELETE FROM records'), /records are append-only/);
});

test('the keep period is the backup window plus thirty days in code, schema and migration', () => {
  const { BACKUP_WINDOW_DAYS, JOURNAL_MARGIN_DAYS, JOURNAL_KEEP_DAYS } = journalStore as Record<string, unknown>;
  assert.equal(BACKUP_WINDOW_DAYS, 7); assert.equal(JOURNAL_MARGIN_DAYS, 30);
  assert.equal(JOURNAL_KEEP_DAYS, 37); assert.equal(JOURNAL_KEEP_DAYS, (BACKUP_WINDOW_DAYS as number) + (JOURNAL_MARGIN_DAYS as number));
  for (const file of ['schema.sql', 'migrate-0002-removal.sql']) {
    const sql = sqlFile(file);
    assert.equal(sql.split(`'-${JOURNAL_KEEP_DAYS} days'`).length - 1, 1, file);
    assert.deepEqual(sql.match(/'-?\d+ days'/g), [`'-${JOURNAL_KEEP_DAYS} days'`], file);
  }
});

test('cleanup removes only records completed more than the keep period ago', async () => {
  const start = Date.now(); let clock = start; const store = memoryStore(() => clock);
  for (const name of [nameA, nameB, nameC]) await store.insertOnce(name, '{}');
  await store.complete(nameA); clock += DAY; await store.complete(nameB);
  clock = start + KEEP_MS - 1;
  assert.equal(await store.removeDue(), 0);
  clock = start + KEEP_MS;
  assert.equal(await store.removeDue(), 1); assert.deepEqual(store.rows.map(r => r.name), [nameB, nameC]);
  clock = start + DAY + KEEP_MS - 1;
  assert.equal(await store.removeDue(), 0);
  clock += 1;
  assert.equal(await store.removeDue(), 1);
  clock += 400 * DAY;
  assert.equal(await store.removeDue(), 0); assert.deepEqual(store.rows.map(r => r.name), [nameC], 'an unmarked entry is never removed');
});

test('cleanup waits while a sealed snapshot is unexpired, so a listing in progress stays whole', async () => {
  let clock = Date.now(); const store = memoryStore(() => clock);
  for (const name of [nameA, nameB]) await store.insertOnce(name, '{}');
  await store.complete(nameA); clock += KEEP_MS;
  const sealed = JSON.parse(await seal(store)) as { snapshotId: string; totalRecords: number };
  assert.equal(sealed.totalRecords, 2);
  assert.equal(await store.removeDue(), 0);
  clock += DAY - 1;
  assert.equal(await store.removeDue(), 0);
  assert.deepEqual(await store.page(sealed.snapshotId, '', 100), { keys: [nameA, nameB], nextCursor: null });
  clock += 1;
  assert.equal(await store.removeDue(), 1); assert.deepEqual(store.rows.map(r => r.name), [nameB]);
});

test('the scheduled handler runs the cleanup and wrangler.toml declares its cron', async () => {
  const d1 = freshD1();
  plant(d1.db, nameA, "datetime('now', '-37 days', '-1 second')"); plant(d1.db, nameB, null);
  const scheduled = (worker as { scheduled?: (controller: unknown, env: unknown, ctx: unknown) => Promise<void> }).scheduled;
  assert.equal(typeof scheduled, 'function');
  await scheduled!({ cron: '17 3 * * *', scheduledTime: Date.now() }, { DB: d1, ...env }, { waitUntil() {} });
  assert.deepEqual(names(d1.db), [nameB]);
  const toml = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
  assert.match(toml, /^\[triggers\]\ncrons = \["17 3 \* \* \*"\]$/m);
});

test('seal never reuses a snapshot that removal has made stale', async () => {
  // A second isolate whose clock already sees the snapshot expired removes a record under an unchanged high water.
  const d1 = freshD1(); const clock = Date.now(); const store = d1Store(d1, () => clock);
  plant(d1.db, nameA, "datetime('now', '-37 days', '-1 second')"); plant(d1.db, nameB, null);
  const first = await store.seal(); assert.equal(first.totalRecords, 2);
  assert.equal(await d1Store(d1, () => clock + DAY).removeDue(), 1);
  const second = await store.seal();
  assert.notEqual(second.snapshotId, first.snapshotId);
  assert.equal(second.totalRecords, 1); assert.equal(second.keysSha256, await sha256Names([nameB]));
  assert.deepEqual(await store.seal(), second, 'a still-true snapshot is reused');

  // The memory store mirrors it: a sequence that never goes down, and the same count check.
  let memoryClock = Date.now(); const memory = memoryStore(() => memoryClock);
  for (const name of [nameA, nameB, nameC]) await memory.insertOnce(name, '{}');
  await memory.complete(nameA); memoryClock += KEEP_MS;
  const sealed = await memory.seal(); assert.equal(sealed.totalRecords, 3);
  memoryClock += DAY; assert.equal(await memory.removeDue(), 1); memoryClock -= DAY;
  const fresh = await memory.seal();
  assert.notEqual(fresh.snapshotId, sealed.snapshotId); assert.equal(fresh.totalRecords, 2);
  await memory.insertOnce(nameD, '{}');
  const grown = await memory.seal();
  assert.equal(grown.highWater, 4); assert.equal(grown.totalRecords, 3);
});

test('a replay after removal verifies and applies exactly the entries that remain', async () => {
  let clock = Date.now(); const { store, journal } = wire(memoryStore(() => clock)); const ids = [user(), user(), user()];
  for (const id of ids) await journal.record(id);
  assert.equal(await journal.replay(async () => {}), 3);
  await store.complete(store.rows[0]!.name); clock += KEEP_MS;
  assert.equal(await store.removeDue(), 1);
  const applied: string[] = []; let verified = 0;
  assert.equal(await journal.replay(async id => { applied.push(id); }, s => { verified = s.totalRecords; }), 2);
  assert.deepEqual(applied.sort(), [ids[1]!, ids[2]!].sort()); assert.equal(verified, 2);
  const late = user(); await journal.record(late);
  const again: string[] = [];
  assert.equal(await journal.replay(async id => { again.push(id); }), 3);
  assert.deepEqual(again.sort(), [ids[1]!, ids[2]!, late].sort());
});

test('cleanup leaves a record completed less than the keep period ago, on D1', async () => {
  // A cutoff earlier than the trigger's would pick this row, the trigger would abort the whole DELETE, and cleanup would stop every day.
  const d1 = freshD1(); const store = d1Store(d1);
  plant(d1.db, nameA, "datetime('now', '-37 days', '-1 second')"); plant(d1.db, nameB, "datetime('now', '-36 days', '-12 hours')");
  assert.equal(await store.removeDue(), 1);
  assert.deepEqual(names(d1.db), [nameB]);
});
