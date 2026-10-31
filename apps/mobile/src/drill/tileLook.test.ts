/** The lip tile's four looks in a drill, the choose pick, and the fill-blank gap (drill B v2, UI-016). */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ASIDE_OPACITY, SEND_BACK_LINE, choosePick, sendBackLabel, splitBlank, tileLook } from './tileLook.ts';

describe('tileLook', () => {
  test('every tile rests before a pick', () => {
    assert.equal(tileLook(0, null), 'rest');
    assert.equal(tileLook(3, null), 'rest');
  });
  test('a right pick is right and the others step aside', () => {
    const pick = { index: 1, right: true };
    assert.deepEqual([0, 1, 2].map((i) => tileLook(i, pick)), ['aside', 'right', 'aside']);
  });
  test('a missed pick keeps only the picked edge, never a right look', () => {
    const pick = { index: 2, right: false };
    assert.deepEqual([0, 1, 2].map((i) => tileLook(i, pick)), ['aside', 'aside', 'picked']);
  });
  test('a set-aside tile stays readable', () => {
    assert.ok(ASIDE_OPACITY >= 0.4 && ASIDE_OPACITY < 1);
  });
});

describe('choosePick', () => {
  test('reads the index the drill answered with, and whether it was good', () => {
    assert.deepEqual(choosePick('1', 'good'), { index: 1, right: true });
    assert.deepEqual(choosePick('0', 'miss'), { index: 0, right: false });
    assert.deepEqual(choosePick('0', 'typo'), { index: 0, right: false });
  });
  test('is null with nothing settling or an attempt that is not an index', () => {
    assert.equal(choosePick(null, 'good'), null);
    assert.equal(choosePick('1', null), null);
    assert.equal(choosePick('voudrais', 'good'), null);
    assert.equal(choosePick('', 'good'), null);
    assert.equal(choosePick('-1', 'good'), null);
    assert.equal(choosePick('1.5', 'good'), null);
  });
});

describe('splitBlank', () => {
  test('splits around the gap', () => {
    assert.deepEqual(splitBlank('Je ____ un café.'), { before: 'Je ', after: ' un café.' });
    assert.deepEqual(splitBlank('Je vous dois ____ ?'), { before: 'Je vous dois ', after: ' ?' });
  });
  test('is null without a gap', () => {
    assert.equal(splitBlank('Je voudrais un café.'), null);
    assert.equal(splitBlank('a_b'), null);
  });
});

describe('the landed word', () => {
  test('is a button named for sending its word back, with the one line under it', () => {
    assert.equal(sendBackLabel('voudrais'), 'Send «voudrais» back');
    assert.equal(SEND_BACK_LINE, 'Tap the word in the sentence to send it back.');
  });
});
