import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportSupabaseAccountData, exportRecentlyAuthenticatedAccountData } from './accountExport.ts';
const TABLES = ['learner_state', 'product_events', 'entitlements', 'session_usage', 'session_grants', 'billing_events', 'conversation_packs', 'saved_conversation_text', 'phrase_audio_budgets', 'social_profiles', 'social_blocks', 'social_reports', 'social_notices', 'social_reactions', 'social_edges', 'social_challenges'];
const emptySnapshot = () => Object.fromEntries(TABLES.map(table => [table, []]));

test('account export returns only rows filtered to the authenticated learner', async () => {
  const urls: string[] = [];
  const snapshot = { ...emptySnapshot(), saved_conversation_text: [{ session_id: 's', payload: null, deleted: true }], phrase_audio_budgets: [{ user_id: 'user/id', trial_spent_micro_usd: 120 }] };
  const request = async (input: unknown, init?: RequestInit) => {
    const url = String(input); urls.push(url);
    assert.equal((init!.headers as Record<string, string>).authorization, 'Bearer service-secret');
    if (url.includes('/auth/')) return Response.json({ email: 'learner@example.com', created_at: '2026-01-01T00:00:00.000Z' });
    assert.equal(url, 'https://project.supabase.co/rest/v1/rpc/export_account_data');
    assert.equal(init!.method, 'POST');
    assert.deepEqual(JSON.parse(init!.body as string), { p_user_id: 'user/id' });
    return Response.json(snapshot);
  };
  const result = await exportSupabaseAccountData('https://project.supabase.co/', 'service-secret', 'user/id', request as typeof fetch, new Date('2026-10-02T12:00:00Z'));
  assert.equal(result.account.id, 'user/id'); assert.equal(result.account.email, 'learner@example.com');
  assert.equal(result.exportedAt, '2026-10-02T12:00:00.000Z');
  assert.deepEqual(result.serverData, snapshot); assert.deepEqual(Object.keys(result.serverData), TABLES);
  assert.equal(urls.length, 2); assert.match(urls[0]!, /admin\/users\/user%2Fid$/);
  assert.ok(urls.every(url => !url.includes('trial_installations')));
});

test('account export fails closed when one owned table cannot be read', async () => {
  let calls = 0;
  await assert.rejects(exportSupabaseAccountData('https://db.test', 'secret', 'owner', (async (input: unknown) => {
    calls++;
    return String(input).includes('/auth/') ? Response.json({}) : new Response('snapshot unavailable', { status: 503 });
  }) as typeof fetch), /server data export failed/);
  assert.equal(calls, 2, 'missing migration must not fall back to incomplete paged reads');
});

test('the complete export receives one database snapshot without a REST row cap', async () => {
  const snapshot = { ...emptySnapshot(), saved_conversation_text: Array.from({ length: 1001 }, (_, id) => ({ id })) };
  let reads = 0;
  const result = await exportSupabaseAccountData('https://db.test', 'secret', 'owner', (async (input: unknown) => {
    if (String(input).includes('/auth/')) return Response.json({});
    reads++; assert.match(String(input), /rpc\/export_account_data$/);
    return Response.json(snapshot);
  }) as typeof fetch);
  assert.equal(reads, 1); assert.equal(result.serverData.saved_conversation_text.length, 1001);
});

test('an incomplete, malformed or oversized server snapshot cannot become an account archive', async () => {
  const missing = emptySnapshot(); delete missing.saved_conversation_text;
  for (const snapshot of [null, [], missing, { ...emptySnapshot(), extra: [] }, { ...emptySnapshot(), learner_state: {} }, { ...emptySnapshot(), saved_conversation_text: Array.from({ length: 10001 }, () => ({})) }]) {
    await assert.rejects(exportSupabaseAccountData('https://db.test', 'secret', 'owner', (async (input: unknown) => Response.json(String(input).includes('/auth/') ? {} : snapshot)) as typeof fetch), /invalid or oversized snapshot/);
  }
});

test('an export needs a recent sign-in just as a deletion does', async () => {
  const now = new Date('2026-10-02T12:00:00Z');
  for (const signedIn of [null, 'invalid', '2026-10-02T11:54:59Z', '2026-10-02T12:00:01Z']) {
    const urls: string[] = [];
    const request = async (input: string | URL | Request) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ last_sign_in_at: signedIn }));
    };
    assert.equal(await exportRecentlyAuthenticatedAccountData('https://db.test', 'secret', 'owner', now.getTime(), request as typeof fetch, now), null);
    assert.equal(urls.length, 1);
    assert.match(urls[0]!, /auth\/v1\/admin\/users\/owner$/);
  }
  const urls: string[] = [];
  const request = async (input: string | URL | Request) => {
    urls.push(String(input));
    return Response.json(String(input).includes('/auth/') ? { last_sign_in_at: '2026-10-02T11:55:00Z' } : emptySnapshot());
  };
  const exported = await exportRecentlyAuthenticatedAccountData('https://db.test', 'secret', 'owner', now.getTime(), request as typeof fetch, now);
  assert.equal(exported?.account.id, 'owner');
  assert.equal(urls.filter(url => url.includes('/rest/')).length, 1);
});

test('the export describes the antifraud marker as pseudonymous rather than unlinkable', async () => {
  const request = async (input: string | URL | Request) => Response.json(String(input).includes('/auth/') ? {} : emptySnapshot());
  const exported = await exportSupabaseAccountData('https://db.test', 'secret', 'owner', request as typeof fetch);
  assert.match(exported.notes.join(' '), /Pseudonymous.*retained.*after account deletion/);
  assert.match(exported.notes.join(' '), /server can match.*keyed hashes/);
  assert.doesNotMatch(exported.notes.join(' '), /unlinkable|not linkable/);
});


test('an older bearer cannot export after a legitimate sign-in on another device', async () => {
  const now = new Date('2026-10-02T12:00:00Z');
  let requested = false;
  const request = async () => { requested = true; return new Response(JSON.stringify({ last_sign_in_at: now.toISOString() })); };
  for (const authenticatedAt of [undefined, now.getTime() - 3600000]) {
    assert.equal(await exportRecentlyAuthenticatedAccountData('https://db.test', 'secret', 'owner', authenticatedAt, request as typeof fetch, now), null);
  }
  assert.equal(requested, false);
});
