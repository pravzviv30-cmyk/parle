import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticationIsRecent, verifiedAuthenticationAt } from './recent.ts';

const now = Date.UTC(2026, 9, 2, 12);
const claims = (method: string, timestamp: unknown) => ({ role: 'authenticated', session_id: 'signed-session', amr: [{ method, timestamp }] });
test('a reauthentication that already happened is not asked for again', () => {
  for (const method of ['oauth', 'password']) {
    assert.equal(authenticationIsRecent(verifiedAuthenticationAt(claims(method, now / 1000 - 300)), now), true);
    assert.equal(authenticationIsRecent(verifiedAuthenticationAt(claims(method, now / 1000 - 301)), now), false);
  }
});
test('a refreshed bearer or another account sign-in does not renew its authentication proof', () => {
  const old = { ...claims('password', now / 1000 - 3600), iat: now / 1000, amr: [{ method: 'password', timestamp: now / 1000 - 3600 }, { method: 'token_refresh', timestamp: now / 1000 }] };
  assert.equal(authenticationIsRecent(verifiedAuthenticationAt(old), now), false);
  for (const invalid of [null, {}, claims('anonymous', now / 1000), claims('oauth', 'today'), claims('oauth', Infinity), claims('oauth', now / 1000 + 1), { ...claims('oauth', now / 1000), session_id: null }]) {
    assert.equal(authenticationIsRecent(verifiedAuthenticationAt(invalid), now), false);
  }
});
