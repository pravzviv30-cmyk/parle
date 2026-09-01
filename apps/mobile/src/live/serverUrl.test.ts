/**
 * One address, one home.
 *
 * In the manner of copy.test.ts: walk the source and prove a thing that should
 * exist once exists once. The address had three homes that all agreed, which is
 * the state a fourth disagreeing copy is added from.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TOKEN_SERVER, selectTokenServerUrl } from './serverUrl.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

describe('the token server address', () => {
  test('the token server address has exactly one home in the app', () => {
    const homes = sourceFiles(SRC).filter((file) => readFileSync(file, 'utf8').includes('EXPO_PUBLIC_TOKEN_SERVER_URL'));
    assert.deepEqual(
      homes.map((f) => f.slice(SRC.length)),
      ['live/serverUrl.ts'],
      'every other file should import it rather than spell it out again',
    );
  });

  test('it still resolves to something usable with no env at all', () => {
    // The test runner injects the same explicit local flag as the dev scripts.
    assert.match(TOKEN_SERVER, /^https?:\/\//);
    assert.ok(!TOKEN_SERVER.endsWith('/'), 'callers append /health and /session/start, so a trailing slash would double it');
  });

  test('a deployment refuses a missing or plaintext endpoint', () => {
    assert.throws(() => selectTokenServerUrl({ nodeEnv: 'production' }), /without a configured token server/);
    assert.throws(
      () => selectTokenServerUrl({ nodeEnv: 'production', tokenServerUrl: 'http://api.luvani.example' }),
      /not HTTPS/,
    );
    assert.equal(
      selectTokenServerUrl({ nodeEnv: 'production', tokenServerUrl: 'https://api.luvani.example' }),
      'https://api.luvani.example',
    );
  });
});
