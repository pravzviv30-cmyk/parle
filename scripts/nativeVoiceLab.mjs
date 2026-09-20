/** Local-only microphone comparison. Never a public token endpoint. */
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { AccessToken, RoomConfiguration, TrackSource } from 'livekit-server-sdk';
import { NATIVE_EVAL_AGENT, NATIVE_EVAL_SECONDS } from '../services/tutor-agent/src/nativeEvalPolicy.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...parse(readFileSync(join(root, 'services/token-server/.env'))), ...process.env };
if (env.LUVANI_NATIVE_EVAL !== '1') throw new Error('Explicit LUVANI_NATIVE_EVAL=1 is required.');
for (const name of ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']) {
  if (!env[name]) throw new Error(`Missing ${name}`);
}
const origin = 'http://localhost:8890';
const nonce = randomBytes(32).toString('hex');
const ledger = join(root, '.native-voice-eval');
mkdirSync(ledger, { recursive: true, mode: 0o700 });
const page = readFileSync(new URL('./nativeVoiceLab.html', import.meta.url), 'utf8').replaceAll('__NONCE__', nonce);
const sdk = readFileSync(join(root, 'node_modules/livekit-client/dist/livekit-client.umd.js'));

const server = createServer(async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('content-security-policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; connect-src 'self' ${new URL(env.LIVEKIT_URL).origin}; media-src 'self' blob:; frame-ancestors 'none'`);
  // Reject DNS rebinding as well as cross-origin token requests.
  if (req.headers.host !== 'localhost:8890') { res.writeHead(403); res.end(); return; }
  if (req.method === 'GET' && req.url === '/') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(page); return; }
  if (req.method === 'GET' && req.url === '/livekit.js') { res.setHeader('content-type', 'text/javascript'); res.end(sdk); return; }
  if (req.method !== 'POST' || req.url !== '/session') { res.writeHead(404); res.end(); return; }
  if (req.headers.origin !== origin || req.headers['x-lab-nonce'] !== nonce) { res.writeHead(403); res.end(); return; }
  try {
    const now = Date.now();
    let slot = -1;
    for (let i = 0; i < 20; i++) {
      const path = join(ledger, `${i}.json`);
      if (existsSync(path)) {
        const previous = JSON.parse(readFileSync(path, 'utf8'));
        if (previous.expiresAt > now) { res.writeHead(429); res.end('The last test is still reserved. Wait up to five minutes.'); return; }
      } else if (slot < 0) slot = i;
    }
    if (slot < 0) { res.writeHead(429); res.end('The 20-session comparison allowance is used. Review costs before continuing.'); return; }
    const expiresAt = now + NATIVE_EVAL_SECONDS * 1000;
    // Reserve BEFORE minting; failed/abandoned starts still count. No transcript,
    // identity or credential is persisted. Exclusive create prevents double admission.
    writeFileSync(join(ledger, `${slot}.json`), JSON.stringify({ expiresAt }), { flag: 'wx', mode: 0o600 });
    const room = `native-eval-${randomUUID()}`;
    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: `native-eval-${randomUUID()}`, ttl: 30,
      metadata: JSON.stringify({ nativeEvalExpiresAt: expiresAt }),
    });
    token.addGrant({ roomJoin: true, room, canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false });
    token.roomConfig = new RoomConfiguration({ name: room, maxParticipants: 2, emptyTimeout: 30, departureTimeout: 5,
      agents: [{ agentName: NATIVE_EVAL_AGENT }] });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ url: env.LIVEKIT_URL, token: await token.toJwt(), expiresAt }));
  } catch { res.writeHead(503); res.end('The comparison could not start. Check the local server configuration.'); }
});
server.listen(8890, '127.0.0.1', () => console.log(`Private voice comparison: ${origin}. No paid session begins until Start is pressed.`));
