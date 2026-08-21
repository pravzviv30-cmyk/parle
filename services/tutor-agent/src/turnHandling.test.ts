import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { turnHandlingFor } from './turnHandling.ts';

const HERE = new URL('.', import.meta.url).pathname;

describe('turn handling — H2, H3 and H6', () => {
  test('a conversation never speculatively generates against the unused pipeline LLM', () => {
    // The framework default is on, with up to three attempts per turn. convo.ts
    // tells that LLM "You are unused; replies are generated out of band", and
    // the StopResponse thrown from onUserTurnCompleted lands after the request
    // has already gone out. Billed, never spoken, and racing the real turn for
    // the same rate limit.
    assert.equal(turnHandlingFor('convo').preemptiveGeneration.enabled, false);
  });

  test('a scripted lesson keeps preemptive generation, which it actually uses', () => {
    // The lesson path really does call session.generateReply and speak what
    // comes back, so speculating ahead of the learner is a genuine win there.
    assert.equal(turnHandlingFor('lesson').preemptiveGeneration.enabled, true);
  });

  test('a learner speaking over an uninterruptible line is buffered, never binned', () => {
    for (const mode of ['convo', 'lesson'] as const) {
      assert.equal(
        turnHandlingFor(mode).interruption.discardAudioIfUninterruptible,
        false,
        `${mode} still deletes what the learner said`,
      );
    }
  });

  test('phantom barge-ins are still held off, because a speakerphone hears the tutor', () => {
    const { interruption } = turnHandlingFor('convo');
    assert.ok(interruption.minDuration >= 1_000, 'a short blip must not count as the learner talking');
    assert.ok(interruption.minWords >= 2, 'an interruption needs confirmed words, not just energy');
  });

  test('turn detection is only overridden when the flag actually asks for it', () => {
    assert.equal(turnHandlingFor('convo').turnDetection, undefined);
    assert.equal(turnHandlingFor('convo', { turnDetection: 'vad' }).turnDetection, 'vad');
    assert.equal(turnHandlingFor('convo', { turnDetection: 'nonsense' }).turnDetection, undefined);
  });

  test('the turn-detection note matches the plugins actually installed', () => {
    // The worker used to say the semantic turn detector "stays the default" and
    // protects hesitating beginners. No such plugin is installed, so it never
    // did. A comment describing protection a learner does not have is worse
    // than no comment, and this is the check that keeps the two honest.
    const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const installed = Object.keys(pkg.dependencies ?? {}).some((d) => d.includes('turn-detector'));
    const sources = ['agent.ts', 'turnHandling.ts']
      .map((f) => readFileSync(join(HERE, f), 'utf8'))
      .join('\n');

    if (!installed) {
      assert.doesNotMatch(
        sources,
        /semantic turn detector[\s\S]{0,200}?stays the default/i,
        'the worker claims a semantic turn detector is the default and none is installed',
      );
    }
  });
});
