import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
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
    assert.equal(await exchange(await listen(cutter), '/drill/score', big, { 'content-length': String(2 * big.length) }, { unfinished: true }), 'reset');
    assert.equal(await exchange(await listen(refuser), '/drill/score', 'x', { 'content-length': '1' }), 413);
  } finally {
    await Promise.all([cutter, refuser].map(server => new Promise(resolve => server.close(resolve))));
  }
});

test('a reset after the whole body was sent still fails the overflow check', async () => {
  const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  // Answers 413 with a body it never sends, then resets mid-upload: the status must survive the reset.
  const answersThenCuts = createSocketServer(socket => socket.once('data', () => {
    socket.write('HTTP/1.1 413 Payload Too Large\r\nContent-Length: 100\r\nConnection: close\r\n\r\n');
    setTimeout(() => socket.resetAndDestroy(), 50);
  }));
  // Reads the whole body, then hangs up without answering: that is not a refusal.
  const readsThenHangsUp = createServer((req) => { req.resume(); req.once('end', () => req.socket.destroy()); });
  try {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1);
    assert.equal(await exchange(await listen(answersThenCuts), '/drill/score', big, { 'content-length': String(2 * big.length) }, { unfinished: true }), 413);
    await assert.rejects(exchange(await listen(readsThenHangsUp), '/drill/score', big, { 'content-length': String(big.length) }));
  } finally {
    await Promise.all([answersThenCuts, readsThenHangsUp].map(server => new Promise(resolve => server.close(resolve))));
  }
});

test('a harness stopped by SIGTERM takes its API child down with it', async (t) => {
  const harness = spawn(process.execPath, ['--experimental-strip-types', fileURLToPath(new URL('./verifyHttpBoundary.mjs', import.meta.url))], { stdio: 'ignore' });
  const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  let child;
  t.after(() => { if (child && alive(child)) process.kill(child, 'SIGKILL'); if (harness.exitCode === null) harness.kill('SIGKILL'); });
  for (let n = 0; n < 250 && !child; n++) {
    child = Number(spawnSync('pgrep', ['-P', String(harness.pid)], { encoding: 'utf8' }).stdout.trim().split('\n')[0]) || undefined;
    if (!child) await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.ok(child, 'the harness must start its API child');
  const exited = new Promise(resolve => harness.once('exit', (code, signal) => resolve({ code, signal })));
  harness.kill('SIGTERM');
  assert.deepEqual(await exited, { code: 1, signal: null }, 'the harness must catch SIGTERM and exit non-zero');
  for (let n = 0; n < 100 && alive(child); n++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(alive(child), false, 'the API child must not outlive its harness');
});

test('only an upload left unfinished can count a reset as refused', async () => {
  const cutter = createSocketServer(socket => socket.once('data', () => socket.resetAndDestroy()));
  const port = await new Promise(resolve => cutter.listen(0, '127.0.0.1', () => resolve(cutter.address().port)));
  try {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1);
    assert.equal(await exchange(port, '/drill/score', big, { 'content-length': String(2 * big.length) }, { unfinished: true }), 'reset');
    await assert.rejects(exchange(port, '/drill/score', big, { 'content-length': String(big.length) }), 'a finished upload that was reset is not a refusal');
  } finally {
    await new Promise(resolve => cutter.close(resolve));
  }
});
