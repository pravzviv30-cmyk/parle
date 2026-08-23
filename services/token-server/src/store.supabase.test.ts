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
