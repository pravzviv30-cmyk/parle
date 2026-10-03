import assert from 'node:assert/strict';
import { test } from 'node:test';
import { terminalServiceFailure } from './serviceFailure.ts';

test('only an unrecoverable live pipeline failure can end a session for refund', () => {
  const live = { kind: 'tts_error', recoverable: false, ended: false, learnerPresent: true, voiceless: false };
  assert.equal(terminalServiceFailure(live), 'tts_error');
  for (const patch of [{ recoverable: true }, { recoverable: undefined }, { ended: true }, { learnerPresent: false }, { voiceless: true }, { kind: 'disconnected' }, { kind: 'manual-leave' }, { kind: 'time-limit' }, { kind: 'safety' }, { kind: 'memory-failure' }]) {
    assert.equal(terminalServiceFailure({ ...live, ...patch }), null);
  }
  assert.equal(terminalServiceFailure({ ...live, kind: 'llm_error', voiceless: true }), 'llm_error');
});
