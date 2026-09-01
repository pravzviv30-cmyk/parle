import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { APP_PORT } from '../../shared/devPlan.ts';
import { createOriginPolicy, originAllowed, parseAllowedOrigins } from './httpSecurity.ts';

describe('HTTP security — exact browser origins', () => {
  test('production permits only the exact configured origins', () => {
    const policy = createOriginPolicy({
      NODE_ENV: 'production',
      LUVANI_ALLOWED_ORIGINS: 'https://app.luvani.example,https://beta.luvani.example',
    });

    assert.equal(originAllowed(policy, 'https://app.luvani.example'), true);
    assert.equal(originAllowed(policy, 'https://evil.example'), false);
    assert.equal(originAllowed(policy, 'https://app.luvani.example.evil.example'), false);
    assert.equal(originAllowed(policy, null), true, 'native apps do not send a browser Origin header');
  });

  test('development adds known local Expo origins without adding a wildcard', () => {
    const policy = createOriginPolicy({ NODE_ENV: 'development' });
    assert.equal(originAllowed(policy, 'http://localhost:8090'), true);
    assert.equal(originAllowed(policy, 'https://example.com'), false);
    assert.equal(policy.allowed.has('*'), false);
  });

  /**
   * F258. `npm run dev` serves the app on APP_PORT, and the allowlist used to be
   * four hand-written literals that did not include it — so the repo's own one
   * command brought up an app its own token server answered 403 to. Reading the
   * port from the same constant the dev script launches on is what stops that
   * pair drifting again; a test naming 8082 would only pin today's number.
   */
  test('the development origins cover the port the dev script actually serves', () => {
    const policy = createOriginPolicy({ NODE_ENV: 'development' });
    assert.equal(originAllowed(policy, `http://localhost:${APP_PORT}`), true);
    assert.equal(originAllowed(policy, `http://127.0.0.1:${APP_PORT}`), true);
    assert.equal(policy.allowed.has('*'), false);
  });

  test('configured origins are trimmed and deduplicated', () => {
    assert.deepEqual(parseAllowedOrigins(' https://a.example,https://a.example, https://b.example '), [
      'https://a.example',
      'https://b.example',
    ]);
  });
});

