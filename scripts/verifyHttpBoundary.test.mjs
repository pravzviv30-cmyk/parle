import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('the API child survives malformed authority, bad JSON, audio overflow and an interrupted upload', () => {
  const harness = fileURLToPath(new URL('./verifyHttpBoundary.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--experimental-strip-types', harness], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS /m);
});
