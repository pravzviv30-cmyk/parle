import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('a verified-by that names a describe block rather than a test does not count as passing', async () => {
  // @ts-expect-error plain JavaScript gate module
  const { passingTestTitles } = await import('../../../scripts/gateReporter.mjs');
  const reporter = new URL('../../../scripts/gateReporter.mjs', import.meta.url).pathname;
  const dir = mkdtempSync(path.join(tmpdir(), 'luvani-gate-proof-'));
  try {
    const fixture = path.join(dir, 'fixture.mjs');
    writeFileSync(fixture, `import {describe,test} from 'node:test';
      describe('suite is not evidence',()=>{test('real passing test',()=>{});});
      describe('empty suite',()=>{});
      test('skipped test',{skip:true},()=>{});
      test('todo test',{todo:true},()=>{});
      test('failed test',()=>{throw new Error('expected fixture failure');});`);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_OPTIONS;
    const result = spawnSync(process.execPath, ['--test', '--test-reporter', reporter, fixture], { encoding: 'utf8', env });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /tests 4/);
    assert.deepEqual(passingTestTitles(result.stdout), ['real passing test']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
