import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createOriginPolicy, originAllowed, parseAllowedOrigins } from './httpSecurity.ts';

describe('HTTP security — exact browser origins', () => {
  test('production permits only the exact configured origins', () => {
    const policy = createOriginPolicy({
      NODE_ENV: 'production',
      PARLE_ALLOWED_ORIGINS: 'https://app.parle.example,https://beta.parle.example',
    });

    assert.equal(originAllowed(policy, 'https://app.parle.example'), true);
    assert.equal(originAllowed(policy, 'https://evil.example'), false);
    assert.equal(originAllowed(policy, 'https://app.parle.example.evil.example'), false);
    assert.equal(originAllowed(policy, null), true, 'native apps do not send a browser Origin header');
  });

  test('development adds known local Expo origins without adding a wildcard', () => {
    const policy = createOriginPolicy({ NODE_ENV: 'development' });
    assert.equal(originAllowed(policy, 'http://localhost:8090'), true);
    assert.equal(originAllowed(policy, 'https://example.com'), false);
    assert.equal(policy.allowed.has('*'), false);
  });

  test('configured origins are trimmed and deduplicated', () => {
    assert.deepEqual(parseAllowedOrigins(' https://a.example,https://a.example, https://b.example '), [
      'https://a.example',
      'https://b.example',
    ]);
  });
});

