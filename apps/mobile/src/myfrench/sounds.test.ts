/**
 * The one honest pronunciation line.
 *
 * These exist because this copy used to be decided inside `MyFrenchTab.tsx`,
 * where nothing could reach it. The guard on a stored focus sentence is the
 * part that is genuinely new: a sentence written months ago is read today, and
 * a sentence about "today" was only ever true once.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { guiltIn } from '../copy/guilt.ts';
import type { SoundCheckEvidence, SoundCheckKind } from '../soundcheck/model.ts';
import { SOUND_LINES, latestCheck, soundLine, timeless } from './sounds.ts';

const NOW = Date.parse('2026-09-07T09:00:00Z');
const HOUR = 60 * 60 * 1000;

function check(over: Partial<SoundCheckEvidence> = {}): SoundCheckEvidence {
  return {
    missionId: 'mission:cafe',
    reference: "l'addition, s'il vous plaît",
    at: NOW - HOUR,
    kind: 'assessed-clear',
    focus: null,
    phoneme: null,
    ...over,
  };
}

describe('the sound line — what each kind of check may say', () => {
  test('a situation never checked says nothing at all', () => {
    assert.equal(latestCheck('mission:cafe', []), null);
    assert.equal(soundLine(null), null);
  });

  test('every kind of check has a sentence, and none of them is a number', () => {
    const kinds: SoundCheckKind[] = ['assessed-clear', 'assessed-focus', 'self-guided', 'unavailable'];
    for (const kind of kinds) {
      const line = soundLine(check({ kind }));
      assert.ok(line !== null && line !== '', `${kind} produced no line`);
      assert.doesNotMatch(line, /\d/, `${kind} put a number on a pronunciation claim`);
      assert.equal(guiltIn(line), undefined, `${kind} says "${line}", which carries a banned word`);
      assert.ok(!line.includes('—'), `${kind} carries an em dash`);
    }
  });

  test('an unassessed check says so rather than implying a measurement', () => {
    // PEDAGOGY.md's invariant: a score is never implied unless it came from
    // audio measured against a known reference, and an unscored check says so.
    assert.equal(soundLine(check({ kind: 'self-guided' })), SOUND_LINES.selfGuided);
    assert.equal(soundLine(check({ kind: 'unavailable' })), SOUND_LINES.unavailable);
  });

  test('the latest check wins, whatever order they were stored in', () => {
    const older = check({ at: NOW - 40 * HOUR, kind: 'assessed-clear' });
    const newer = check({ at: NOW - HOUR, kind: 'assessed-focus', focus: 'The u in tu is worth another go' });
    const other = check({ missionId: 'mission:hotel', at: NOW });

    assert.equal(latestCheck('mission:cafe', [newer, older, other])?.at, newer.at);
    assert.equal(latestCheck('mission:cafe', [older, newer, other])?.at, newer.at);
  });
});

describe('the sound line — a stored sentence read months later', () => {
  test('a focus that says nothing about time is passed through as written', () => {
    const focus = 'The u in tu is worth another go';
    assert.ok(timeless(focus));
    assert.equal(soundLine(check({ kind: 'assessed-focus', focus })), focus);
  });

  test('a focus that counts is replaced, because the count was true once', () => {
    assert.equal(timeless('It came up 4 times'), false);
    assert.equal(soundLine(check({ kind: 'assessed-focus', focus: 'It came up 4 times' })), SOUND_LINES.focus);
  });

  test('a focus that dates itself is replaced, however warmly it is worded', () => {
    for (const focus of ['You got closer to it today', 'Yesterday this one drifted', 'This week the u is settling']) {
      assert.equal(timeless(focus), false, `"${focus}" was allowed to date itself`);
      assert.equal(soundLine(check({ kind: 'assessed-focus', focus })), SOUND_LINES.focus);
    }
  });

  test('an assessed focus with nothing stored still says the honest thing', () => {
    assert.equal(soundLine(check({ kind: 'assessed-focus', focus: null })), SOUND_LINES.focus);
    assert.equal(soundLine(check({ kind: 'assessed-focus', focus: '' })), SOUND_LINES.focus);
  });
});
