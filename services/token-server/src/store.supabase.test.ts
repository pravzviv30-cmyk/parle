import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SupabaseEntitlementStore } from './store.ts';

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
