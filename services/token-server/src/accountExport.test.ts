import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportSupabaseAccountData } from './accountExport.ts';

test('account export returns only rows filtered to the authenticated learner', async () => {
  const urls: string[] = [];
  const request = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer service-secret');
    if (url.includes('/auth/v1/')) {
      return new Response(JSON.stringify({
        email: 'learner@example.com',
        created_at: '2026-01-01T00:00:00.000Z',
        last_sign_in_at: '2026-08-30T10:00:00.000Z',
      }));
    }
    return new Response(JSON.stringify([{ user_id: 'user/id', source: url.split('/rest/v1/')[1] }]));
  };

  const exported = await exportSupabaseAccountData(
    'https://project.supabase.co/',
    'service-secret',
    'user/id',
    request as typeof fetch,
    new Date('2026-08-30T12:00:00.000Z'),
  );

  assert.equal(exported.format, 'luvani-account-export-v1');
  assert.equal(exported.exportedAt, '2026-08-30T12:00:00.000Z');
  assert.equal(exported.account.id, 'user/id');
  assert.equal(exported.account.email, 'learner@example.com');
  assert.deepEqual(Object.keys(exported.serverData), [
    'learner_state', 'product_events', 'entitlements', 'session_usage', 'billing_events', 'conversation_packs',
    'social_profiles', 'social_blocks', 'social_reports', 'social_notices', 'social_reactions', 'social_edges', 'social_challenges',
  ]);
  const tableUrls = urls.filter((url) => url.includes('/rest/v1/'));
  assert.equal(tableUrls.length, 13);
  for (const url of tableUrls) {
    if (/social_(edges|challenges)\?/.test(url)) assert.match(url, /\?or=\(sender\.eq\.user%2Fid,recipient\.eq\.user%2Fid\)&select=\*$/);
    else assert.match(url, /\?user_id=eq\.user%2Fid&select=\*$/);
  }
  assert.ok(urls.every((url) => !url.includes('trial_installations')));
});

test('account export fails closed when one owned table cannot be read', async () => {
  const request = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/auth/v1/')) return new Response(JSON.stringify({ email: null }));
    if (url.includes('/product_events?')) return new Response('no', { status: 503 });
    return new Response('[]');
  };
  await assert.rejects(
    exportSupabaseAccountData('https://project.supabase.co', 'secret', 'user', request as typeof fetch),
    /product_events export failed \(503\)/,
  );
});
