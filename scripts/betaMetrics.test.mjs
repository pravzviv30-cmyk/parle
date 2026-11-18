/**
 * deployment/beta-metrics.sql against every migration replayed in disposable
 * PostgreSQL/WASM, with synthetic rows and hand-computed answers.
 *
 * The file is run exactly as written (comments stripped, split on semicolons),
 * so the gate notices if a migration breaks a query or a query stops reading only.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { ROOT, buildSchemaManifest, MANAGED_DEFAULT_PRIVILEGES_SQL } from './releaseSchemaManifest.mjs';
import { PLANS, YEARLY_PLANS, STORE_FEE_RATES } from '../packages/core/src/metering/meter.ts';

const uid = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const [A, B, C, D, E, F] = [1, 2, 3, 4, 5, 6].map(uid);

async function statements() {
  const text = await readFile(new URL('../deployment/beta-metrics.sql', import.meta.url), 'utf8');
  return text.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
}

/** A disposable database with the Supabase roles, the auth stubs and every migration replayed. */
async function bootstrap() {
  const schema = await buildSchemaManifest();
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  await db.exec(MANAGED_DEFAULT_PRIVILEGES_SQL);
  for (const migration of schema.migrations) await db.exec(await readFile(`${ROOT}/supabase/migrations/${migration.name}`, 'utf8'));
  const onDisk = (await readdir(`${ROOT}/supabase/migrations`)).filter((name) => name.endsWith('.sql')).length;
  assert.equal(schema.migrations.length, onDisk, `all ${onDisk} migrations replayed`);
  return db;
}

