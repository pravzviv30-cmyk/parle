import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import {
  DevelopmentEntitlementStore,
  FileEntitlementStore,
  InMemoryEntitlementStore,
  SupabaseEntitlementStore,
} from './store.ts';

describe('Supabase entitlements', () => {
  test('claims a trial using only deployment-salted installation and user signals', async () => {
    let body = '';
    const request = async (_input: string | URL | Request, init?: RequestInit) => {
      body = String(init?.body);
      return new Response('true', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const store = new SupabaseEntitlementStore('https://project.supabase.co', 'secret', request as typeof fetch);
    assert.equal(await store.claimTrial('user-1', 'i'.repeat(43), 'u'.repeat(43)), true);
    assert.deepEqual(JSON.parse(body), {
      p_user_id: 'user-1',
      p_installation_hash: 'i'.repeat(43),
      p_user_hash: 'u'.repeat(43),
    });
  });

  test('reads through the atomic RPC so a missing trial or expired paid period is rolled before gating', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const request = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({ user_id: 'user-1', plan: 'starter', seconds_used: 0, period_end: '2026-09-22T00:00:00.000Z' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };
    const store = new SupabaseEntitlementStore('https://project.supabase.co/', 'secret', request as typeof fetch);
    const result = await store.get('user-1');
    assert.equal(result.plan, 'starter');
    assert.equal(result.secondsUsed, 0);
    assert.match(calls[0]!.url, /\/rpc\/consume_entitlement$/);
    assert.match(calls[0]!.init?.body as string, /"p_seconds":0/);
    assert.match(calls[0]!.init?.body as string, /"p_session_id":null/);
  });

  test('debits through the atomic RPC and restores dates', async () => {
    const end = '2026-09-21T12:00:00.000Z';
    const request = async () =>
      new Response(JSON.stringify({ user_id: 'user-1', plan: 'starter', seconds_used: 72, period_end: end }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const store = new SupabaseEntitlementStore('https://project.supabase.co', 'secret', request as typeof fetch);
    const result = await store.consume('user-1', 12.4, '123e4567-e89b-42d3-a456-426614174000');
    assert.equal(result.secondsUsed, 72);
    assert.equal(result.periodEnd?.toISOString(), end);
  });
});

describe('Supabase billing events', () => {
  test('recording a billing event asks the database once and reports a replay as already seen', async () => {
    // RevenueCat retries any webhook it did not answer with a 2xx, and Apple redelivers
    // for hours. Both halves of this title are what lets F248 afford that: the dedupe
    // runs before the subscriber fetch, so a redelivery costs one question to our own
    // database and no outbound request to the vendor at all.
    const calls: { url: string; init?: RequestInit }[] = [];
    let answer = 'true';
    const request = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(answer, { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const store = new SupabaseEntitlementStore('https://project.supabase.co', 'secret', request as typeof fetch);

    assert.equal(await store.recordBillingEvent('user-1', 'rc:evt-1'), true, 'a first delivery is a first sighting');
    assert.equal(calls.length, 1, 'one delivery costs exactly one question to the database');
    assert.match(calls[0]!.url, /\/rest\/v1\/rpc\/record_billing_event$/);
    // The argument names are the migration's, not ours: record_billing_event(p_event_id
    // text, p_user_id uuid). PostgREST matches an overload by argument name, so a typo
    // here is a 404 in production and a green test everywhere else.
    assert.deepEqual(JSON.parse(calls[0]!.init?.body as string), { p_event_id: 'rc:evt-1', p_user_id: 'user-1' });

    answer = 'false';
    assert.equal(await store.recordBillingEvent('user-1', 'rc:evt-1'), false, 'a replay is already seen');
    assert.equal(calls.length, 2, 'a replay asks once as well — never twice, and never from a local cache');
  });

  test('an answer that is not literally true is never a first sighting', async () => {
    // F73 and F74 were one defect written twice: `returning true into <flag>` assigns
    // NULL when the insert conflicts, `not NULL` is NULL, and a plpgsql IF on NULL takes
    // neither branch, so money moved. The client half of that same mistake is reading an
    // absent or malformed answer as a first sighting, which would send a fresh subscriber
    // fetch on every single redelivery of an event we have already acted on.
    for (const body of ['null', '{}', '[]', '"true"', '1']) {
      const request = async () => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      const store = new SupabaseEntitlementStore('https://project.supabase.co', 'secret', request as typeof fetch);
      assert.equal(await store.recordBillingEvent('u', 'rc:evt-1'), false, `${body} must not read as a first sighting`);
    }
  });

  test('a billing event the database refused to record is raised, not answered', async () => {
    // record_billing_event raises when another transaction holds this event id
    // uncommitted, because that is neither a replay nor a first sighting. Answering
    // "already seen" would acknowledge an event whose first delivery may still roll back.
    // Throwing sends the vendor away to redeliver, and costs nothing outbound because
    // the dedupe runs before the fetch.
    const request = async () => new Response('{"message":"billing event is being recorded concurrently"}', { status: 500 });
    const store = new SupabaseEntitlementStore('https://project.supabase.co', 'secret', request as typeof fetch);
    await assert.rejects(() => store.recordBillingEvent('user-1', 'rc:evt-1'), /billing event record failed \(500\)/);
  });
});

describe('billing event dedupe in the local fixtures', () => {
  test('a fixture dedupes on the event id alone, exactly as the primary key does', async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'luvani-billing-')), 'entitlements.json');
    for (const store of [new InMemoryEntitlementStore(), new FileEntitlementStore(file)]) {
      assert.equal(await store.recordBillingEvent('user-1', 'rc:evt-1'), true);
      assert.equal(await store.recordBillingEvent('user-1', 'rc:evt-1'), false);
      // billing_events is keyed on event_id alone, and the migration is explicit that a
      // replay naming a different account is still a replay: RevenueCat aliases and
      // transfers app_user_ids. A fixture keyed on user plus event would answer "first
      // sighting" exactly where production answers "already seen".
      assert.equal(await store.recordBillingEvent('user-2', 'rc:evt-1'), false, 'a transfer replay is still a replay');
      assert.equal(await store.recordBillingEvent('user-1', 'rc:evt-2'), true);
    }
  });

  test('a fixture refuses a billing event with no id or no account', async () => {
    // The RPC raises on both. A fixture that accepted them would also collapse every
    // empty id onto one set entry, so the second distinct event would read as a replay.
    const store = new InMemoryEntitlementStore();
    await assert.rejects(() => store.recordBillingEvent('user-1', ''), /event id/);
    await assert.rejects(() => store.recordBillingEvent('', 'rc:evt-1'), /account/);
  });

  test('the development store treats every delivery as new, so a replayed fixture still runs', async () => {
    // Same promise as its never-running-down allowance: local state never stops a
    // developer exercising a path a second time.
    const store = new DevelopmentEntitlementStore();
    assert.equal(await store.recordBillingEvent('user-1', 'rc:evt-1'), true);
    assert.equal(await store.recordBillingEvent('user-1', 'rc:evt-1'), true);
  });
});


test('billing projection uses one RPC carrying vendor state but never a stale usage counter', async () => {
  const calls: { url: string; body: Record<string,unknown> }[] = [];
  const request = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ kind: 'active', entitlement: { user_id:'owner',plan:'regular',seconds_used:600,period_end:'2027-01-01T00:00:00Z' } }));
  };
  const store = new SupabaseEntitlementStore('https://db.test', 'secret', request as typeof fetch);
  const result = await store.applyBilling('owner', 2, { kind:'active',plan:'regular',periodEnd:new Date('2027-01-01'),grantSeconds:36000 }, 'event-1');
  assert.equal(result.entitlement.secondsUsed,600);
  assert.equal(calls.length,1);
  // F733 (2026-10-05): the projection that grants store trials and yearly windows
  // carries the window's grant; the usage counter still never crosses the wire.
  assert.match(calls[0]!.url,/rpc\/apply_billing_projection_v2$/);
  // F733 review (2026-10-05): a monthly period carries no allowance window.
  // F733 second review (2026-10-06): a snapshot with no purchase date sends no start, and the database orders it by end.
  assert.deepEqual(calls[0]!.body,{p_user_id:'owner',p_ticket:2,p_kind:'active',p_plan:'regular',p_period_end:'2027-01-01T00:00:00.000Z',p_event_id:'event-1',p_grant_seconds:36000,p_window_end:null,p_period_start:null});
  assert.equal('seconds_used' in calls[0]!.body,false);
});

