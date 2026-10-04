#!/usr/bin/env node
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

/** Hosted updates must never contain a laptop address or a privileged backend key. */
export function publicEndpoint(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a configured HTTPS URL.`); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || url.pathname !== '/' || value.endsWith('/') || (url.port && url.port !== '443')
    || isIP(host) || !host.includes('.')
    || /(^|\.)(localhost|local|internal|invalid|example|test)$/.test(host)
    || /(^|\.)example\.(com|org|net)$/.test(host)) {
    throw new Error(`${name} must be a public HTTPS origin without credentials or a trailing slash.`);
  }
  return url.origin;
}

export function previewEnvironment(env) {
  for (const name of ['EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT', 'EXPO_PUBLIC_LUVANI_WALL_PREVIEW',
    'EXPO_PUBLIC_LUVANI_KEPT_PHRASE_AUDIO', 'EXPO_PUBLIC_LUVANI_WALK_MODE']) {
    if (env[name] !== '0') throw new Error(`${name} must be explicitly 0 in the hosted preview environment.`);
  }
  const api = publicEndpoint(env.EXPO_PUBLIC_TOKEN_SERVER_URL, 'EXPO_PUBLIC_TOKEN_SERVER_URL');
  const supabase = publicEndpoint(env.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL');
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  let isAnon = false;
  if (typeof key === 'string' && key.split('.').length === 3) {
    try { isAnon = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* reject */ }
  }
  if (!isAnon && !(typeof key === 'string' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key))) {
    throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY must be a client publishable/anon key; privileged keys are forbidden.');
  }
  return { api, supabase };
}

export async function checkHostedPreview(env = process.env, fetcher = fetch) {
  const { api, supabase } = previewEnvironment(env);
  async function json(url, name) {
    let response;
    try { response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) }); }
    catch { throw new Error(`${name} could not be reached securely.`); }
    if (!response.ok) throw new Error(`${name} failed with HTTP ${response.status}.`);
    try { return await response.json(); } catch { throw new Error(`${name} did not return JSON.`); }
  }
  const health = await json(`${api}/health`, 'Luvani API health');
  if (health.ok !== true || typeof health.livekitUrl !== 'string' || !health.livekitUrl.startsWith('wss://')) {
    throw new Error('The endpoint is not a healthy Luvani API with a configured voice service.');
  }
  const ready = await json(`${api}/ready`, 'Luvani API readiness');
  if (ready.ready !== true) throw new Error('The Luvani API is not ready for hosted clients.');
  const jwks = await json(`${supabase}/auth/v1/.well-known/jwks.json`, 'Supabase authentication');
  if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw new Error('Supabase has no asymmetric signing keys for the Luvani API.');
  }
  return { api, supabase };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkHostedPreview();
    console.log('Hosted preview endpoints are ready. No credential values were logged.');
  } catch (error) {
    console.error(`Remote update blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
