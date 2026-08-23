import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deleteSupabaseUser, signedInRecently } from './accountDeletion.ts';

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
