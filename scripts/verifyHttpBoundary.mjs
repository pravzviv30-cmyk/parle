/** Full API child-process survival proof. No credentials, database or provider calls. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const proc = spawn(process.execPath, ['--experimental-strip-types', 'services/token-server/src/server.ts'], {
  cwd, env: { PATH: process.env.PATH, PORT: '0', NODE_ENV: 'development', LUVANI_LOCAL_DEVELOPMENT: '1',
    LIVEKIT_API_KEY: 'example-local-key', LIVEKIT_API_SECRET: 'example-local-secret-for-signing-only',
    LIVEKIT_URL: 'ws://localhost:7880', DOTENV_CONFIG_PATH: '/dev/null' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let port;
let log = '';
proc.stdout.on('data', chunk => { log = (log + chunk.toString()).slice(-8192); const found = log.match(/token server on http:\/\/localhost:(\d+)/); if (found) port = Number(found[1]); });
proc.stderr.on('data', chunk => { log = (log + chunk.toString()).slice(-8192); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function exchange(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method: 'POST', headers }, res => {
      res.resume(); res.once('end', () => resolve(res.statusCode));
    });
    req.setTimeout(3000, () => req.destroy(new Error('fixture timeout')));
    req.once('error', reject); req.end(body);
  });
}
async function health() {
  assert.equal(proc.exitCode, null);
  assert.equal((await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) })).status, 200);
}
try {
  for (let n = 0; n < 100 && !port && proc.exitCode === null; n++) await delay(50);
  assert.ok(port > 0, 'child API must publish its actual ephemeral port');
  await health();
  for (const body of ['null', '[]', '42', '{']) {
    assert.equal(await exchange('/session/start', body, { 'content-type': 'application/json' }), 400);
    await health();
  }
  assert.equal(await exchange('/drill/score', Buffer.alloc(2 * 1024 * 1024 + 1), {
    'x-luvani-user': 'synthetic-learner', 'x-luvani-reference': 'bonjour', 'content-length': String(2 * 1024 * 1024 + 1),
  }), 413);
  await health();
  assert.equal(await exchange('/drill/score', Buffer.alloc(2 * 1024 * 1024 + 1), {
    'x-luvani-user': 'synthetic-learner', 'x-luvani-reference': 'bonjour', 'transfer-encoding': 'chunked',
  }), 413);
  await health();
  for (const path of ['/drill/transcribe', '/drill/judge', '/drill/fix-line', '/phrase-audio/manifest']) {
    const limit = path === '/drill/transcribe' ? 2 * 1024 * 1024 : 4096;
    for (const framing of [{ 'content-length': String(limit + 1) }, { 'transfer-encoding': 'chunked' }]) {
      assert.equal(await exchange(path, Buffer.alloc(limit + 1), {
        'x-luvani-user': 'synthetic-learner', ...framing,
      }), 413);
      await health();
    }
  }
  assert.equal(await exchange('/health', '', { host: '%' }), 400);
  await health();
  const socket = createConnection({ host: '127.0.0.1', port });
  socket.on('error', () => {});
  await new Promise(resolve => socket.once('connect', resolve));
  socket.write('POST /drill/score HTTP/1.1\r\nHost: localhost\r\nx-luvani-user: synthetic-learner\r\nx-luvani-reference: bonjour\r\nContent-Length: 1024\r\n\r\npartial');
  await delay(20); socket.destroy(); await delay(20);
  await health();
  assert.ok(!/uncaught|unhandled|ERR_INVALID_URL|Error: payload too large/i.test(log));
  console.log('PASS API child survived malformed authority/JSON, audio overflow and interrupted upload; no providers configured.');
} catch {
  // Never print captured child output: future configuration could contain private values.
  console.error('FAIL isolated HTTP process-survival proof.'); process.exitCode = 1;
} finally {
  proc.kill('SIGTERM');
  const timer = setTimeout(() => proc.kill('SIGKILL'), 2000);
  await new Promise(resolve => { if (proc.exitCode !== null || proc.signalCode !== null) resolve(); else proc.once('exit', resolve); });
  clearTimeout(timer);
}
