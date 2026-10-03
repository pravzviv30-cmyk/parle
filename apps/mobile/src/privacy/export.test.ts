import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { setActiveUser, USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { downloadAccountData, downloadVerifiedAccountData } from './export.ts';

const user: AuthUser = { id: 'learner-1', email: 'l@example.com', provider: 'password' };

function adapter(kind: 'supabase' | 'mock', token: string | null): AuthAdapter {
  return {
    kind,
    getSession: async () => user,
    onAuthStateChange: () => () => {},
    signUpWithPassword: async () => ({ ok: true }),
    signInWithPassword: async () => ({ ok: true }),
    signInWithGoogle: async () => ({ ok: true }),
    signInWithApple: async () => ({ ok: true }),
    sendPasswordReset: async () => ({ ok: true }),
    reauthenticateForDeletion: async () => ({ ok: true }),
    deleteAccount: async () => ({ ok: true }),
    signOut: async () => {},
    getAccessToken: async () => token,
  };
}

test('the data export combines every user-scoped device key with the authenticated server copy', async () => {
  let requested = '';
  let saved = '';
  const result = await downloadAccountData(user, adapter('supabase', 'bearer-secret'), {
    request: (async (input, init) => {
      requested = String(input);
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer bearer-secret');
      return new Response(JSON.stringify({ format: 'luvani-account-export-v1', serverData: { learner_state: [] } }));
    }) as typeof fetch,
    readDevice: async (keys) => {
      assert.equal(keys.length, USER_KEY_SUFFIXES.length);
      assert.ok(keys.every((key) => key.startsWith('luvani.u.learner-1.')));
      return keys.map((key, index) => [key, index === 0 ? '{"name":"Ada"}' : null] as const);
    },
    save: async (filename, content, mime) => {
      assert.equal(filename, 'luvani-account-data.json');
      assert.equal(mime, 'application/json');
      saved = content;
    },
    now: () => new Date('2026-08-30T12:00:00.000Z'),
  });

  assert.deepEqual(result, { ok: true });
  assert.match(requested, /\/account\/export$/);
  const payload = JSON.parse(saved) as Record<string, any>;
  assert.equal(payload.format, 'luvani-complete-export-v1');
  assert.equal(payload.exportedAt, '2026-08-30T12:00:00.000Z');
  assert.deepEqual(payload.deviceData.profile, { name: 'Ada' });
  assert.deepEqual(Object.keys(payload.deviceData), [...USER_KEY_SUFFIXES]);
  assert.equal(saved.includes('bearer-secret'), false);
});

test('a device-only development account exports without pretending there is a server copy', async () => {
  let requested = false;
  let saved = '';
  const result = await downloadAccountData(user, adapter('mock', null), {
    request: (async () => { requested = true; return new Response(); }) as typeof fetch,
    readDevice: async (keys) => keys.map((key) => [key, null] as const),
    save: async (_filename, content) => { saved = content; },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(requested, false);
  assert.equal(JSON.parse(saved).serverData, null);
});

test('a signed-out server export fails before sending a request', async () => {
  let requested = false;
  const result = await downloadAccountData(user, adapter('supabase', null), {
    request: (async () => { requested = true; return new Response(); }) as typeof fetch,
    readDevice: async (keys) => keys.map((key) => [key, null] as const),
    save: async () => {},
  });
  assert.deepEqual(result, { ok: false, message: 'Sign in again, then ask for your data.' });
  assert.equal(requested, false);
});


test('a changed account cannot share an earlier account export', async () => {
  setActiveUser(user.id);
  let saved = false;
  const result = await downloadAccountData(user, adapter('supabase', 'token'), {
    readDevice: async keys => keys.map(key => [key, null] as const),
    request: (async () => { setActiveUser('other-account'); return new Response('{}'); }) as typeof fetch,
    save: async () => { saved = true; },
  });
  assert.equal(result.ok, false);
  assert.equal(saved, false);
});

test('a refused export reauthentication sends no request and writes no file', async () => {
  const auth = adapter('supabase', 'token');
  let requested = false;
  let saved = false;
  auth.reauthenticateForDeletion = async (secret, purpose) => {
    assert.equal(secret, 'entered-password'); assert.equal(purpose, 'export');
    return { ok: false, message: 'Please check your password.' };
  };
  assert.deepEqual(await downloadVerifiedAccountData(user, auth, 'entered-password', {
    request: (async () => { requested = true; return new Response('{}'); }) as typeof fetch,
    save: async () => { saved = true; },
  }), { ok: false, message: 'Please check your password.' });
  assert.equal(requested, false); assert.equal(saved, false);
});

test('a stale sign-in export asks for confirmation instead of hiding the recovery', async () => {
  const result = await downloadAccountData(user, adapter('supabase', 'token'), {
    readDevice: async () => [], request: (async () => new Response('', { status: 403 })) as typeof fetch,
    save: async () => { assert.fail('refused export shared a file'); },
  });
  assert.deepEqual(result, { ok: false, message: 'Sign in again to confirm it is you, then download your data.' });
});
