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

import { PLANS, storeTrialSeconds, buildConversationPack } from '@luvani/core';

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');
const ROLLBACK = path.join(ROOT, 'supabase', 'rollback', '20261005231742_down.sql');
const FORWARD = '20261005231742_store_trial_yearly_allowance.sql';

type Db = { exec(sql: string): Promise<unknown>; query<T = Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }>; close(): Promise<void> };
type Row = { plan: string; seconds_used: number; period_end: string | null; allowance_window_end: string | null; lapsed_from_paid: boolean; usage_epoch: string;
  period_start: string | null; withheld_seconds: number };
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
    for (let n = 1; n <= 30; n += 1) await db.query('insert into auth.users(id) values($1)', [user(n)]);
  });
  after(async () => { await db?.close(); });

  const ticket = async (id: string) => Number((await db.query<{ t: string }>('select public.begin_billing_refresh($1) as t', [id])).rows[0]!.t);
  // F733 second review (2026-10-06): the vendor's purchase date rides with every
  // active answer, so a store answer is ordered by when its period started.
  const apply = async (id: string, kind: string, plan: string | null, end: string | null, grant: number | null, window: string | null = null, start: string | null = null) =>
    (await db.query<{ r: { kind: string; reason: string | null; entitlement: Row } }>(
      'select public.apply_billing_projection_v2($1,$2,$3,$4,$5,null,$6,$7,$8) as r', [id, await ticket(id), kind, plan, end, grant, window, start])).rows[0]!.r;
  const row = async (id: string) => (await db.query<Row>('select * from public.entitlements where user_id = $1', [id])).rows[0]!;
  /** The zero-second debit every server read is: it lapses an expired paid period and changes nothing else. */
  const read = async (id: string) => (await db.query<Row>('select * from public.consume_entitlement($1, 0, null)', [id])).rows[0]!;
  const remaining = (r: { plan: string; seconds_used: number }) => PLANS[r.plan as keyof typeof PLANS].secondsPerPeriod - r.seconds_used;

  test('the database grants a store trial its week and never more, then the paid month in full', async () => {
    const id = user(1);
    const trialEnd = inDays(7);
    const started = await apply(id, 'active', 'starter', trialEnd, storeTrialSeconds('starter'));
    assert.equal(started.kind, 'active');
    assert.equal(remaining(started.entitlement), 70 * 60, 'the trial was granted something other than a week of Core');
    assert.equal(started.entitlement.allowance_window_end, null, 'a trial is one window ending with the trial');
    // Spent most of it; the same trial read again keeps what was spent.
    await db.query('update public.entitlements set seconds_used = seconds_used + 2000 where user_id = $1', [id]);
    const repeat = await apply(id, 'active', 'starter', trialEnd, storeTrialSeconds('starter'));
    assert.equal(remaining(repeat.entitlement), 70 * 60 - 2000, 'a repeat read of the trial handed time back');
    // The trial converts into a paid month: the whole allowance, from zero.
    const paid = await apply(id, 'active', 'starter', inDays(37), PLANS.starter.secondsPerPeriod);
    assert.equal(paid.entitlement.seconds_used, 0);
    // Max's trial is a hundred and forty minutes (REV-001).
    const max = await apply(user(2), 'active', 'regular', trialEnd, storeTrialSeconds('regular'));
    assert.equal(remaining(max.entitlement), 140 * 60);
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
    await db.query("update public.entitlements set seconds_used = 36000, allowance_window_end = now() - interval '25 hours' where user_id = $1", [id]);
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
          `select public.apply_billing_projection_v2('${user(7)}', 1, 'inactive', null, null, null, null, null, null)`,
        ]) await assert.rejects(db.exec(sql), /permission denied/, `${role} ran ${sql}`);
      } finally { await db.exec('reset role'); }
    }
  });

  // F733 second review (2026-10-06). Apple applies an upgrade at once, whatever
  // its length, and refunds the rest of the old plan, so Starter yearly to Max
  // monthly arrives with an end a year earlier than the one on record. Ordering
  // answers by end alone called that a stale read and kept the learner on
  // Starter, with no refill, for up to eleven months. Answers are ordered by
  // when their period started first.
  const CAP = { starter: PLANS.starter.secondsPerPeriod, regular: PLANS.regular.secondsPerPeriod };

  test('a Starter yearly learner who upgrades to Max monthly is granted Max at once', async () => {
    const id = user(13);
    const bought = inDays(-45);
    await apply(id, 'active', 'starter', inDays(320), CAP.starter, inDays(15), bought);
    await db.query('update public.entitlements set seconds_used = 10200 where user_id = $1', [id]);
    const month = inDays(30);
    const max = await apply(id, 'active', 'regular', month, CAP.regular, null, inDays(-0.001));
    assert.equal(max.kind, 'active', `the upgrade was answered ${max.kind} ${max.reason}`);
    assert.equal(max.entitlement.plan, 'regular');
    assert.equal(max.entitlement.seconds_used, 0, 'the upgrade did not grant the Max month');
    assert.equal(second(max.entitlement.period_end), second(month));
    assert.equal(max.entitlement.allowance_window_end, null, 'a monthly plan kept the old year\'s window');
    assert.equal(max.entitlement.lapsed_from_paid, false);
    assert.equal((await read(id)).plan, 'regular', 'a read took the upgrade away');
  });

  test('a stale read of the old year after that upgrade moves nothing', async () => {
    const id = user(14);
    const bought = inDays(-45);
    const year = inDays(320);
    await apply(id, 'active', 'starter', year, CAP.starter, inDays(15), bought);
    const month = inDays(30);
    await apply(id, 'active', 'regular', month, CAP.regular, null, inDays(-0.001));
    await db.query('update public.entitlements set seconds_used = 600 where user_id = $1', [id]);
    const stale = await apply(id, 'active', 'starter', year, CAP.starter, inDays(15), bought);
    assert.equal(stale.kind, 'unchanged');
    assert.equal(stale.reason, 'superseded');
    const held = await row(id);
    assert.equal(held.plan, 'regular', 'a late read of the refunded year moved the learner back to Starter');
    assert.equal(held.seconds_used, 600, 'a late read of the refunded year refilled minutes');
    assert.equal(second(held.period_end), second(month));
    // Max renews: a later start is a new period, whatever its end.
    const renewed = await apply(id, 'active', 'regular', inDays(60), CAP.regular, null, month);
    assert.equal(renewed.kind, 'active');
    assert.equal(renewed.entitlement.seconds_used, 0, 'the next Max month did not refill');
  });

  test('a period read first as a trial and then as paid at the same end gives the payer the whole allowance', async () => {
    // F733 second review: the withheld part of a window is stored beside it, so
    // a later, fuller answer for the same window can hand it back.
    const id = user(15);
    const start = inDays(-1);
    const end = inDays(29);
    const trial = await apply(id, 'active', 'regular', end, storeTrialSeconds('regular'), null, start);
    assert.equal(trial.entitlement.withheld_seconds, CAP.regular - storeTrialSeconds('regular'));
    await db.query('update public.entitlements set seconds_used = seconds_used + 1000 where user_id = $1', [id]);
    const paid = await apply(id, 'active', 'regular', end, CAP.regular, null, start);
    assert.equal(paid.kind, 'active');
    assert.equal(remaining(paid.entitlement), CAP.regular - 1000, 'the payer stayed short by the trial\'s withheld minutes');
    assert.equal(paid.entitlement.withheld_seconds, 0);
    // A lagging read of the trial again takes the week back down, keeping what was spent.
    const lag = await apply(id, 'active', 'regular', end, storeTrialSeconds('regular'), null, start);
    assert.equal(remaining(lag.entitlement), storeTrialSeconds('regular') - 1000);
    // And without a start on either side, the same window still keeps only what was spent.
    const bare = user(16);
    await apply(bare, 'active', 'starter', end, storeTrialSeconds('starter'));
    await db.query('update public.entitlements set seconds_used = seconds_used + 300 where user_id = $1', [bare]);
    assert.equal(remaining((await apply(bare, 'active', 'starter', end, CAP.starter)).entitlement), CAP.starter - 300);
  });

  test('a later period start at the same end is a new period and a new usage period', async () => {
    const id = user(24);
    const end = inDays(30);
    await apply(id, 'active', 'starter', end, CAP.starter, null, inDays(-2));
    await db.query('update public.entitlements set seconds_used = 4000 where user_id = $1', [id]);
    const before = (await row(id)).usage_epoch;
    const next = await apply(id, 'active', 'starter', end, CAP.starter, null, inDays(-1));
    assert.equal(next.entitlement.seconds_used, 0, 'a period that started later was read as the same one');
    assert.notEqual(next.entitlement.usage_epoch, before, 'a session from the old period could be refunded into the new one');
  });

  test('a store extension of a paid year keeps its window and refills nothing', async () => {
    const id = user(17);
    const bought = inDays(-10);
    const window = inDays(20);
    await apply(id, 'active', 'regular', inDays(355), CAP.regular, window, bought);
    await db.query('update public.entitlements set seconds_used = 9000 where user_id = $1', [id]);
    const extended = await apply(id, 'active', 'regular', inDays(360), CAP.regular, window, bought);
    assert.equal(extended.kind, 'active');
    assert.equal(second(extended.entitlement.allowance_window_end), second(window), 'the projection\'s own write lost the window');
    assert.equal(second(extended.entitlement.period_start), second(bought));
    assert.equal(extended.entitlement.seconds_used, 9000, 'a longer year with the same start refilled the window');
  });

  test('a store extension of a paid year keeps the in-flight session charged', async () => {
    const id = user(29), session = user(129);
    const bought = inDays(-10), window = inDays(20);
    const first = await apply(id, 'active', 'regular', inDays(355), CAP.regular, window, bought);
    assert.equal((await db.query<{ ok: boolean }>('select public.record_session_grant($1,$2,$3,$4,$5) as ok',
      [id, session, first.entitlement.plan, first.entitlement.seconds_used, first.entitlement.period_end])).rows[0]!.ok, true);
    const extended = await apply(id, 'active', 'regular', inDays(360), CAP.regular, window, bought);
    assert.equal(extended.entitlement.usage_epoch, first.entitlement.usage_epoch);
    await db.query('select public.consume_entitlement($1,120,$2)', [id, session]);
    assert.equal((await row(id)).seconds_used, 120);
    assert.equal((await db.query<{ charged_seconds: number }>('select charged_seconds from public.session_usage where session_id=$1', [session])).rows[0]!.charged_seconds, 120);
    const renewed = await apply(id, 'active', 'regular', inDays(360), CAP.regular, inDays(50), bought);
    assert.notEqual(renewed.entitlement.usage_epoch, first.entitlement.usage_epoch, 'the next monthly window must still fence old sessions');
  });

  test('a store trial gets the phrase-audio budget the founder chose', async () => {
    const id = user(30), session = user(130), hash = 'b'.repeat(64);
    const end = inDays(7), start = inDays(-1);
    await apply(id, 'active', 'starter', end, storeTrialSeconds('starter'), null, start);
    const pack = buildConversationPack({ id: session, sessionId: session, learnerId: id,
      createdAt: new Date().toISOString(), title: { fr: 'Au café', en: 'At the café' }, summary: 'An order.',
      keyPhrases: [{ fr: 'Bonjour', frWritten: null, en: 'Hello' }], corrections: [] });
    await db.query("insert into public.conversation_packs(id,session_id,user_id,state,payload) values($1,$1,$2,'ready',$3)", [session, id, JSON.stringify(pack)]);
    await db.query('insert into public.session_usage(session_id,user_id,seconds) values($1,$2,1)', [session, id]);
    await db.exec('update public.phrase_audio_policy set enabled=true,trial_cap_micro_usd=20000,paid_cap_micro_usd=200000,global_cap_micro_usd=1000000');
    await db.query("insert into public.phrase_audio_rates(voice,fingerprint,micro_usd_per_utf8_byte,fixed_call_micro_usd,verified_at,expires_at) values('alexandre',$1,1,1,now(),now()+interval '1 day')", [hash]);
    type Quote = { bucket: string; rateRevision: string; globalWindowStart: string; paidWindowStart: string | null };
    const reserveAudio = async () => (await db.query<{ q: Quote | null }>("select public.reserve_phrase_audio($1,$2,'phrase',0,'alexandre',$3) as q", [id, session, hash])).rows[0]!.q;
    const trial = await reserveAudio();
    assert.equal(trial?.bucket, 'trial');
    const dispatch = async (q: Quote) => (await db.query<{ ok: boolean }>("select public.phrase_audio_dispatch_allowed($1,$2,'phrase',0,'alexandre',$3,$4,'Bonjour',$5,$6,$7) as ok", [id,session,hash,q.rateRevision,q.bucket,q.globalWindowStart,q.paidWindowStart])).rows[0]!.ok;
    assert.equal(await dispatch(trial!), true);
    await db.query('update public.phrase_audio_budgets set trial_spent_micro_usd=20000 where user_id=$1', [id]);
    assert.equal(await reserveAudio(), null, 'a store trial must not borrow from the paid budget');
    await apply(id, 'active', 'starter', end, CAP.starter, null, start);
    assert.equal(await dispatch(trial!), false, 'conversion invalidates a trial dispatch');
    const paid = await reserveAudio();
    assert.equal(paid?.bucket, 'paid');
    assert.equal(await dispatch(paid!), true);
    assert.equal(Number((await db.query<{ spent: string }>('select trial_spent_micro_usd as spent from public.phrase_audio_budgets where user_id=$1', [id])).rows[0]!.spent), 20000, 'conversion must not reset lifetime trial spend');
    await db.exec('update public.phrase_audio_policy set enabled=false');
  });

  test('a writer that knows nothing of windows moves the period, and the window goes with it', async () => {
    // F733 second review: a server not yet redeployed still calls the
    // six-argument projection, which never writes allowance_window_end.
    const id = user(18);
    await apply(id, 'active', 'regular', inDays(300), CAP.regular, inDays(10), inDays(-20));
    const legacy = (await db.query<{ r: { kind: string; entitlement: Row } }>(
      "select public.apply_billing_projection($1,$2,'active','regular',$3,null) as r", [id, await ticket(id), inDays(400)])).rows[0]!.r;
    assert.equal(legacy.kind, 'active');
    assert.equal(legacy.entitlement.allowance_window_end, null, 'a new period kept the old period\'s window');
    assert.equal(legacy.entitlement.period_start, null, 'a new period kept the old period\'s start');
    assert.equal(legacy.entitlement.withheld_seconds, 0);
    // A direct service write to an end before the old window is not refused by the window check.
    const direct = user(19);
    await apply(direct, 'active', 'starter', inDays(300), CAP.starter, inDays(10), inDays(-20));
    await db.query("update public.entitlements set period_end = now() + interval '5 days' where user_id = $1", [direct]);
    assert.equal((await row(direct)).allowance_window_end, null);
  });

  test('the v2 projection keeps the six-argument fences: replays, older tickets and unissued tickets', async () => {
    // Ported from scripts/verifyBillingProjection.mjs, which exercises the
    // six-argument function only and is not run by the gate.
    const id = user(20);
    const end = inDays(30);
    // One purchase, so one start: a store keeps purchase_date fixed for a period. A start
    // computed per call would cross a second boundary under load and read as a new period.
    const start = inDays(-1);
    const event = async (ticketNo: number, kind: string, plan: string | null, at: string | null, eventId: string, grant: number | null) =>
      (await db.query<{ r: { kind: string; reason: string | null; entitlement: Row } }>(
        'select public.apply_billing_projection_v2($1,$2,$3,$4,$5,$6,$7,null,$8) as r',
        [id, ticketNo, kind, plan, at, eventId, grant, kind === 'active' ? start : null])).rows[0]!.r;
    const first = await event(await ticket(id), 'active', 'regular', end, 'v2-first', CAP.regular);
    assert.equal(first.kind, 'active');
    await db.query('update public.entitlements set seconds_used = 600 where user_id = $1', [id]);
    // A replayed event id applies nothing a second time, even with a fresh ticket.
    const replay = await event(await ticket(id), 'active', 'starter', end, 'v2-first', CAP.starter);
    assert.equal(replay.reason, 'superseded');
    assert.equal((await row(id)).plan, 'regular', 'a replayed event applied a second effect');
    // An older ticket answered after a newer one moves nothing, even when it says "nothing held".
    const older = await ticket(id);
    const newer = await ticket(id);
    assert.equal((await event(newer, 'active', 'regular', end, 'v2-newer', CAP.regular)).kind, 'active');
    const delayed = await event(older, 'inactive', null, null, 'v2-older', null);
    assert.equal(delayed.reason, 'superseded');
    assert.equal(delayed.entitlement.plan, 'regular', 'a delayed older answer lapsed a newer projection');
    assert.equal(delayed.entitlement.seconds_used, 600);
    // A ticket the database never issued is refused, and leaves no event behind.
    const issued = await ticket(id);
    await assert.rejects(event(issued + 100, 'active', 'regular', end, 'v2-unissued', CAP.regular), /unissued/);
    assert.equal((await db.query("select 1 from public.billing_events where event_id = 'v2-unissued'")).rows.length, 0);
  });

  test('the v2 projection moves nothing for an unknown product, a learner who never paid, or an older end', async () => {
    const id = user(21);
    const end = inDays(30);
    await apply(id, 'active', 'starter', end, CAP.starter);
    await db.query('update public.entitlements set seconds_used = 1200 where user_id = $1', [id]);
    const unknown = await apply(id, 'unknown-product', null, null, null);
    assert.equal(unknown.kind, 'unchanged');
    assert.equal(unknown.reason, 'unknown-product');
    assert.equal(unknown.entitlement.seconds_used, 1200);
    // An older end on the same plan, with no start to say otherwise, is a stale read.
    const older = await apply(id, 'active', 'starter', inDays(20), CAP.starter);
    assert.equal(older.reason, 'superseded');
    assert.equal(second(older.entitlement.period_end), second(end), 'a stale read shortened the paid period');
    // A learner on the free trial whom the vendor knows nothing about is not paid, and nothing moves.
    const never = user(22);
    await ticket(never);
    const before = await row(never);
    const nothing = await apply(never, 'inactive', null, null, null);
    assert.equal(nothing.kind, 'unchanged');
    assert.equal(nothing.reason, 'not-paid');
    assert.equal(nothing.entitlement.seconds_used, before.seconds_used);
    assert.equal(nothing.entitlement.plan, 'trial');
  });

  test('a period start the vendor could not have sent is refused', async () => {
    const id = user(23);
    await assert.rejects(apply(id, 'active', 'starter', inDays(30), CAP.starter, null, inDays(31)), /period start/);
    await assert.rejects(apply(id, 'inactive', null, null, null, null, inDays(-1)), /grants an allowance/);
  });

  test('the rollback refuses without its interlock and restores version one with it', async () => {
    const down = readFileSync(ROLLBACK, 'utf8');
    await assert.rejects(db.exec(down), /explicit interlock/);
    await db.exec("select set_config('luvani.reopen_trial_allowance', 'yes', false)");
    await db.exec("select set_config('luvani.reopen_trial_audio_and_epoch','yes',false)");
    await db.exec(readFileSync(path.join(ROOT, 'supabase', 'rollback', '20261007121856_down.sql'), 'utf8'));
    await db.exec(down);
    assert.equal((await db.query<{ v: number }>('select public.billing_projection_version() as v')).rows[0]!.v, 1);
    assert.equal((await db.query("select 1 from pg_proc where proname in ('apply_billing_projection_v2', 'billing_renewals_due_v1', 'allowance_window_epoch_v1')")).rows.length, 0);
    assert.equal((await db.query("select 1 from information_schema.columns where table_name = 'entitlements' and column_name = 'allowance_window_end'")).rows.length, 0);
    // F733 second review: the period start and the withheld part go with the window.
    assert.equal((await db.query("select 1 from information_schema.columns where table_name = 'entitlements' and column_name in ('period_start', 'withheld_seconds')")).rows.length, 0);
    await db.exec(down);
    // A read still works on the rolled-back schema, and a yearly row keeps its paid year.
    assert.equal((await read(user(3))).plan, 'regular');
    // And the forward migration applies again on top of the rollback.
    await db.exec(readFileSync(path.join(MIGRATIONS, FORWARD), 'utf8'));
    assert.equal((await db.query<{ v: number }>('select public.billing_projection_version() as v')).rows[0]!.v, 2);
  });
});

