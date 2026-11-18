import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createSocketServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { exchange } from './httpBoundaryExchange.mjs';

test('the API child survives malformed authority, bad JSON, audio overflow and an interrupted upload', () => {
  const harness = fileURLToPath(new URL('./verifyHttpBoundary.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--experimental-strip-types', harness], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS /m);
});

test('an upload the server cuts off mid-body counts as refused, not as a harness failure', async () => {
  const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  const cutter = createSocketServer(socket => socket.once('data', () => socket.resetAndDestroy()));
  const refuser = createServer((req, res) => { res.writeHead(413); res.end(); req.resume(); });
  try {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1);
    assert.equal(await exchange(await listen(cutter), '/drill/score', big, { 'content-length': String(big.length) }), 'reset');
    assert.equal(await exchange(await listen(refuser), '/drill/score', 'x', { 'content-length': '1' }), 413);
  } finally {
    await Promise.all([cutter, refuser].map(server => new Promise(resolve => server.close(resolve))));
  }
});
