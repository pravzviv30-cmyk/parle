import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportRecovery, isTemporaryExportName, temporaryExports } from './temporaryExports.ts';

test('a refused export-file deletion remains tracked until an account-reset retry succeeds', async () => {
  let refuse = true;
  let alarms = 0;
  const calls: string[] = [];
  const files = temporaryExports(async uri => { calls.push(uri); if (refuse) throw new Error('disk'); }, () => { alarms++; });
  files.track('sensitive.json');
  await assert.rejects(files.discard('sensitive.json'), /disk/);
  assert.equal(alarms, 1);
  refuse = false;
  await files.reset(['legacy.json']);
  assert.deepEqual(calls, ['sensitive.json', 'sensitive.json', 'legacy.json']);
  await files.reset();
  assert.equal(calls.length, 3);
});


test('a fresh process finds and removes exports whose earlier deletion failed', async () => {
  const disk = new Set(['luvani-export-123-1-account.json', 'luvani-account-data.json', 'recording.m4a', 'other.json']);
  const leftovers = async () => [...disk].filter(isTemporaryExportName);
  const earlier = temporaryExports(async () => { throw new Error('read only'); }, () => {}, leftovers);
  await assert.rejects(earlier.reset(), /read only/);
  // No active Set survives restart. Discovery uses only bounded cache names.
  const restarted = temporaryExports(async uri => { disk.delete(uri); }, () => {}, leftovers);
  await restarted.reset();
  assert.deepEqual([...disk], ['recording.m4a', 'other.json']);
});

test('exports retry a refused startup sweep in session and share one successful recovery', async () => {
  let sweeps = 0;
  let release: () => void = () => {};
  const recover = exportRecovery(async () => {
    sweeps++;
    if (sweeps === 1) throw new Error('disk busy');
    await new Promise<void>(resolve => { release = resolve; });
  });
  const first = recover();
  const second = recover();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sweeps, 2);
  release();
  await Promise.all([first, second]);
  await recover();
  assert.equal(sweeps, 2);
});
