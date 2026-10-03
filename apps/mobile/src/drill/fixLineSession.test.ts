import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixLineSession, FIX_LINE_WINDOW_MS, type FixLinePorts, type FixLineState } from './fixLineSession.ts';

function harness(overrides: Partial<FixLinePorts> = {}) {
  let time = 0; let current = true; let successes = 0;
  const states: FixLineState[] = []; const discarded: string[] = []; const attempts: string[] = [];
  const session = new FixLineSession({ now: () => time, current: () => current, changed: state => states.push(state),
    judge: async attempt => { attempts.push(attempt); return { fixed: true, hint: null }; },
    transcribe: async () => 'J’ai vingt ans.', discard: uri => discarded.push(uri), success: () => { successes++; }, ...overrides });
  return { session, states, discarded, attempts, successes: () => successes, leave: () => { current = false; }, expire: () => { time = FIX_LINE_WINDOW_MS; session.finish(); } };
}
test('a spoken retry is deleted and stays editable until the learner explicitly checks', async () => {
  const h = harness(); await h.session.take('temporary.m4a');
  assert.deepEqual(h.discarded, ['temporary.m4a']); assert.deepEqual(h.attempts, []);
  assert.deepEqual(h.session.snapshot(), { phase: 'editing', attempt: 'J’ai vingt ans.', hint: null });
  h.session.edit('J’ai déjà vingt ans.'); await h.session.check();
  assert.deepEqual(h.attempts, ['J’ai déjà vingt ans.']); assert.equal(h.session.snapshot().phase, 'success'); assert.equal(h.successes(), 1);
  await h.session.check(); h.expire(); assert.equal(h.successes(), 1); assert.equal(h.session.snapshot().phase, 'success');
});
test('late transcription after leaving, expiry or a typed replacement cannot overwrite words and always deletes the take', async () => {
  for (const reason of ['leave', 'expire', 'dispose', 'type']) {
    let resolve: (value: string) => void = () => {};
    const h = harness({ transcribe: () => new Promise(done => { resolve = done; }) });
    const pending = h.session.take('temporary.m4a');
    if (reason === 'leave') h.leave(); else if (reason === 'expire') h.expire(); else if (reason === 'dispose') h.session.dispose(); else h.session.edit('typed replacement');
    const prior = h.session.snapshot(); resolve('stale transcript'); await pending;
    assert.deepEqual(h.session.snapshot(), prior, reason); assert.deepEqual(h.discarded, ['temporary.m4a']); assert.deepEqual(h.attempts, []);
  }
});
test('late checks after exit, scope change, expiry or editing never publish a pass or haptic', async () => {
  for (const reason of ['leave', 'expire', 'dispose', 'edit']) {
    let resolve: (value: { fixed: boolean; hint: null }) => void = () => {}; let signal: AbortSignal | undefined;
    const h = harness({ judge: (_attempt, abort) => { signal = abort; return new Promise(done => { resolve = done; }); } });
    h.session.edit('retry'); const check = h.session.check();
    if (reason === 'leave') h.leave(); else if (reason === 'expire') h.expire(); else if (reason === 'dispose') h.session.dispose(); else h.session.edit('new retry');
    const prior = h.session.snapshot(); resolve({ fixed: true, hint: null }); await check;
    assert.deepEqual(h.session.snapshot(), prior, reason); assert.equal(h.successes(), 0);
    if (reason !== 'leave') assert.equal(signal?.aborted, true);
  }
});
test('uncertainty and vendor failure leave an unjudged retry; one targeted hint allows another try without a grade', async () => {
  for (const [judge, expected] of [[async () => null, 'unavailable'], [async () => { throw new Error('down'); }, 'unavailable'],
    [async () => ({ fixed: false, hint: 'Use avoir for age.' }), 'retry']] as const) {
    const h = harness({ judge }); h.session.edit('Je suis vingt ans.'); await h.session.check();
    assert.equal(h.session.snapshot().phase, expected);
    assert.equal(h.successes(), 0); h.session.edit('J’ai vingt ans.'); assert.equal(h.session.snapshot().phase, 'editing');
  }
});
test('a duplicate Check or a take arriving while checking starts no extra model or transcription work', async () => {
  let count = 0; let resolve: (value: null) => void = () => {};
  const h = harness({ judge: async () => { count++; return new Promise(done => { resolve = done; }); } });
  h.session.edit('retry'); const first = h.session.check(); await h.session.check(); await h.session.take('late.m4a');
  assert.equal(count, 1); assert.deepEqual(h.discarded, ['late.m4a']); resolve(null); await first; h.session.dispose();
});
