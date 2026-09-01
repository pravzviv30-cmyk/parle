import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import type { PathNode } from '@luvani/core';

import { statusLine, momentAnswer, MOMENT_ANSWER_MS } from './statusLine.ts';
import { TUTOR_NAME } from '../tutor/tutorName.ts';

const node = (over: Partial<PathNode> = {}): PathNode => ({
  id: 'topic:my-job',
  title: 'My job',
  sub: 'Talked about once',
  kind: 'topic',
  phraseKeys: [],
  state: 'available',
  isNext: false,
  ...over,
});

describe('the line under a node title', () => {
  test('a still-being-written topic says the tutor is writing it', () => {
    // Locked covers two different things now. A locked topic is one the learner
    // has ALREADY talked about, waiting on its drills; telling them their
    // conversations will write it describes something that already happened.
    assert.equal(statusLine(node({ state: 'locked', kind: 'topic' })), `${TUTOR_NAME} is still writing this one`);
  });

  test('the promise before any conversation is unchanged', () => {
    assert.equal(statusLine(node({ state: 'locked', kind: 'mine' })), 'Your conversations write this one');
  });

  test('nothing here scolds, and nothing carries a number', () => {
    // Mid-app copy never carries digits, and no state is phrased as a failure.
    for (const state of ['complete', 'needs-review', 'in-progress', 'locked', 'available'] as const) {
      const line = statusLine(node({ state }));
      assert.ok(!/\d/.test(line), `"${line}" carries a number`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.ok(line.length > 0);
    }
  });

  test('the other states still say what they always said', () => {
    assert.equal(statusLine(node({ state: 'complete' })), 'Learned');
    assert.equal(statusLine(node({ state: 'needs-review' })), 'Ready to come back to');
    assert.equal(statusLine(node({ state: 'in-progress' })), 'Started');
    assert.equal(statusLine(node({ state: 'available', sub: 'Talked about twice' })), 'Talked about twice');
  });
});

describe('the answer to "Give me a moment"', () => {
  test('the tap gets a receipt, and it reports the tutor rather than the learner', () => {
    // The learner asked for time. What they are told back is what the tutor is
    // doing about it, because the alternative is a sentence about their pause.
    assert.equal(momentAnswer(TUTOR_NAME), `${TUTOR_NAME} will wait.`);
    assert.ok(momentAnswer().includes(TUTOR_NAME));
  });

  test('it never says the one thing PEDAGOGY.md forbids saying to someone who paused', () => {
    // "No take your time" is written into the invariant by name, so the answer
    // to this button is the one place it would most easily slip back in.
    assert.doesNotMatch(momentAnswer(), /take your time/i);
  });

  test('it is a notice, not a warning, and carries nothing to be measured by', () => {
    const line = momentAnswer();
    assert.ok(!/\d/.test(line), `"${line}" carries a number`);
    assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
    assert.doesNotMatch(line, /sorry|wrong|slow|stuck|struggl|problem|hurry|still/i);
    assert.ok(line.length <= 40, `"${line}" is longer than a glance`);
  });

  test('the receipt fades before the grace it acknowledges runs out', () => {
    // MOMENT_GRACE_MS agent-side is 20s. A line that vanished exactly then
    // would be read as a timer, and a timer is a thing to be measured by.
    assert.ok(MOMENT_ANSWER_MS > 0 && MOMENT_ANSWER_MS < 20_000);
  });
});

describe('asking for time is answered, and answered where it can be read', () => {
  test('the learner who asks for time is answered in words they can read', () => {
    // F50 claims two things and needs two tests. The agent side proves the
    // silence: nothing is spoken, nothing is published, no rung moves. That is
    // the half a learner cannot see, and on its own it is indistinguishable from
    // a button that does nothing at all.
    //
    // This is the other half. Somebody who taps a control is owed a receipt, and
    // for this control it has to be a readable one: the learner may be on a
    // train, or wearing headphones in a room with other people, and the whole
    // reason they pressed it is that they did not want to be spoken to yet.
    const line = momentAnswer(TUTOR_NAME);

    assert.ok(line.trim().length > 0, 'a control that answers with nothing is a control that did nothing');
    assert.ok(line.includes(TUTOR_NAME), 'and it says who is waiting, because that is the fact being reported');
    assert.doesNotMatch(line, /\d/, 'no countdown: this is a receipt for a tap, not a clock');

    // PEDAGOGY.md names this phrase specifically. Shipping it as the answer to
    // this button would put the banned sentence on screen at the exact moment
    // it was banned for.
    assert.doesNotMatch(line, /take your time/i, 'the one thing never to say to a learner who has gone quiet');
    assert.doesNotMatch(line, /\b(wrong|slow|stuck|struggl|worry|worried|sorry)\b/i, 'and nothing that reads as a remark on why they paused');
  });

  test('the answer reaches the screen, and never the voice', () => {
    // A tripwire, in the wiring.test.ts idiom: the line above is only an answer
    // if something renders it.
    const screen = readFileSync(fileURLToPath(new URL('../ConvoScreen.tsx', import.meta.url)), 'utf8');

    assert.match(screen, /momentTaps > 0 \?[\s\S]{0,400}momentAnswer\(\)/, 'the answer has to be rendered when the control is used');
    assert.match(screen, /accessibilityLiveRegion="polite"/, 'and announced quietly, since a learner who cannot see it still asked');

    const asked = screen.slice(screen.indexOf('const askForAMoment'), screen.indexOf('const askForAMoment') + 260);
    assert.match(asked, /live\.sendMoment\(\)/, 'the tap tells the agent');
    assert.doesNotMatch(asked, /sendSay|sendHear|sendHelp/, 'and asks for nothing to be said out loud');
  });
});
