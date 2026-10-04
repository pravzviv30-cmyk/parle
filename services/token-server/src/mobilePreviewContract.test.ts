import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { checkHostedPreview, previewEnvironment } from '../../../scripts/checkMobilePreview.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (name: string) => readFileSync(`${root}${name}`, 'utf8');
const clientKey = `header.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;
const valid = {
  EXPO_PUBLIC_TOKEN_SERVER_URL: 'https://api.luvani.app',
  EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: clientKey,
  EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '0',
  EXPO_PUBLIC_LUVANI_WALL_PREVIEW: '0',
  EXPO_PUBLIC_LUVANI_KEPT_PHRASE_AUDIO: '0',
  EXPO_PUBLIC_LUVANI_WALK_MODE: '0',
};

test('hosted preview refuses laptop addresses, placeholders and privileged keys before making requests', async () => {
  for (const url of [undefined, 'http://api.luvani.app', 'https://localhost', 'https://192.168.1.221',
    'https://[::1]', 'https://foo.local', 'https://api.luvani.example', 'https://example.com',
    'https://api.luvani.app/', 'https://api.luvani.app?key=secret', 'https://user:secret@api.luvani.app']) {
    assert.throws(() => previewEnvironment({ ...valid, EXPO_PUBLIC_TOKEN_SERVER_URL: url }));
  }
  for (const key of ['sb_secret_sensitive', '', `h.${Buffer.from('{"role":"service_role"}').toString('base64url')}.s`]) {
    assert.throws(() => previewEnvironment({ ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: key }));
  }
  for (const name of ['EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT', 'EXPO_PUBLIC_LUVANI_WALL_PREVIEW',
    'EXPO_PUBLIC_LUVANI_KEPT_PHRASE_AUDIO', 'EXPO_PUBLIC_LUVANI_WALK_MODE']) {
    assert.throws(() => previewEnvironment({ ...valid, [name]: '1' }));
    assert.throws(() => previewEnvironment({ ...valid, [name]: undefined }));
  }
  assert.deepEqual(previewEnvironment(valid), { api: 'https://api.luvani.app', supabase: 'https://project.supabase.co' });
  assert.doesNotThrow(() => previewEnvironment({ ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_clientKey' }));
  let calls = 0;
  await assert.rejects(checkHostedPreview({ ...valid, EXPO_PUBLIC_TOKEN_SERVER_URL: undefined }, async () => {
    calls++; return new Response();
  }));
  assert.equal(calls, 0);
});

test('a preview requires API readiness and usable Supabase signing keys, with no redirects or bearer tokens', async () => {
  const requests: string[] = [];
  const fetcher = async (url: string, options: RequestInit) => {
    requests.push(url);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    assert.equal(options.headers, undefined);
    return Response.json(url.endsWith('/health') ? { ok: true, livekitUrl: 'wss://voice.livekit.cloud' }
      : url.endsWith('/ready') ? { ready: true } : { keys: [{ kid: 'test', kty: 'EC' }] });
  };
  await checkHostedPreview(valid, fetcher);
  assert.deepEqual(requests, ['https://api.luvani.app/health', 'https://api.luvani.app/ready',
    'https://project.supabase.co/auth/v1/.well-known/jwks.json']);
  await assert.rejects(checkHostedPreview(valid, async () => new Response('busy', { status: 503 })), /HTTP 503/);
  await assert.rejects(checkHostedPreview(valid, async () => { throw new Error('secret detail'); }), /reached securely/);
  await assert.rejects(checkHostedPreview(valid, async () => new Response('HTML')), /JSON/);
  await assert.rejects(checkHostedPreview(valid, async () => Response.json({ ok: true })), /configured voice/);
  await assert.rejects(checkHostedPreview(valid, async (url: string) => Response.json(url.endsWith('/health')
    ? { ok: true, livekitUrl: 'wss://voice.livekit.cloud' } : { ready: false })), /not ready/);
  await assert.rejects(checkHostedPreview(valid, async (url: string) => Response.json(url.endsWith('/health')
    ? { ok: true, livekitUrl: 'wss://voice.livekit.cloud' } : url.endsWith('/ready') ? { ready: true } : { keys: [] })), /signing keys/);
});

test('remote preview is isolated from store builds and matches the Expo update project', () => {
  const config = JSON.parse(read('apps/mobile/app.json')).expo;
  const manifest = JSON.parse(read('apps/mobile/package.json'));
  const profiles = JSON.parse(read('apps/mobile/eas.json')).build;
  assert.ok(manifest.dependencies['expo-updates']);
  assert.equal(config.updates.url, `https://u.expo.dev/${config.extra.eas.projectId}`);
  assert.equal(config.runtimeVersion.policy, 'fingerprint');
  assert.equal(config.updates.checkAutomatically, 'ON_LOAD');
  assert.equal(profiles.staging.channel, 'preview');
  assert.equal(profiles.staging.environment, 'preview');
  assert.equal(profiles.production.channel, 'production');
  assert.equal(profiles.production.environment, 'production');
  assert.equal(config.ios.usesAppleSignIn, true);
  assert.equal(config.updates.codeSigningCertificate, undefined, 'custom signing needs a separate certificate review');
});

test('automatic updates publish only a successful, trusted main push after checking hosted services', () => {
  const workflow = read('.github/workflows/mobile-preview.yml');
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows: \[gate\]/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /conclusion == 'success'/);
  assert.match(workflow, /event == 'push'/);
  assert.match(workflow, /head_repository\.full_name == github\.repository/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /checkMobilePreview\.mjs && .* update --channel preview --environment preview --platform ios/);
  assert.match(workflow, /EXPO_NO_DOTENV: '1'/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /pull_request_target|--channel production|--branch production|contents: write/);
});
