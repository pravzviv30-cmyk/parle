import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { guiltIn } from '../copy/guilt.ts';
import { ORB_COPY, tutorOrbState } from './orbState.ts';

describe('the tutor circle — what it says is decided from the facts (F542)', () => {
  test('the orb reads away, checking, no speaking time, and ready from the facts and nothing else', () => {
    assert.equal(tutorOrbState({ live: false, checking: false, canStart: null }).state, 'error', 'servers away is the away state');
    assert.equal(tutorOrbState({ live: false, checking: false, canStart: true }).state, 'error', 'a plan cannot start a session with no server behind it');
    assert.equal(tutorOrbState({ live: true, checking: true, canStart: false }).state, 'connecting', 'a probe in flight is the most current fact');
    assert.equal(tutorOrbState({ live: false, checking: true, canStart: null }).title, 'Connecting', 'a retry gives immediate, human-readable acknowledgement');
    const spent = tutorOrbState({ live: true, checking: false, canStart: false });
    assert.equal(spent.state, 'idle', 'no speaking time is a quiet circle, not a violet invitation and not a fourth traffic light');
    assert.doesNotMatch(spent.title, /\d|minute|buy|plan/i, 'the spent caption names no number, no reason and no purchase');
    assert.equal(tutorOrbState({ live: true, checking: false, canStart: true }).state, 'ready');
    assert.equal(tutorOrbState({ live: true, checking: false, canStart: null }).state, 'ready', 'a status nobody could read never refuses a learner the server would let in');
    for (const line of ORB_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d/);
    }
  });
});