describe('the F733 migration over a database that already holds paid learners', () => {
  // F733 second review (2026-10-06): the forward migration had only ever been
  // applied to an empty table, and a second run failed on its first column.
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
    for (const file of readdirSync(MIGRATIONS).filter(file => file.endsWith('.sql') && file < FORWARD).sort()) {
      await db.exec(readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    }
  });
  after(async () => { await db?.close(); });

  // This database stops at F733, so its caps are the ones then in force, not
  // today's PLANS (REV-001 moved them to 18000 / 36000 in migration 43).
  const CAPS_AT_F733 = { starter: 10800, regular: 18000 } as const;
  test('the forward migration applies over existing paid rows, twice, and a new period still refills them', async () => {
    const monthly = user(1);
    const spent = user(2);
    for (const id of [monthly, spent]) await db.query('insert into auth.users(id) values($1)', [id]);
    const end = inDays(20);
    await db.query("insert into public.entitlements(user_id, plan, seconds_used, period_end) values($1, 'starter', 600, $2), ($3, 'regular', 18000, $2)", [monthly, end, spent]);
    const epochs = (await db.query<{ usage_epoch: string }>('select usage_epoch from public.entitlements order by user_id')).rows.map(r => r.usage_epoch);
    const forward = readFileSync(path.join(MIGRATIONS, FORWARD), 'utf8');
    await db.exec(forward);
    await db.exec(forward);
    const rows = (await db.query<Row>('select * from public.entitlements order by user_id')).rows;
    assert.deepEqual(rows.map(r => [r.plan, r.seconds_used, r.allowance_window_end, r.period_start, r.withheld_seconds]),
      [['starter', 600, null, null, 0], ['regular', 18000, null, null, 0]], 'the migration changed a paid row');
    assert.deepEqual(rows.map(r => r.usage_epoch), epochs, 'the migration started a new usage period');
    assert.equal((await db.query<{ v: number }>('select public.billing_projection_version() as v')).rows[0]!.v, 2);
    assert.equal((await db.query("select 1 from pg_trigger where tgname = 'entitlements_window_epoch'")).rows.length, 1);

    const project = async (id: string, plan: string, at: string, start: string) => {
      const t = Number((await db.query<{ t: string }>('select public.begin_billing_refresh($1) as t', [id])).rows[0]!.t);
      return (await db.query<{ r: { kind: string; entitlement: Row } }>('select public.apply_billing_projection_v2($1,$2,$3,$4,$5,null,$6,null,$7) as r',
        [id, t, 'active', plan, at, CAPS_AT_F733[plan as 'starter' | 'regular'], start])).rows[0]!.r;
    };
    // The same period read again with a start it never had refills nothing.
    const same = await project(monthly, 'starter', end, inDays(-10));
    assert.equal(same.kind, 'active');
    assert.equal(same.entitlement.seconds_used, 600, 'recording a start over an existing period refilled it');
    // The next paid month does.
    const renewed = await project(spent, 'regular', inDays(50), end);
    assert.equal(renewed.entitlement.seconds_used, 0);
  });
});
