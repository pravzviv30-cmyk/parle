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
const user = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('the store trial and yearly projection in SQL (F733)', () => {
  let db: Db;
  const DAY = 24 * 60 * 60 * 1000;
  const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

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
    for (let n = 1; n <= 8; n += 1) await db.query('insert into auth.users(id) values($1)', [user(n)]);
  });
  after(async () => { await db?.close(); });

  const ticket = async (id: string) => Number((await db.query<{ t: string }>('select public.begin_billing_refresh($1) as t', [id])).rows[0]!.t);
  const apply = async (id: string, kind: string, plan: string | null, end: string | null, grant: number | null) =>
    (await db.query<{ r: { kind: string; reason: string | null; entitlement: { plan: string; seconds_used: number; period_end: string | null } } }>(
      'select public.apply_billing_projection_v2($1,$2,$3,$4,$5,null,$6) as r', [id, await ticket(id), kind, plan, end, grant])).rows[0]!.r;
  const remaining = (row: { plan: string; seconds_used: number }) => PLANS[row.plan as keyof typeof PLANS].secondsPerPeriod - row.seconds_used;

  test('the database grants a store trial its week and never more, then the paid month in full', async () => {
    const id = user(1);
    const trialEnd = inDays(7);
    const started = await apply(id, 'active', 'starter', trialEnd, storeTrialSeconds('starter'));
    assert.equal(started.kind, 'active');
    assert.equal(remaining(started.entitlement), 42 * 60, 'the trial was granted something other than a week of Starter');
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
    const id = user(3);
    const first = await apply(id, 'active', 'regular', inDays(30), PLANS.regular.secondsPerPeriod);
    assert.equal(first.entitlement.seconds_used, 0);
    await db.query('update public.entitlements set seconds_used = 17000 where user_id = $1', [id]);
    assert.equal((await apply(id, 'active', 'regular', inDays(30), PLANS.regular.secondsPerPeriod)).entitlement.seconds_used, 17000);
    const next = await apply(id, 'active', 'regular', inDays(60), PLANS.regular.secondsPerPeriod);
    assert.equal(next.entitlement.seconds_used, 0, 'the next window did not refill');
    const stale = await apply(id, 'active', 'regular', inDays(30), PLANS.regular.secondsPerPeriod);
    assert.equal(stale.reason, 'superseded', 'an older window read later moved the row back');
  });

  test('the database refuses a grant that is not whole seconds inside the plan allowance', async () => {
    const id = user(4);
    for (const [kind, plan, grant] of [
      ['active', 'starter', 0], ['active', 'starter', PLANS.starter.secondsPerPeriod + 1], ['active', 'regular', null], ['inactive', null, 60],
    ] as const) {
      await assert.rejects(apply(id, kind, plan, kind === 'active' ? inDays(30) : null, grant), /allowance/);
    }
    // The original six-argument projection still answers servers not yet redeployed.
    const legacy = (await db.query<{ r: { kind: string; entitlement: { seconds_used: number } } }>(
      "select public.apply_billing_projection($1,$2,'active','starter',$3,null) as r", [id, await ticket(id), inDays(30)])).rows[0]!.r;
    assert.equal(legacy.kind, 'active');
    assert.equal((await db.query<{ v: number }>('select public.billing_projection_version() as v')).rows[0]!.v, 2);
  });

  test('the renewal sweep reads ended paid periods only, newest first, and nothing else', async () => {
    await db.query("insert into public.entitlements(user_id, plan, seconds_used, period_end) values($1, 'starter', 0, $2)", [user(5), inDays(-2)]);
    await db.query("update public.entitlements set plan = 'regular', seconds_used = 0, period_end = $2 where user_id = $1", [user(3), inDays(-0.01)]);
    await db.query("insert into public.entitlements(user_id, plan, seconds_used) values($1, 'trial', 0) on conflict (user_id) do nothing", [user(6)]);
    const due = (await db.query<{ r: { renewals: { userId: string; periodEnd: string }[] } }>('select public.billing_renewals_due_v1(10) as r')).rows[0]!.r;
    const ids = due.renewals.map(row => row.userId);
    assert.deepEqual(ids.slice(0, 2), [user(3), user(5)], 'the most recently ended period is not first');
    for (const id of [user(1), user(2), user(4), user(6)]) assert.ok(!ids.includes(id), `${id} is not due and was listed`);
    assert.deepEqual((await db.query<{ r: { renewals: unknown[] } }>('select public.billing_renewals_due_v1(-5) as r')).rows[0]!.r.renewals, []);
  });

  test('only the service role may project, read the due list or ask the version', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        for (const sql of [
          'select public.billing_renewals_due_v1(1)',
          'select public.billing_projection_version()',
          `select public.apply_billing_projection_v2('${user(7)}', 1, 'inactive', null, null, null, null)`,
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
    assert.equal((await db.query("select 1 from pg_proc where proname in ('apply_billing_projection_v2', 'billing_renewals_due_v1')")).rows.length, 0);
    // And the forward migration applies again on top of the rollback.
    await db.exec(readFileSync(path.join(MIGRATIONS, FORWARD), 'utf8'));
    assert.equal((await db.query<{ v: number }>('select public.billing_projection_version() as v')).rows[0]!.v, 2);
  });
});
