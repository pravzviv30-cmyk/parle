/**
 * A recording that was stopped while it loaded never starts — Phase 3 review
 * (P2), added 2026-09-27.
 *
 * `recordedPlayer.ts` sets the audio mode, which is asynchronous, and only then
 * plays. A stop, a second tap or a departure in that gap used to be ignored:
 * the `.then` played anyway, so a line the learner had just stopped started a
 * moment later, sometimes on the next screen. The gate is the same stop-wins
 * rule `speech/tutorVoice.ts` keeps with its playback generation.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createPlaybackGate, playWhenCurrent } from './playbackGate.ts';

/** A promise the test resolves by hand, so the gap between load and play can be entered. */
function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void } {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('the recorded player plays only what is still wanted', () => {
  test('a changed voice, account or shared playback owner refuses a held load without a new ticket', async () => {
    for (const reason of ['voice', 'account', 'playback owner']) {
      const gate = createPlaybackGate();
      const ready = deferred();
      let current = true;
      let plays = 0;
      const outcome = playWhenCurrent(gate, gate.begin(), () => ready.promise, () => { plays++; }, () => current);
      current = false;
      ready.resolve();
      assert.equal(await outcome, false, reason);
      assert.equal(plays, 0, reason);
    }
  });
  test('a recording stopped before it finished loading never starts', async () => {
    const gate = createPlaybackGate();
    const ready = deferred();
    let plays = 0;
    const ticket = gate.begin();
    const done = playWhenCurrent(gate, ticket, () => ready.promise, () => {
      plays += 1;
    });
    gate.cancel();
    ready.resolve();
    assert.equal(await done, false, 'the play reports it started after a stop');
    assert.equal(plays, 0, 'a stopped recording started once its load finished');
  });

  test('a second tap while the first loads plays only the second', async () => {
    const gate = createPlaybackGate();
    const first = deferred();
    const second = deferred();
    const played: string[] = [];
    const a = playWhenCurrent(gate, gate.begin(), () => first.promise, () => played.push('first'));
    const b = playWhenCurrent(gate, gate.begin(), () => second.promise, () => played.push('second'));
    second.resolve();
    first.resolve();
    assert.deepEqual([await a, await b], [false, true]);
    assert.deepEqual(played, ['second'], 'the older load played over the newer one');
  });

  test('an uninterrupted load plays, and a failed load plays nothing', async () => {
    const gate = createPlaybackGate();
    let plays = 0;
    assert.equal(await playWhenCurrent(gate, gate.begin(), () => Promise.resolve(), () => (plays += 1)), true);
    assert.equal(plays, 1, 'a load nobody interrupted never played');
    const failing = deferred();
    const outcome = playWhenCurrent(gate, gate.begin(), () => failing.promise, () => (plays += 1));
    failing.reject(new Error('audio mode refused'));
    await assert.rejects(outcome, /audio mode refused/, 'a failed load is swallowed, so the caller cannot clear its state');
    assert.equal(plays, 1, 'a failed load played anyway');
  });

  test('the recorded player goes through the gate', () => {
    const body = readFileSync(fileURLToPath(new URL('./recordedPlayer.ts', import.meta.url)), 'utf8').replace(/\s+/g, ' ');
    assert.match(body, /const ticket = gate\.begin\(\);/, 'a play takes no ticket, so a stop cannot cancel it');
    assert.match(body, /playWhenCurrent\(gate, ticket,/, 'the player plays without asking whether it is still wanted');
    assert.doesNotMatch(body, /\.then\(\(\) => \{ player\.pause\(\); player\.replace\(asset\); player\.play\(\); \}\)/, 'the unguarded play is still there');
  });
});