test('beta-metrics.sql: every statement runs on all migrations and only reads', async () => {
  const db = await bootstrap();
  try {
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
    assert.equal(sql.length, 12, 'one view and eleven queries');
    const results = [];
    for (const statement of sql) results.push(await db.query(statement));

    const six = results[6].rows.map((r) => ({
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
    assert.ok(results[4].rows.length > 0 && results[5].rows.length > 0);
    // Read-only: nothing here changed a table.
    assert.equal(Number((await db.query('select count(*) as n from public.session_usage')).rows[0].n), 13);
    assert.equal(Number((await db.query('select count(*) as n from public.product_events')).rows[0].n), 11);
  } finally { await db.close(); }
});

// The statements added for the four-number report, on one shared second database
// seeded relative to now(), because statements 2b, 7 and 9 compare with it.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DAY = 86_400_000;
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
let shared;
after(async () => { if (shared) await (await shared).db.close(); });

function report() {
  shared ??= (async () => {
    const db = await bootstrap();
    const users = Array.from({ length: 24 }, (_, i) => id(i + 1));
    for (const user of users) await db.query('insert into auth.users(id) values($1)', [user]);
    const state = (user, namespace, data) => db.query('insert into public.learner_state(user_id,namespace,payload) values($1,$2,$3)',
      [user, namespace, JSON.stringify({ v: 1, deviceId: 'device', savedAt: 0, data })]);
    const now = Date.now();
    const day0 = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()) - 40 * DAY + 12 * 3_600_000;
    const at = (n) => day0 + n * DAY;

    // Cohort (F1274): goal edited after onboarding wins, a cleared goal is unknown, motivation alone still counts.
    await state(id(1), 'profile', { motivation: 'trip', onboardingGoal: 'food' });
    await state(id(2), 'profile', { motivation: 'trip', onboardingGoal: null });
    await state(id(3), 'profile', { motivation: 'work' });

    // Practice days (F1273), day 0 forty days ago.
    // 4 (deadline): game sittings only on days 0, 1 and 7, and no session_usage.
    await state(id(4), 'profile', { motivation: 'trip' });
    await state(id(4), 'game', { sittings: [0, 1, 7].map((n) => ({ at: at(n), source: 'drill' })) });
    // 5 (hobby): activity entries only, XP on days 0 and 1. The zero-XP entry on day 8 is not a practice day.
    await state(id(5), 'profile', { onboardingGoal: 'food' });
    await state(id(5), 'activity', { version: 2, entries: [{ at: at(0), kind: 'lesson', xp: 10 }, { at: at(1), kind: 'drill', xp: 5 }, { at: at(8), kind: 'drill', xp: 0 }] });
    // 6 (deadline): activeDays only, days 0 and 30.
    await state(id(6), 'profile', { motivation: 'work' });
    await state(id(6), 'activity', { version: 2, entries: [], activeDays: [dayKey(at(0)), dayKey(at(30))] });
    // 7 (unknown, no profile): first practised today, so not yet eligible for any day.
    await state(id(7), 'activity', { version: 2, entries: [], activeDays: [dayKey(now)] });
    // 8 (hobby): every path malformed. It must not fail the statement, and it has no practice day.
    await state(id(8), 'profile', { motivation: 'because' });
    await state(id(8), 'activity', { version: 2, activeDays: ['2026-02-31', 42, 'not-a-day', '0000-01-01'], entries: [{ at: 'x', xp: 5 }, 7, { at: 1e300, xp: 1 }, { at: at(0), xp: '5' }] });
    await state(id(8), 'game', { sittings: 'nope' });
    // 9 (unknown, no profile): day 0 forty days ago and a skewed phone clock's day in 2099, which is no return.
    await state(id(9), 'activity', { version: 2, entries: [], activeDays: [dayKey(at(0)), '2099-01-01'] });
    // 10 (unknown, no profile): first practised exactly 7 days ago, so it is in the D1 and D7 denominators.
    await state(id(10), 'activity', { version: 2, entries: [], activeDays: [dayKey(now - 7 * DAY)] });

    // Account status (F1275), net price (F1276) and minutes (F1277).
    const entitlement = (user, row) => db.query(
      `insert into public.entitlements(user_id,plan,seconds_used,period_start,period_end,allowance_window_end,withheld_seconds,lapsed_from_paid)
       values($1,$2,$3,$4,$5,$6,$7,$8)`,
      [user, row.plan, row.used ?? 0, row.start ?? null, row.end ?? null, row.window ?? null, row.withheld ?? 0, row.lapsed ?? false]);
    const iso = (ms) => new Date(ms).toISOString();
    // 11: paying, monthly Core, 90 of 300 minutes, mid-window with 3 days left in the window (20 in the period).
    await entitlement(id(11), { plan: 'starter', used: 5400, start: iso(now - 10 * DAY), end: iso(now + 20 * DAY), window: iso(now + 3 * DAY) });
    // 12: store trial on Max. 30000 s withheld, so the allowance is 100 minutes and 20 minutes are used.
    await entitlement(id(12), { plan: 'regular', used: 31200, withheld: 30000, start: iso(now - 2 * DAY), end: iso(now + 5 * DAY) });
    // 13: lapsed. 14: a paid period that ended and has not been lapsed yet. 15: free.
    await entitlement(id(13), { plan: 'trial', lapsed: true });
    await entitlement(id(14), { plan: 'starter', used: 100, start: iso(now - 31 * DAY), end: iso(now - DAY) });
    await entitlement(id(15), { plan: 'trial', used: 60 });
    // 16: paying, yearly Max in its last window (allowance_window_end null), 150 of 600 minutes, 25 days left.
    await entitlement(id(16), { plan: 'regular', used: 9000, start: iso(now - 340 * DAY), end: iso(now + 25 * DAY) });
    // 17: paying, monthly Max, nothing used, its window ended a day ago and the renewal sweep has not refilled it yet.
    await entitlement(id(17), { plan: 'regular', start: iso(now - 10 * DAY), end: iso(now + 20 * DAY), window: iso(now - DAY) });

    // Wall funnel (F1278). 21: a refused showing that buys, then a settings showing that leaves unchanged.
    const event = (user, name, properties, minute) => db.query('insert into public.product_events(user_id,name,properties,occurred_at) values($1,$2,$3,$4)',
      [user, name, JSON.stringify(properties), iso(now - DAY + minute * 60_000)]);
    await event(id(21), 'wall_shown', { entry: 'refused', pages: 4 }, 0);
    await event(id(21), 'wall_page_seen', { page: 'plans', index: 3 }, 1);
    await event(id(21), 'plan_selected', { plan: 'regular' }, 2);
    await event(id(21), 'purchase_started', { plan: 'regular' }, 3);
    await event(id(21), 'purchase_settled', { plan: 'regular', outcome: 'done' }, 4);
    await event(id(21), 'wall_left', { entry: 'refused', outcome: 'granted', destination: 'speak' }, 5);
    await event(id(21), 'wall_shown', { entry: 'settings', pages: 1 }, 10);
    await event(id(21), 'wall_left', { entry: 'settings', outcome: 'unchanged', destination: 'back' }, 11);
    // 22: a refused showing and nothing after.
    await event(id(22), 'wall_shown', { entry: 'refused', pages: 4 }, 20);
    // 23: a settings showing that saw only the yours page and cancelled a purchase: neither plans nor done.
    await event(id(23), 'wall_shown', { entry: 'settings', pages: 1 }, 30);
    await event(id(23), 'wall_page_seen', { page: 'yours', index: 0 }, 31);
    await event(id(23), 'purchase_settled', { plan: 'regular', outcome: 'cancelled' }, 32);
    // 24: a wall event that landed before its first wall_shown belongs to no showing, so no door is blank.
    await event(id(24), 'wall_page_seen', { page: 'plans', index: 3 }, 40);
    await event(id(24), 'wall_shown', { entry: 'settings', pages: 1 }, 41);

    const sql = await statements();
    const results = [];
    for (const statement of sql) results.push(await db.query(statement));
    return { db, sql, results };
  })();
  return shared;
}

const num = (v) => (v === null ? null : Number(v));

test('beta-metrics.sql: a learner with offline sittings on days 1 and 7 counts as retained by practice day', async () => {
  const { results } = await report();
  const rows = results[2].rows.map((r) => ({
    cohort: r.cohort, eligibleD1: num(r.eligible_d1), d1: num(r.d1_pct), eligibleD7: num(r.eligible_d7), d7: num(r.d7_pct),
    eligibleD30: num(r.eligible_d30), d30: num(r.d30_pct),
  }));
  // deadline: 4 (game sittings, back on days 1 and 7) and 6 (activeDays, back on day 30, so on or after 1 and 7 too).
  // hobby: 5 (back on day 1; the zero-XP day 8 entry does not count). 8 is malformed and has no day at all.
  // unknown: 7 first practised today, so it is in no denominator. 9's 2099 day is no return. 10's day 0 is exactly
  // 7 days ago, so it counts toward D1 and D7 but not D30.
  assert.deepEqual(rows, [
    { cohort: 'deadline', eligibleD1: 2, d1: 100, eligibleD7: 2, d7: 100, eligibleD30: 2, d30: 50 },
    { cohort: 'hobby', eligibleD1: 1, d1: 100, eligibleD7: 1, d7: 0, eligibleD30: 1, d30: 0 },
    { cohort: 'unknown', eligibleD1: 2, d1: 0, eligibleD7: 2, d7: 0, eligibleD30: 1, d30: 0 },
  ]);
  // The same columns as the billed query 2, which has no rows here because nobody has session_usage.
  assert.deepEqual(results[2].fields.map((f) => f.name), results[1].fields.map((f) => f.name));
  assert.equal(results[1].rows.length, 0);
});

test('beta-metrics.sql: the cohort follows the goal Settings wrote, and a cleared goal is unknown', async () => {
  const { db } = await report();
  const { rows } = await db.query('select user_id, cohort from beta_cohort where user_id = any($1) order by user_id', [[id(1), id(2), id(3)]]);
  assert.deepEqual(rows.map((r) => r.cohort), ['hobby', 'unknown', 'deadline']);
  const sql = await readFile(new URL('../deployment/beta-metrics.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql.split('\n').filter((line) => !line.trimStart().startsWith('--')).join('\n'), /\?(?![|&])/, 'no bare ? operator');
});

test('beta-metrics.sql: paying accounts are counted apart from store trials', async () => {
  const { results } = await report();
  // Seven accounts: 11, 16 and 17 paying, 12 in a store trial, 13 lapsed, 14 ended and not yet lapsed, 15 free.
  assert.deepEqual(results[7].rows.map((r) => ({ status: r.status, accounts: num(r.accounts), pct: num(r.pct) })), [
    { status: 'free', accounts: 1, pct: 14.3 },
    { status: 'lapsed', accounts: 1, pct: 14.3 },
    { status: 'paid period ended, not yet lapsed', accounts: 1, pct: 14.3 },
    { status: 'paying', accounts: 3, pct: 42.9 },
    { status: 'store trial', accounts: 1, pct: 14.3 },
  ]);
});

test("beta-metrics.sql: the net price estimate uses core's list prices and the Small Business rate", async () => {
  const { sql, results } = await report();
  const netGap = results[11].rows.find((r) => r.number === 'net average price (8)').gap;
  assert.match(netGap, new RegExp(`\\b${Math.round(STORE_FEE_RATES.smallBusiness * 100)} percent Small Business fee`));
  // The inline price list is core's, number for number.
  const prices = Object.fromEntries([...sql[8].matchAll(/\('(starter|regular)', '(month|year)', ([\d.]+)\)/g)].map((m) => [`${m[1]} ${m[2]}`, Number(m[3])]));
  assert.deepEqual(prices, {
    'starter month': PLANS.starter.priceUsd, 'starter year': YEARLY_PLANS.starter.priceUsd,
    'regular month': PLANS.regular.priceUsd, 'regular year': YEARLY_PLANS.regular.priceUsd,
  });
  assert.equal(Number(sql[8].match(/fee\(rate\) as \(values \(([\d.]+)\)/)[1]), STORE_FEE_RATES.smallBusiness);
  // Monthly Core: 14.99 * 0.85 = 12.7415. Yearly Max: 169 * 0.85 / 12 = 11.9708. Monthly Max: 24.99 * 0.85 = 21.2415.
  // Per payer over all three: (12.7415 + 11.9708 + 21.2415) / 3 = 15.3179.
  assert.deepEqual(results[8].rows.map((r) => ({ plan: r.plan, period: r.period, payers: num(r.payers), net: num(r.est_net_monthly_usd_per_payer) })), [
    { plan: 'regular', period: 'month', payers: 1, net: 21.24 },
    { plan: 'regular', period: 'year', payers: 1, net: 11.97 },
    { plan: 'starter', period: 'month', payers: 1, net: 12.74 },
    { plan: 'all payers', period: 'all', payers: 3, net: 15.32 },
  ]);
});

test('beta-metrics.sql: minutes used against the allowance leave out the withheld part, per plan and period', async () => {
  const { results } = await report();
  const rows = results[9].rows.map((r) => ({
    plan: r.plan, period: r.period, learners: num(r.learners), allowance: num(r.allowance_minutes), used: num(r.avg_used_minutes),
    avgPct: num(r.avg_used_pct), medianPct: num(r.median_used_pct), daysLeft: num(r.avg_days_left),
  }));
  // 12: (36000 - 30000) / 60 = 100 min allowed, (31200 - 30000) / 60 = 20 used. 16: 36000 / 60 = 600, 150 used, a year
  // although its window end is null. 11: 18000 / 60 = 300, 90 used, 3 days to its window end, not 20 to its period end.
  // 17: 600 allowed, none used, its window ended a day ago, so 0 days left, never negative. 14 has ended and is not in a window.
  assert.deepEqual(rows, [
    { plan: 'regular', period: 'month', learners: 1, allowance: 600, used: 0, avgPct: 0, medianPct: 0, daysLeft: 0 },
    { plan: 'regular', period: 'trial', learners: 1, allowance: 100, used: 20, avgPct: 20, medianPct: 20, daysLeft: 5 },
    { plan: 'regular', period: 'year', learners: 1, allowance: 600, used: 150, avgPct: 25, medianPct: 25, daysLeft: 25 },
    { plan: 'starter', period: 'month', learners: 1, allowance: 300, used: 90, avgPct: 30, medianPct: 30, daysLeft: 3 },
  ]);
});

test('beta-metrics.sql: the wall funnel is split by door, and a purchase stays with the door that showed it', async () => {
  const { results } = await report();
  assert.deepEqual(results[10].rows.map((r) => ({
    entry: r.entry, showings: num(r.showings), learners: num(r.learners), plans: num(r.reached_plans), selected: num(r.plan_selected),
    started: num(r.purchase_started), done: num(r.settled_done), granted: num(r.left_granted),
  })), [
    { entry: 'refused', showings: 2, learners: 2, plans: 1, selected: 1, started: 1, done: 1, granted: 1 },
    { entry: 'settings', showings: 3, learners: 3, plans: 0, selected: 0, started: 0, done: 0, granted: 0 },
  ]);
});

test('beta-metrics.sql: the report says which numbers it cannot measure and which cover consented learners only', async () => {
  const { db, results } = await report();
  const index = Object.fromEntries(results[11].rows.map((r) => [r.number, { status: r.status, basis: r.basis, gap: r.gap }]));
  assert.deepEqual(Object.fromEntries(Object.entries(index).map(([k, v]) => [k, [v.status, v.basis]])), {
    'practice-day retention (2b)': ['measured', 'all synced learners'],
    'paid conversion (7)': ['snapshot', 'all accounts, billing tables'],
    'net average price (8)': ['estimate', 'all accounts, billing tables'],
    'month-one renewal by start week': ['not measurable', 'all accounts, billing tables'],
    'minutes used against the allowance (9)': ['snapshot', 'all accounts, billing tables'],
    'wall funnel by door (10)': ['measured', 'consented learners only'],
  });
  assert.match(index['month-one renewal by start week'].gap, /event_type/);
  assert.match(index['paid conversion (7)'].gap, /trial/);
  // Read-only: nothing here changed a table.
  const count = async (table) => Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);
  assert.deepEqual([await count('learner_state'), await count('entitlements'), await count('product_events')], [15, 7, 14]);
});
