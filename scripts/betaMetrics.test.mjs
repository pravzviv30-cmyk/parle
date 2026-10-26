/**
 * deployment/beta-metrics.sql against every migration replayed in disposable
 * PostgreSQL/WASM, with synthetic rows and hand-computed answers.
 *
 * The file is run exactly as written (comments stripped, split on semicolons),
 * so the gate notices if a migration breaks a query or a query stops reading only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { ROOT, buildSchemaManifest, MANAGED_DEFAULT_PRIVILEGES_SQL } from './releaseSchemaManifest.mjs';

const uid = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const [A, B, C, D, E, F] = [1, 2, 3, 4, 5, 6].map(uid);

async function statements() {
  const text = await readFile(new URL('../deployment/beta-metrics.sql', import.meta.url), 'utf8');
  return text.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
}

test('beta-metrics.sql: every statement runs on all migrations and only reads', async () => {
  const schema = await buildSchemaManifest();
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    await db.exec(MANAGED_DEFAULT_PRIVILEGES_SQL);
    for (const migration of schema.migrations) await db.exec(await readFile(`${ROOT}/supabase/migrations/${migration.name}`, 'utf8'));
    const onDisk = (await readdir(`${ROOT}/supabase/migrations`)).filter((name) => name.endsWith('.sql')).length;
    assert.equal(schema.migrations.length, onDisk, `all ${onDisk} migrations replayed`);

    for (const id of [A, B, C, D, E, F]) await db.query('insert into auth.users(id) values($1)', [id]);
    const profile = (id, motivation) => db.query("insert into public.learner_state(user_id,namespace,payload) values($1,'profile',$2)", [id, JSON.stringify({ data: { motivation } })]);
    await profile(A, 'trip'); await profile(B, 'work'); await profile(C, 'food'); await profile(D, 'because');
    // E has no synced profile, so it reads as 'unknown'. F has minutes and no events.

    const event = (user, at, turns, unassistedPct, kind = 'convo') => db.query(
      "insert into public.product_events(user_id,name,properties,occurred_at) values($1,'live_session_finished',$2,$3)",
      [user, JSON.stringify({ kind, voice: true, turns, rescues: 0, unassistedPct, replyLatencyMs: null }), at]);
    const usage = (n, user, at, seconds) => db.query(
      'insert into public.session_usage(session_id,user_id,seconds,reported_at) values($1,$2,$3,$4)',
      [`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`, user, seconds, at]);

    // A (deadline): session 1 all rescues, session 2 had no turns, session 3 is the first unaided one.
    await event(A, '2026-10-01T10:00:00Z', 3, 0);
    await event(A, '2026-10-02T10:00:00Z', 0, 100);
    await event(A, '2026-10-03T10:00:00Z', 4, 40, 'lesson');
    await event(A, '2026-10-04T10:00:00Z', 6, 90);
    await usage(1, A, '2026-10-01T09:59:58Z', 300);  // counted
    await usage(2, A, '2026-10-02T10:00:30Z', 120);  // counted (before session 3)
    await usage(3, A, '2026-10-03T10:00:20Z', 240);  // 20 s after the event, inside the tolerance: counted
    await usage(4, A, '2026-10-03T10:05:00Z', 300);  // 5 min after: not counted
    // B (deadline): first session is unaided; a later one must not replace it.
    await event(B, '2026-10-05T08:00:00Z', 2, 100);
    await event(B, '2026-10-06T08:00:00Z', 5, 80);
    await usage(5, B, '2026-10-05T07:59:00Z', 150);
    await usage(6, B, '2026-10-06T07:59:00Z', 900);
    // C (hobby): second session.
    await event(C, '2026-10-07T12:00:00Z', 1, 0);
    await event(C, '2026-10-08T12:00:00Z', 5, 20);
    await usage(7, C, '2026-10-07T11:59:00Z', 600);
    await usage(8, C, '2026-10-08T11:59:00Z', 180);
    // D (hobby): sessions, never unaided (all rescued, or no turns).
    await event(D, '2026-10-09T12:00:00Z', 3, 0);
    await event(D, '2026-10-10T12:00:00Z', 0, 50);
    await usage(9, D, '2026-10-09T11:59:00Z', 200);
    // E (unknown): usage exactly 60 s after counts, 61 s does not; an expired row (null seconds) is zero.
    await event(E, '2026-10-11T12:00:00Z', 1, 10);
    await db.query("insert into public.session_usage(session_id,user_id,seconds,reported_at,details_expired_at) values('aaaaaaaa-aaaa-4aaa-8aaa-000000000010',$1,null,'2026-10-10T12:00:00Z','2026-10-12T00:00:00Z')", [E]);
    await usage(11, E, '2026-10-11T12:01:00Z', 90);
    await usage(12, E, '2026-10-11T12:01:01Z', 200);
    // F: minutes, no finished-session event (not consented, or never finished): absent from query 6.
    await usage(13, F, '2026-10-12T12:00:00Z', 100);

    const sql = await statements();
    assert.equal(sql.length, 6, 'one view and five queries');
    const results = [];
    for (const statement of sql) results.push(await db.query(statement));

    const six = results[5].rows.map((r) => ({
      cohort: r.cohort, measured: Number(r.measured), notYet: Number(r.not_yet_unaided),
      medianMinutes: r.median_minutes === null ? null : Number(r.median_minutes), p75Minutes: r.p75_minutes === null ? null : Number(r.p75_minutes),
      medianSessions: r.median_sessions === null ? null : Number(r.median_sessions), p75Sessions: r.p75_sessions === null ? null : Number(r.p75_sessions),
    }));
    // deadline: A = (300+120+240)/60 = 11.0 min at session 3; B = 150/60 = 2.5 min at session 1.
    //   median minutes (11.0+2.5)/2 = 6.75 -> 6.8; p75 = 2.5 + 0.75*8.5 = 8.875 -> 8.9;
    //   median sessions (3+1)/2 = 2; p75 = 1 + 0.75*2 = 2.5.
    // hobby: C = (600+180)/60 = 13.0 min at session 2; D not yet. One measured learner, so every percentile is C.
    // unknown: E = 90/60 = 1.5 min at session 1 (the 61 s row and the null row add nothing).
    assert.deepEqual(six, [
      { cohort: 'deadline', measured: 2, notYet: 0, medianMinutes: 6.8, p75Minutes: 8.9, medianSessions: 2, p75Sessions: 2.5 },
      { cohort: 'hobby', measured: 1, notYet: 1, medianMinutes: 13, p75Minutes: 13, medianSessions: 2, p75Sessions: 2 },
      { cohort: 'unknown', measured: 1, notYet: 0, medianMinutes: 1.5, p75Minutes: 1.5, medianSessions: 1, p75Sessions: 1 },
    ]);

    // The earlier queries still run against the same rows (their values were hand-checked on 2026-10-22).
    assert.ok(results[3].rows.length > 0 && results[4].rows.length > 0);
    // Read-only: nothing here changed a table.
    assert.equal(Number((await db.query('select count(*) as n from public.session_usage')).rows[0].n), 13);
    assert.equal(Number((await db.query('select count(*) as n from public.product_events')).rows[0].n), 11);
  } finally { await db.close(); }
});
