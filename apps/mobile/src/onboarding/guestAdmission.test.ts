import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

const source = readFileSync(new URL('./guestPractice.ts', import.meta.url), 'utf8');
const start = source.indexOf('async function post(');
const end = source.indexOf('\n/**', start);
assert.ok(start > 0 && end > start);
const postSource = stripTypeScriptTypes(source.slice(start, end));

async function request(status: number, body: unknown, path = 'start') {
  const calls: string[] = [];
  const world = {
    fetch: async (url: string) => { calls.push(url); return { ok: status >= 200 && status < 300, status, json: async () => body }; },
    TOKEN_SERVER: 'https://token.fixture.invalid', installationId: async () => 'device-fixture',
    starterFailure: () => 'unavailable', AbortSignal,
  };
  const post = new Function(...Object.keys(world), `${postSource}\nreturn post;`)(...Object.values(world));
  return { calls, result: await post(path, { live: true }).then((value: unknown) => value, (error: Error) => error.message) };
}

test('disabled guest admission reaches the account handoff as an explicit service capability', async () => {
  const h = await request(503, { error: 'guest-live-unavailable' });
  assert.equal(h.result, 'guest-live-unavailable');
  assert.deepEqual(h.calls, ['https://token.fixture.invalid/onboarding/start']);
});

test('ordinary outages and other guest endpoints never masquerade as an account requirement', async () => {
  for (const [status, body, path] of [[503, { error: 'temporarily unavailable' }, 'start'], [401, { error: 'guest-live-unavailable' }, 'start'], [503, { error: 'guest-live-unavailable' }, 'audio']] as const) {
    const h = await request(status, body, path);
    assert.equal(h.result, 'unavailable');
  }
});
test('an unavailable speech pipeline reaches disclosure without promising an account upgrade', async () => {
  const h = await request(503, { error: 'voice-unavailable', supportedModes: ['lesson-text', 'convo-text'] });
  assert.equal(h.result, 'voice-unavailable');
});
test('a phone that already had its café scene reaches the account handoff as its own refusal', async () => {
  const h = await request(503, { error: 'guest-scene-used' });
  assert.equal(h.result, 'guest-scene-used');
  assert.equal((await request(503, { error: 'guest-scene-used' }, 'audio')).result, 'unavailable', 'only the start can refuse a scene');
});

test('the guest start limit reaches the account handoff instead of a retry', async () => {
  const h = await request(429, { error: 'too many guest starts' });
  assert.equal(h.result, 'guest-start-limited');
  assert.equal((await request(429, {}, 'audio')).result, 'unavailable', 'only the start limit opens the account route');
});
