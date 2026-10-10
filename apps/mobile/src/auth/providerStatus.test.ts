import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { createProviderAvailability, googleAvailable, googleEnabled } from './providerStatus.ts';

const settings = (google: unknown) =>
  new Response(JSON.stringify({ external: { google, email: true } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('is Google actually switched on', () => {
  test('a project with the provider off says so', () => {
    assert.equal(googleEnabled({ external: { google: false, email: true } }), false);
  });

  test('a project with the provider on says so', () => {
    assert.equal(googleEnabled({ external: { google: true } }), true);
  });

  /**
   * Everything unrecognised is "could not tell", never "off". Reading a shape
   * we do not understand as a refusal would take email-and-password sign-in
   * down with it the first time GoTrue changes this document.
   */
  test('a shape this code does not understand is never read as switched off', () => {
    for (const body of [null, undefined, 'nope', 42, {}, { external: null }, { external: { google: 'yes' } }]) {
      assert.equal(googleEnabled(body), null);
    }
  });

  test('a project that answers is reported from its own settings document', async () => {
    assert.equal(await googleAvailable('https://p.supabase.co', 'anon-key', async () => settings(false)), false);
    assert.equal(await googleAvailable('https://p.supabase.co', 'anon-key', async () => settings(true)), true);
  });

  /**
   * The header is the whole test. Without `apikey` the endpoint answers 401,
   * 401 is "could not tell", and a preflight that can only ever say "could not
   * tell" is dead code that looks like a feature. The first draft of this shipped
   * without it and answered null against the real project every time.
   */
  test('the settings document is asked for with the anon key it needs', async () => {
    let headers: Record<string, string> = {};
    await googleAvailable('https://p.supabase.co', 'the-anon-key', async (_url, init) => {
      headers = (init?.headers ?? {}) as Record<string, string>;
      return settings(true);
    });
    assert.equal(headers.apikey, 'the-anon-key', 'without an apikey header /auth/v1/settings answers 401');
  });

  test('a 401 is could-not-tell, never switched-off', async () => {
    assert.equal(
      await googleAvailable('https://p.supabase.co', 'anon-key', async () => new Response('', { status: 401 })),
      null,
    );
  });

  test('the settings document is read from the project that was named', async () => {
    let asked = '';
    await googleAvailable('https://p.supabase.co', 'anon-key', async (url) => {
      asked = String(url);
      return settings(true);
    });
    assert.equal(asked, 'https://p.supabase.co/auth/v1/settings');
  });

  /**
   * The preflight is a courtesy, not a gate. If it cannot answer, the caller
   * carries on and lets the real redirect decide — a flaky network must not
   * become "Google sign in is not set up".
   */
  test('a preflight that cannot answer never blocks the attempt', async () => {
    assert.equal(
      await googleAvailable('https://p.supabase.co', 'anon-key', async () => {
        throw new TypeError('Failed to fetch');
      }),
      null,
    );
    assert.equal(await googleAvailable('https://p.supabase.co', 'anon-key', async () => new Response('', { status: 500 })), null);
    assert.equal(await googleAvailable('https://p.supabase.co', 'anon-key', async () => new Response('<html>', { status: 200 })), null);
  });
});

describe('the adapter asks before it navigates', () => {
  /**
   * The adapter cannot be imported in node, so the wiring is read. The order is
   * the whole point: the availability check has to happen *before*
   * `startGoogleSignIn`, because after it the browser has already left.
   */
  test('a disabled google provider keeps the learner in the app', () => {
    const source = readFileSync(new URL('./supabaseAdapter.ts', import.meta.url), 'utf8');
    const method = source.slice(source.indexOf('signInWithGoogle('), source.indexOf('sendPasswordReset('));

    const asks = method.indexOf("providers.available('google')");
    const navigates = method.indexOf('startGoogleSignIn(client)');
    assert.ok(asks >= 0, 'signInWithGoogle must check whether the provider is enabled');
    assert.ok(navigates > asks, 'the check must happen before the redirect, not after');
    assert.match(method, /GOOGLE_NOT_CONFIGURED/);
  });
});

test('warmed settings open either provider without another network round trip', async () => {
  let requests = 0;
  const providers = createProviderAvailability('https://p.supabase.co', 'anon', async () => {
    requests++;
    return Response.json({ external: { google: true, apple: false } });
  });
  await providers.prefetch();
  assert.equal(await providers.available('google'), true);
  assert.equal(await providers.available('apple'), false);
  assert.equal(requests, 1);
});

test('warmup and simultaneous taps share the pending settings request', async () => {
  let requests = 0;
  let finish!: (response: Response) => void;
  const providers = createProviderAvailability('https://p.supabase.co', 'anon', () => {
    requests++;
    return new Promise<Response>((resolve) => { finish = resolve; });
  });
  const warm = providers.prefetch();
  const google = providers.available('google');
  const apple = providers.available('apple');
  assert.equal(requests, 1);
  finish(Response.json({ external: { google: true, apple: true } }));
  await warm;
  assert.deepEqual(await Promise.all([google, apple]), [true, true]);
});

test('settings expire after thirty seconds and changed provider flags take effect', async () => {
  let now = 0; let enabled = true; let requests = 0;
  const providers = createProviderAvailability('https://p.supabase.co', 'anon', async () => {
    requests++;
    return settings(enabled);
  }, () => now);
  assert.equal(await providers.available('google'), true);
  now = 29_999; enabled = false;
  assert.equal(await providers.available('google'), true);
  assert.equal(requests, 1);
  now = 30_000;
  assert.equal(await providers.available('google'), false);
  assert.equal(requests, 2);
});

test('a failed refresh returns unknown instead of reusing a stale disabled flag', async () => {
  let now = 0; let requests = 0;
  const providers = createProviderAvailability('https://p.supabase.co', 'anon', async () => {
    requests++;
    if (requests === 1) return settings(false);
    if (requests === 2) throw new TypeError('offline');
    return settings(true);
  }, () => now);
  assert.equal(await providers.available('google'), false);
  now = 30_000;
  assert.equal(await providers.available('google'), null);
  assert.equal(await providers.available('google'), true);
  assert.equal(requests, 3);
});

test('settings caches are isolated by adapter and never reuse another project flag', async () => {
  const one = createProviderAvailability('https://one.supabase.co', 'one-key', async (url, init) => {
    assert.equal(url, 'https://one.supabase.co/auth/v1/settings');
    assert.equal((init?.headers as Record<string, string>).apikey, 'one-key');
    return settings(false);
  });
  const two = createProviderAvailability('https://two.supabase.co', 'two-key', async (url, init) => {
    assert.equal(url, 'https://two.supabase.co/auth/v1/settings');
    assert.equal((init?.headers as Record<string, string>).apikey, 'two-key');
    return settings(true);
  });
  assert.deepEqual(await Promise.all([one.available('google'), two.available('google')]), [false, true]);
  const source = readFileSync(new URL('./supabaseAdapter.ts', import.meta.url), 'utf8');
  assert.match(source, /const providers = createProviderAvailability\(url, anonKey\);\s*void providers.prefetch\(\)/);
});
