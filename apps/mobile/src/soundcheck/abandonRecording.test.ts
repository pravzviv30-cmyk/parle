import assert from 'node:assert/strict';
import { test } from 'node:test';

import { abandonSoundCheckRecording } from './abandonRecording.ts';

test('a released sound-check recorder still discards its cached take after stop throws synchronously', async () => {
  const removed: Array<string | null> = [];
  let reset = false;
  const released = {
    get uri(): string | null { throw new Error('native recorder released'); },
  };
  await abandonSoundCheckRecording(
    released,
    () => { throw new Error('stop threw before returning a promise'); },
    'file:///temporary/old-sound-check.m4a',
    (uri) => removed.push(uri),
    async () => { reset = true; },
  );
  assert.deepEqual(removed, [
    'file:///temporary/old-sound-check.m4a',
    'file:///temporary/old-sound-check.m4a',
  ]);
  assert.equal(reset, true);
});
