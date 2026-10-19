import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IllustrationCue, ILLUSTRATION_MS, illustrationScale } from './IllustrationPolicy.ts';

const visible = { reduced: false, active: true, focused: true, foreground: true };

test('illustration waits for the OS without consuming the first visible gesture', () => {
  const cue = new IllustrationCue();
  assert.equal(cue.decide(undefined, { ...visible, reduced: null }), 'wait');
  assert.equal(cue.decide(undefined, visible), 'play');
  assert.equal(cue.decide(undefined, visible), 'rest');
});

test('reduced motion lands permanently until a new authored event', () => {
  const cue = new IllustrationCue('first');
  assert.equal(cue.decide('first', { ...visible, reduced: true }), 'rest');
  assert.equal(cue.decide('first', visible), 'rest');
  assert.equal(cue.decide('next', visible), 'play');
});

test('hidden or background art does not start a gesture', () => {
  for (const hidden of [{ active: false }, { focused: false }, { foreground: false }]) {
    const cue = new IllustrationCue();
    assert.equal(cue.decide(undefined, { ...visible, ...hidden }), 'rest');
    assert.equal(cue.decide(undefined, visible), 'play');
  }
});

test('a navigation or app interruption settles without replay on return', () => {
  const cue = new IllustrationCue();
  assert.equal(cue.decide(undefined, visible), 'play');
  cue.interrupt();
  assert.equal(cue.decide(undefined, visible), 'rest');
});

test('account changes cannot restart art retained behind the account gate', () => {
  const cue = new IllustrationCue('learner one');
  assert.equal(cue.decide('learner one', visible), 'play');
  cue.interrupt(true);
  assert.equal(cue.decide('learner two', visible), 'rest');
  assert.equal(new IllustrationCue('learner two').decide('learner two', visible), 'play');
});

test('illustration gesture has a bounded lifetime and responsive scale', () => {
  assert.ok(ILLUSTRATION_MS <= 2000);
  assert.equal(illustrationScale(160), 0.5);
  assert.equal(illustrationScale(320), 1);
  for (const width of [0, -1, NaN, Infinity]) assert.equal(illustrationScale(width), 1);
});
