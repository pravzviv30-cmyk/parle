import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deleteAccountWithProcessor, deleteSupabaseUser, requestRevenueCatErasure, signedInRecently } from './accountDeletion.ts';

test('account deletion asks the purchase processor to erase its record too', async () => {
  for (const status of [200, 404]) {
    const seen: { url: string; options?: RequestInit }[] = [];
    const request: typeof fetch = async (url, options) => {
      seen.push({ url: String(url), options });
      return new Response(null, { status: String(url).startsWith('https://api.revenuecat.com/') ? status : 204 });
    };
    assert.equal(await deleteAccountWithProcessor('https://project.supabase.co/', 'supabase-secret', 'user/id', 'processor-secret', request), true);
    assert.deepEqual(seen.map(call => call.url), ['https://api.revenuecat.com/v1/subscribers/user%2Fid', 'https://project.supabase.co/auth/v1/admin/users/user%2Fid']);
    assert.deepEqual(seen.map(call => call.options?.method), ['DELETE', 'DELETE']);
    assert.deepEqual(seen[0]?.options?.headers, { authorization: 'Bearer processor-secret' });
    assert.equal(seen[0]?.options?.body, undefined);
    assert.ok(seen[0]?.options?.signal);
  }
});

test('a refused or unavailable processor erasure leaves the account available to retry', async () => {
  for (const status of [201, 202, 401, 403, 429, 500]) {
    let calls = 0;
    const request: typeof fetch = async url => { calls++; assert.ok(String(url).startsWith('https://api.revenuecat.com/')); return new Response(null, { status }); };
    assert.equal(await deleteAccountWithProcessor('https://project.supabase.co', 's', 'learner', 'r', request), false);
    assert.equal(calls, 1);
  }
  let calls = 0;
  const unavailable: typeof fetch = async () => { calls++; throw new Error('offline'); };
  assert.equal(await requestRevenueCatErasure('learner', undefined, unavailable), false);
  assert.equal(calls, 0);
  assert.equal(await deleteAccountWithProcessor('https://project.supabase.co', 's', 'learner', 'r', unavailable), false);
  assert.equal(calls, 1);
});

test('account erasure safely retries after the processor accepts but identity deletion is refused', async () => {
  let attempt = 0;
  const seen: string[] = [];
  const request: typeof fetch = async url => {
    const processor = String(url).startsWith('https://api.revenuecat.com/');
    seen.push(processor ? 'processor' : 'identity');
    return new Response(null, { status: processor ? (attempt === 0 ? 200 : 404) : (attempt === 0 ? 503 : 204) });
  };
  await assert.rejects(deleteAccountWithProcessor('https://project.supabase.co', 's', 'learner', 'r', request), /account deletion failed/);
  attempt++;
  assert.equal(await deleteAccountWithProcessor('https://project.supabase.co', 's', 'learner', 'r', request), true);
  assert.deepEqual(seen, ['processor', 'identity', 'processor', 'identity']);
});

test('account deletion uses the admin boundary and service role', async () => {
  let seenUrl = '';
  let seen: RequestInit | undefined;
  const request = async (input: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(input);
    seen = init;
    return new Response(null, { status: 204 });
  };
  await deleteSupabaseUser('https://project.supabase.co/', 'server-secret', 'user/id', request as typeof fetch);
  assert.equal(seenUrl, 'https://project.supabase.co/auth/v1/admin/users/user%2Fid');
  assert.equal(seen?.method, 'DELETE');
  assert.equal((seen?.headers as Record<string, string>).authorization, 'Bearer server-secret');
});

describe('recent authentication boundary', () => {
  test('accepts a real sign-in inside five minutes', async () => {
    const now = Date.parse('2026-08-23T12:05:00.000Z');
    const request = async () => new Response(JSON.stringify({ last_sign_in_at: '2026-08-23T12:01:00.000Z' }));
    assert.equal(
      await signedInRecently('https://project.supabase.co', 'secret', 'user-1', request as typeof fetch, now),
      true,
    );
  });

  test('refuses an old, absent or future sign-in timestamp', async () => {
    const now = Date.parse('2026-08-23T12:05:00.000Z');
    for (const last_sign_in_at of ['2026-08-23T11:59:59.000Z', null, '2026-08-23T12:06:00.000Z']) {
      const request = async () => new Response(JSON.stringify({ last_sign_in_at }));
      assert.equal(
        await signedInRecently('https://project.supabase.co', 'secret', 'user-1', request as typeof fetch, now),
        false,
      );
    }
  });
});
