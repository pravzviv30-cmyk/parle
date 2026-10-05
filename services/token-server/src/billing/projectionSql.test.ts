/**
 * The F733 projection, run in a disposable PostgreSQL/WASM database replayed
 * from every migration in order. No hosted project, no network, no learner
 * data. One connection, so this proves SQL behaviour and privileges, not
 * concurrency between independent sessions.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import { PLANS, storeTrialSeconds } from '@luvani/core';

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');
const ROLLBACK = path.join(ROOT, 'supabase', 'rollback', '20261005231742_down.sql');
const FORWARD = '20261005231742_store_trial_yearly_allowance.sql';

type Db = { exec(sql: string): Promise<unknown>; query<T = Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }>; close(): Promise<void> };
type Row = { plan: string; seconds_used: number; period_end: string | null; allowance_window_end: string | null; lapsed_from_paid: boolean; usage_epoch: string };
const user = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('the store trial and yearly projection in SQL (F733)', () => {
  let db: Db;
  const DAY = 24 * 60 * 60 * 1000;
  const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();
  const second = (iso: string | null) => (iso === null ? null : Math.floor(Date.parse(iso) / 1000) * 1000);

  before(async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    db = new PGlite() as unknown as Db;
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role auth_deleter;
      create schema auth; create table auth.users(id uuid primary key, banned_until timestamptz, deleted_at timestamptz);
      create table auth.sessions(id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, not_after timestamptz);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public, auth to anon, authenticated, service_role, auth_deleter;
      grant select, delete on auth.users to auth_deleter;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;`);
    const files = readdirSync(MIGRATIONS).filter(file => file.endsWith('.sql')).sort();
    assert.ok(files.includes(FORWARD), 'the F733 migration is missing');
    for (const file of files) await db.exec(readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    for (let n = 1; n <= 12; n += 1) await db.query('insert into auth.users(id) values($1)', [user(n)]);
  });
  after(async () => { await db?.close(); });

  const ticket = async (id: string) => Number((await db.query<{ t: string }>('select public.begin_billing_refresh($1) as t', [id])).rows[0]!.t);
  const apply = async (id: string, kind: string, plan: string | null, end: string | null, grant: number | null, window: string | null = null) =>
    (await db.query<{ r: { kind: string; reason: string | null; entitlement: Row } }>(
      'select public.apply_billing_projection_v2($1,$2,$3,$4,$5,null,$6,$7) as r', [id, await ticket(id), kind, plan, end, grant, window])).rows[0]!.r;
  const row = async (id: string) => (await db.query<Row>('select * from public.entitlements where user_id = $1', [id])).rows[0]!;
  /** The zero-second debit every server read is: it lapses an expired paid period and changes nothing else. */
  const read = async (id: string) => (await db.query<Row>('select * from public.consume_entitlement($1, 0, null)', [id])).rows[0]!;
  const remaining = (r: { plan: string; seconds_used: number }) => PLANS[r.plan as keyof typeof PLANS].secondsPerPeriod - r.seconds_used;

  test('the database grants a store trial its week and never more, then the paid month in full', async () => {
    const id = user(1);
    const trialEnd = inDays(7);
    const started = await apply(id, 'active', 'starter', trialEnd, storeTrialSeconds('starter'));
    assert.equal(started.kind, 'active');
    assert.equal(remaining(started.entitlement), 42 * 60, 'the trial was granted something other than a week of Starter');
    assert.equal(started.entitlement.allowance_window_end, null, 'a trial is one window ending with the trial');
    // Spent most of it; the same trial read again keeps what was spent.
    await db.query('update public.entitlements set seconds_used = seconds_used + 2000 where user_id = $1', [id]);
    const repeat = await apply(id, 'active', 'starter', trialEnd, storeTrialSeconds('starter'));
    assert.equal(remaining(repeat.entitlement), 42 * 60 - 2000, 'a repeat read of the trial handed time back');
    // The trial converts into a paid month: the whole allowance, from zero.
    const paid = await apply(id, 'active', 'starter', inDays(37), PLANS.starter.secondsPerPeriod);
    assert.equal(paid.entitlement.seconds_used, 0);
    // Max's trial is seventy minutes.
    const max = await apply(user(2), 'active', 'regular', trialEnd, storeTrialSeconds('regular'));
    assert.equal(remaining(max.entitlement), 70 * 60);
  });

  test('the database refills a yearly window only when a later window is projected', async () => {
    // F733 review (2026-10-05): the paid year is the period, the window sits beside it.
    // Each instant is computed once: two calls a second apart are two windows.
    const id = user(3);
    const year = inDays(365);
    const one = inDays(30);
    const two = inDays(60);
    const first = await apply(id, 'active', 'regular', year, PLANS.regular.secondsPerPeriod, one);
    assert.equal(first.entitlement.seconds_used, 0);
    assert.equal(second(first.entitlement.period_end), second(year), 'the window was recorded as the period a read lapses from');
    assert.equal(second(first.entitlement.allowance_window_end), second(one));
    await db.query('update public.entitlements set seconds_used = 17000 where user_id = $1', [id]);
    assert.equal((await apply(id, 'active', 'regular', year, PLANS.regular.secondsPerPeriod, one)).entitlement.seconds_used, 17000);
    const next = await apply(id, 'active', 'regular', year, PLANS.regular.secondsPerPeriod, two);
    assert.equal(next.entitlement.seconds_used, 0, 'the next window did not refill');
    const stale = await apply(id, 'active', 'regular', year, PLANS.regular.secondsPerPeriod, one);
    assert.equal(stale.reason, 'superseded', 'an older window read later moved the row back');
  });

  test('a yearly learner whose window ended a day ago is not lapsed by a read, and the next projection grants window two', async () => {
    const id = user(9);
    const year = inDays(335);
    await apply(id, 'active', 'regular', year, PLANS.regular.secondsPerPeriod, inDays(1));
    // Window one spent to the second and ended twenty-five hours ago, and no
    // renewal sweep has run since. Every read is a zero-second debit.
    await db.query("update public.entitlements set seconds_used = 18000, allowance_window_end = now() - interval '25 hours' where user_id = $1", [id]);
    const held = await read(id);
    assert.equal(held.plan, 'regular', 'a read lapsed a paying yearly learner whose window was not refilled in time');
    assert.equal(held.lapsed_from_paid, false);
    assert.equal(second(held.period_end), second(year), 'a read moved the paid year');
    assert.equal(remaining(held), 0, 'a read refilled minutes no vendor read granted');
    // The sweep, or the learner restoring, reads the vendor: window two, in full.
    const two = inDays(29);
    const refilled = await apply(id, 'active', 'regular', year, PLANS.regular.secondsPerPeriod, two);
    assert.equal(refilled.kind, 'active');
    assert.equal(refilled.entitlement.seconds_used, 0, 'window two did not refill');
    assert.equal(second(refilled.entitlement.allowance_window_end), second(two));
  });

  test('a vendor answer that has already ended on this clock lapses nothing, and only an inactive one does', async () => {
    const id = user(10);
    await apply(id, 'active', 'regular', inDays(30), PLANS.regular.secondsPerPeriod);
    // A refresh read just before a boundary that lands just after it.
    const late = await apply(id, 'active', 'regular', new Date(Date.now() - 1000).toISOString(), PLANS.regular.secondsPerPeriod);
    assert.equal(late.kind, 'unchanged');
    assert.equal(late.reason, 'superseded');
    assert.equal((await row(id)).plan, 'regular', 'an answer the clock overtook took the plan away');
    const lateWindow = await apply(id, 'active', 'regular', inDays(300), PLANS.regular.secondsPerPeriod, new Date(Date.now() - 1000).toISOString());
    assert.equal(lateWindow.reason, 'superseded');
    const gone = await apply(id, 'inactive', null, null, null);
    assert.equal(gone.kind, 'lapsed');
    assert.equal(gone.entitlement.allowance_window_end, null);
  });

  test('a paid year lapses a day after it ends, and its window goes with it', async () => {
    const id = user(11);
    await apply(id, 'active', 'starter', inDays(200), PLANS.starter.secondsPerPeriod, inDays(10));
    await db.query("update public.entitlements set period_end = now() - interval '25 hours', allowance_window_end = now() - interval '26 hours' where user_id = $1", [id]);
    const ended = await read(id);
    assert.equal(ended.plan, 'trial');
    assert.equal(ended.lapsed_from_paid, true);
    assert.equal(ended.allowance_window_end, null, 'a lapsed row kept a window, and the window check would refuse the lapse');
    // The window never outlives its period, whoever writes the row.
    await assert.rejects(db.query("update public.entitlements set plan = 'starter', period_end = now() + interval '5 days', allowance_window_end = now() + interval '9 days' where user_id = $1", [id]), /entitlements_allowance_window_inside_period/);
  });

  test('a new window is a new usage period, and the same window is not', async () => {
    const id = user(12);
    const year = inDays(300);
    const window = inDays(5);
    await apply(id, 'active', 'regular', year, PLANS.regular.secondsPerPeriod, window);
    const first = (await row(id)).usage_epoch;
    await apply(id, 'active', 'regular', year, PLANS.regular.secondsPerPeriod, window);
    assert.equal((await row(id)).usage_epoch, first, 'reading the same window again started a new usage period');
    await apply(id, 'active', 'regular', year, PLANS.regular.secondsPerPeriod, inDays(35));
    const refilled = (await row(id)).usage_epoch;
    assert.notEqual(refilled, first, 'a session from the last window could be refunded into the next');
    // The trigger runs for the service role's own writes too, which hold no grant on it.
    await db.exec('set role service_role');
    try { await db.query("update public.entitlements set allowance_window_end = now() + interval '40 days' where user_id = $1", [id]); }
    finally { await db.exec('reset role'); }
    assert.notEqual((await row(id)).usage_epoch, refilled, 'a service-role window write kept the old usage period');
  });

  test('the database refuses a grant that is not whole seconds inside the plan allowance', async () => {
    const id = user(4);
    for (const [kind, plan, grant] of [
      ['active', 'starter', 0], ['active', 'starter', PLANS.starter.secondsPerPeriod + 1], ['active', 'regular', null], ['inactive', null, 60],
    ] as const) {
      await assert.rejects(apply(id, kind, plan, kind === 'active' ? inDays(30) : null, grant), /allowance/);
    }
    // A window outside its paid period, or on a state that grants nothing, is refused too.
    await assert.rejects(apply(id, 'active', 'starter', inDays(30), PLANS.starter.secondsPerPeriod, inDays(31)), /allowance window/);
    await assert.rejects(apply(id, 'inactive', null, null, null, inDays(3)), /grants an allowance/);
    // The original six-argument projection still answers servers not yet redeployed.
    const legacy = (await db.query<{ r: { kind: string; entitlement: { seconds_used: number } } }>(
      "select public.apply_billing_projection($1,$2,'active','starter',$3,null) as r", [id, await ticket(id), inDays(30)])).rows[0]!.r;
    assert.equal(legacy.kind, 'active');
    assert.equal((await db.query<{ v: number }>('select public.billing_projection_version() as v')).rows[0]!.v, 2);
  });

  test('the renewal sweep reads ended paid periods only, newest first, and nothing else', async () => {
    await db.query("insert into public.entitlements(user_id, plan, seconds_used, period_end) values($1, 'starter', 0, $2)", [user(5), inDays(-2)]);
    // A yearly window that ended a few minutes ago, inside a paid year that has not.
    const windowEnded = inDays(-0.01);
    await db.query('update public.entitlements set allowance_window_end = $2 where user_id = $1', [user(3), windowEnded]);
    await db.query("insert into public.entitlements(user_id, plan, seconds_used) values($1, 'trial', 0) on conflict (user_id) do nothing", [user(6)]);
    const due = (await db.query<{ r: { renewals: { userId: string; periodEnd: string }[] } }>('select public.billing_renewals_due_v1(10) as r')).rows[0]!.r;
    const ids = due.renewals.map(r => r.userId);
    assert.deepEqual(ids.slice(0, 2), [user(3), user(5)], 'the most recently ended window or period is not first');
    assert.equal(second(due.renewals[0]!.periodEnd), second(windowEnded), 'a yearly row is due at its window, not its year');
    for (const id of [user(1), user(2), user(4), user(6), user(12)]) assert.ok(!ids.includes(id), `${id} is not due and was listed`);
    assert.deepEqual((await db.query<{ r: { renewals: unknown[] } }>('select public.billing_renewals_due_v1(-5) as r')).rows[0]!.r.renewals, []);
  });

  test('only the service role may project, read the due list or ask the version', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        for (const sql of [
          'select public.billing_renewals_due_v1(1)',
          'select public.billing_projection_version()',
          `select public.apply_billing_projection_v2('${user(7)}', 1, 'inactive', null, null, null, null, null)`,
        ]) await assert.rejects(db.exec(sql), /permission denied/, `${role} ran ${sql}`);
      } finally { await db.exec('reset role'); }
    }
  });

  test('the rollback refuses without its interlock and restores version one with it', async () => {
    const down = readFileSync(ROLLBACK, 'utf8');
    await assert.rejects(db.exec(down), /explicit interlock/);
    await db.exec("select set_config('luvani.reopen_trial_allowance', 'yes', false)");
    await db.exec(down);
    assert.equal((await db.query<{ v: number }>('select public.billing_projection_version() as v')).rows[0]!.v, 1);
    assert.equal((await db.query("select 1 from pg_proc where proname in ('apply_billing_projection_v2', 'billing_renewals_due_v1', 'allowance_window_epoch_v1')")).rows.length, 0);
    assert.equal((await db.query("select 1 from information_schema.columns where table_name = 'entitlements' and column_name = 'allowance_window_end'")).rows.length, 0);
    // A read still works on the rolled-back schema, and a yearly row keeps its paid year.
    assert.equal((await read(user(3))).plan, 'regular');
    // And the forward migration applies again on top of the rollback.
    await db.exec(readFileSync(path.join(MIGRATIONS, FORWARD), 'utf8'));
    assert.equal((await db.query<{ v: number }>('select public.billing_projection_version() as v')).rows[0]!.v, 2);
  });
});