test('a projection sends when the store says the period began, and reads the start and the withheld part back', async () => {
  // F733 second review (2026-10-06): store answers are ordered by start, so an
  // upgrade Apple applies at once is not mistaken for a stale read.
  const calls: Record<string, unknown>[] = [];
  const request = async (_input: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ kind: 'active', entitlement: { user_id: 'owner', plan: 'regular', seconds_used: 13800,
      period_start: '2026-10-06T09:00:00+00:00', period_end: '2026-10-13T09:00:00+00:00', withheld_seconds: 13800 } }));
  };
  const store = new SupabaseEntitlementStore('https://db.test', 'secret', request as typeof fetch);
  const result = await store.applyBilling('owner', 4, { kind: 'active', plan: 'regular', periodStart: new Date('2026-10-06T09:00:00Z'),
    periodEnd: new Date('2026-10-13T09:00:00Z'), grantSeconds: 4200 });
  assert.equal(calls[0]!.p_period_start, '2026-10-06T09:00:00.000Z');
  assert.equal(result.entitlement.periodStart?.toISOString(), '2026-10-06T09:00:00.000Z');
  assert.equal(result.entitlement.withheldSeconds, 13800);
  // Nothing at all withheld reads as nothing, not as a zero to compare.
  const plain = new SupabaseEntitlementStore('https://db.test', 'secret', (async () => new Response(JSON.stringify({ kind: 'unchanged', reason: 'superseded',
    entitlement: { user_id: 'owner', plan: 'starter', seconds_used: 60, period_end: '2026-11-01T00:00:00Z', period_start: null, withheld_seconds: 0 } }))) as typeof fetch);
  assert.deepEqual((await plain.applyBilling('owner', 5, { kind: 'inactive' })).entitlement, { plan: 'starter', secondsUsed: 60, periodEnd: new Date('2026-11-01T00:00:00Z') });
});

test('a yearly projection sends the paid year as the period and the window beside it, and reads both back', async () => {
  const calls: Record<string, unknown>[] = [];
  const request = async (_input: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ kind: 'active', entitlement: { user_id: 'owner', plan: 'regular', seconds_used: 0,
      period_end: '2027-10-05T09:00:00+00:00', allowance_window_end: '2026-11-04T09:00:00+00:00' } }));
  };
  const store = new SupabaseEntitlementStore('https://db.test', 'secret', request as typeof fetch);
  const result = await store.applyBilling('owner', 3, { kind: 'active', plan: 'regular', periodEnd: new Date('2027-10-05T09:00:00Z'),
    windowEnd: new Date('2026-11-04T09:00:00Z'), grantSeconds: 36000 });
  assert.equal(calls[0]!.p_period_end, '2027-10-05T09:00:00.000Z', 'the window was sent as the period, which a read would lapse');
  assert.equal(calls[0]!.p_window_end, '2026-11-04T09:00:00.000Z');
  assert.equal(result.entitlement.periodEnd?.toISOString(), '2027-10-05T09:00:00.000Z');
  assert.equal(result.entitlement.windowEnd?.toISOString(), '2026-11-04T09:00:00.000Z');
});
