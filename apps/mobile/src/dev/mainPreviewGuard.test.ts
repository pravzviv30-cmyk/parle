import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainPreviewAllowed, MAIN_PREVIEW_USER_ID, type MainPreviewEnvironment } from './mainPreviewGuard.ts';

const local: MainPreviewEnvironment = { development: true, nodeEnv: 'development', screenPreview: '1', localDevelopment: '1', tokenServerUrl: 'http://localhost:8787' };
test('main preview requires every explicit development guard', () => {
  assert.equal(mainPreviewAllowed(local), true);
  assert.equal(MAIN_PREVIEW_USER_ID, 'c2-preview');
  for (const patch of [{ development: false }, { nodeEnv: 'production' }, { screenPreview: undefined }, { localDevelopment: undefined }]) {
    assert.equal(mainPreviewAllowed({ ...local, ...patch }), false);
  }
});
test('main preview refuses real account configuration including partial configuration', () => {
  for (const patch of [{ supabaseUrl: 'https://real.supabase.co' }, { supabaseKey: 'real-public-key' }, { supabaseUrl: 'https://real.supabase.co', supabaseKey: 'real-public-key' }]) {
    assert.equal(mainPreviewAllowed({ ...local, ...patch }), false);
  }
});
test('main preview only permits loopback service endpoints', () => {
  for (const tokenServerUrl of ['http://localhost:8787', 'http://127.0.0.1:8787', 'http://[::1]:8787']) assert.equal(mainPreviewAllowed({ ...local, tokenServerUrl }), true);
  for (const tokenServerUrl of ['https://production.example.com', 'http://localhost.evil.test:8787', 'file://localhost/tmp', 'broken', '']) assert.equal(mainPreviewAllowed({ ...local, tokenServerUrl }), false);
});
