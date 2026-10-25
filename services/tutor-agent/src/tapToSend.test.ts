/**
 * Tap-to-send (tapToSend.ts) on fake timers against a recording session. The
 * real SDK's behaviour under the same calls is in tapToSendSdk.test.ts.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ServerMessage } from '@luvani/core';
import { TAP_SEND_CAP_MS, TAP_SEND_WARN_MS, TapToSend, tapToSendEnabled, type TapSession } from './tapToSend.ts';

function manualTimers() {
  let now = 0;
  const due: { at: number; fn: () => void }[] = [];
  return {
    setTimeout: (fn: () => void, ms: number) => { const entry = { at: now + ms, fn }; due.push(entry); return entry; },
    clearTimeout: (handle: unknown) => { const i = due.indexOf(handle as never); if (i >= 0) due.splice(i, 1); },
    advance(ms: number) {
      now += ms;
      for (let e = due.sort((a, b) => a.at - b.at)[0]; e && e.at <= now; e = due.sort((a, b) => a.at - b.at)[0]) { due.shift(); e.fn(); }
    },
  };
}

function setUp(saved: unknown = { detector: 'the default audio detector' }, voiceless = false, live = true) {
  const updates: unknown[] = [];
  let commits = 0;
  const session: TapSession = {
    turnDetection: saved,
    updateOptions(options) { updates.push(options.turnHandling.turnDetection); },
    commitUserTurn() { commits += 1; },
  };
  const held: boolean[] = [];
  const published: ServerMessage[] = [];
  const timers = manualTimers();
  const tap = new TapToSend(() => session, { setHeldTurn: (open) => held.push(open) }, (m) => published.push(m), timers, { voiceless });
  if (live) tap.markLive();
  return { tap, updates, commits: () => commits, held, published, timers };
}

const states = (published: ServerMessage[]) =>
  published.flatMap((m) => (m.t === 'held-turn' ? [m.state] : []));

describe('tap-to-send', () => {
  test('switches the session to manual turns and back, acting only on a change', () => {
    const { tap, updates } = setUp();
    tap.setOn(true);
    tap.setOn(true);
    assert.deepEqual(updates, ['manual']);
    tap.setOn(false);
    tap.setOn(false);
    // The detector instance is NOT handed back: that would turn VAD end-of-speech off (see tapToSend.ts).
    assert.deepEqual(updates, ['manual', null]);
  });

  test("a session pinned to 'vad' goes back to 'vad'", () => {
    const { tap, updates } = setUp('vad');
    tap.setOn(true);
    tap.setOn(false);
    assert.deepEqual(updates, ['manual', 'vad']);
  });

  test('the first speech opens a held turn, it warns at 50 s and sends itself at 60 s', () => {
    const { tap, commits, held, published, timers } = setUp();
    tap.setOn(true);
    tap.learnerSpeaking(true);
    tap.learnerSpeaking(true);
    assert.deepEqual(states(published), ['open']);
    assert.deepEqual(held, [true]);
    timers.advance(TAP_SEND_WARN_MS - 1);
    assert.deepEqual(states(published), ['open']);
    timers.advance(1);
    assert.deepEqual(states(published), ['open', 'closing']);
    timers.advance(TAP_SEND_CAP_MS - TAP_SEND_WARN_MS);
    assert.equal(commits(), 1);
    assert.deepEqual(states(published), ['open', 'closing', 'sent']);
    assert.deepEqual(held, [true, false]);
  });

  test('send commits once; a second send, and the cap, find nothing to commit', () => {
    const { tap, commits, published, timers } = setUp();
    tap.setOn(true);
    tap.learnerSpeaking(true);
    tap.send();
    tap.send();
    timers.advance(TAP_SEND_CAP_MS);
    assert.equal(commits(), 1, 'a double commit sends an empty turn');
    assert.deepEqual(states(published), ['open', 'sent']);
  });

  test('send while off, or before any speech, is ignored', () => {
    const { tap, commits, published } = setUp();
    tap.send();
    tap.learnerSpeaking(true); // off: no held turn
    tap.send();
    tap.setOn(true);
    tap.send(); // on, but nothing said yet
    assert.equal(commits(), 0);
    assert.deepEqual(states(published), []);
  });

  test('switching off mid-recording sends what they said, then restores turn detection', () => {
    const { tap, commits, updates, published, timers } = setUp();
    tap.setOn(true);
    tap.learnerSpeaking(true);
    tap.setOn(false);
    assert.equal(commits(), 1);
    assert.deepEqual(updates, ['manual', null]);
    timers.advance(TAP_SEND_CAP_MS);
    assert.equal(commits(), 1, 'the cap timer outlived the switch');
    assert.deepEqual(states(published), ['open', 'sent']);
  });

  test('a failed commit is logged, and the turn still reads as sent', (t) => {
    const errors: unknown[][] = [];
    t.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args); });
    const published: ServerMessage[] = [];
    const session = { turnDetection: undefined, updateOptions() {}, commitUserTurn() { throw new Error('AgentSession is not running'); } };
    const failing = new TapToSend(() => session, { setHeldTurn() {} }, (m) => published.push(m));
    failing.markLive();
    failing.setOn(true);
    failing.learnerSpeaking(true);
    failing.send();
    failing.stop();
    assert.equal(errors.length, 1);
    assert.deepEqual(states(published), ['open', 'sent']);
  });

  test('going typed sends a held turn, restores detection, and refuses on until voice comes back', () => {
    const { tap, commits, updates, published } = setUp();
    tap.setOn(true);
    tap.learnerSpeaking(true);
    tap.setVoiceless(true);
    assert.equal(commits(), 1, 'what they said was dropped when they went typed');
    assert.deepEqual(updates, ['manual', null]);
    tap.setOn(true);
    assert.equal(tap.on, false, 'a typed session held a microphone open');
    tap.setVoiceless(false);
    tap.setOn(true);
    assert.equal(tap.on, true, 'the re-sent switch after back-to-voice was ignored');
    assert.deepEqual(updates, ['manual', null, 'manual']);
    assert.deepEqual(states(published), ['open', 'sent']);
  });

  test('a session that starts typed starts quiet, and switching to voice lets it turn on', () => {
    const { tap, updates } = setUp(undefined, true);
    tap.setOn(true);
    assert.deepEqual(updates, [], 'manual turns in a typed start');
    tap.setVoiceless(false);
    tap.setOn(true);
    assert.deepEqual(updates, ['manual']);
  });

  test('a switch that arrives before the session has started is applied once it is live', () => {
    const { tap, updates } = setUp(undefined, false, false);
    tap.setOn(true);
    assert.deepEqual(updates, [], 'updateOptions before session.start replaces the default detector for life');
    tap.markLive();
    assert.deepEqual(updates, ['manual']);
    tap.markLive();
    assert.deepEqual(updates, ['manual'], 'replayed twice');
  });

  test('an early on then off leaves nothing to replay', () => {
    const { tap, updates } = setUp(undefined, false, false);
    tap.setOn(true);
    tap.setOn(false);
    tap.markLive();
    assert.deepEqual(updates, []);
  });

  test('Send while the tutor is speaking waits for it to stop, and only then says sent', () => {
    const { tap, commits, held, published } = setUp();
    tap.setOn(true);
    tap.learnerSpeaking(true);
    tap.agentState('speaking');
    tap.send();
    tap.send();
    assert.equal(commits(), 0, 'the SDK drops a commit over an uninterruptible line');
    assert.deepEqual(states(published), ['open'], 'sent was published for a turn that never ran');
    assert.deepEqual(held, [true], 'the rescue came back while the turn was still waiting');
    tap.agentState('listening');
    assert.equal(commits(), 1);
    assert.deepEqual(states(published), ['open', 'sent']);
    assert.deepEqual(held, [true, false]);
  });

  test('the cap landing while the tutor speaks is deferred the same way', () => {
    const { tap, commits, timers } = setUp();
    tap.setOn(true);
    tap.learnerSpeaking(true);
    tap.agentState('speaking');
    timers.advance(TAP_SEND_CAP_MS);
    assert.equal(commits(), 0);
    tap.agentState('listening');
    assert.equal(commits(), 1);
  });

  test('LUVANI_TAP_TO_SEND=0 switches it off; anything else leaves it on', () => {
    assert.equal(tapToSendEnabled({}), true);
    assert.equal(tapToSendEnabled({ LUVANI_TAP_TO_SEND: '1' }), true);
    assert.equal(tapToSendEnabled({ LUVANI_TAP_TO_SEND: '0' }), false);
  });
});
