import assert from 'node:assert/strict';
import { test } from 'node:test';
import { temporaryTextShare } from './temporaryTextShare.ts';

test('an exported account file does not outlive the account', async () => {
  let owner = true;
  const calls: string[] = [];
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const exporting = temporaryTextShare({
    available: async () => true, current: () => owner,
    write: async () => { calls.push('write'); started(); await delayed; },
    share: async () => { calls.push('share'); }, remove: async () => { calls.push('remove'); },
  });
  await entered;
  owner = false; release();
  await assert.rejects(exporting, /Account changed/);
  assert.deepEqual(calls, ['write', 'remove']);
});

test('unavailable sharing writes no export and does not report success', async () => {
  let wrote = false;
  await assert.rejects(temporaryTextShare({ available: async () => false, current: () => true,
    write: async () => { wrote = true; }, share: async () => {}, remove: async () => {},
  }), /Sharing is unavailable/);
  assert.equal(wrote, false);
});

test('successful, rejected and partially written shares all remove their temporary file', async () => {
  for (const fail of ['none', 'write', 'share']) {
    const calls: string[] = [];
    const exporting = temporaryTextShare({ available: async () => true, current: () => true,
      write: async () => { calls.push('write'); if (fail === 'write') throw new Error('disk'); },
      share: async () => { calls.push('share'); if (fail === 'share') throw new Error('sharing'); },
      remove: async () => { calls.push('remove'); },
    });
    if (fail === 'none') await exporting; else await assert.rejects(exporting);
    assert.equal(calls.at(-1), 'remove');
  }
});
