/**
 * The acoustic panel moved to the head of the sound check — F584.
 *
 * It used to sit partway down My French, which is a page a learner reads. This
 * is the screen where they open their mouth, and instructions two taps from the
 * doing are a leaflet. Nothing about the panel's content changed: the cue is
 * authored per phoneme and the pair is a real minimal pair, both from
 * `myfrench/acoustic.ts`, and no score or badge is invented in either place.
 *
 * The question this file asks is the narrow one the move introduced: WHICH
 * sound the panel is about. It is the learner's last measured check and nothing
 * else, because a check is the only place in this app where audio is compared
 * against a known reference, and a panel about an unmeasured sound would be the
 * invented measurement PEDAGOGY.md refuses.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { headSound } from './headSound.ts';
import type { SoundCheckEvidence } from './model.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const check = (at: number, phoneme: string | null, missionId = 'cafe'): SoundCheckEvidence => ({
  missionId,
  reference: 'Merci, au revoir',
  at,
  kind: phoneme === null ? 'self-guided' : 'assessed-focus',
  focus: null,
  phoneme,
});

describe('the sound to tune comes from a measurement, or from nowhere — F584', () => {
  test('the head panel names the learner last measured sound, across every situation', () => {
    // A sound belongs to the learner rather than to the room it was noticed in,
    // so the newest measured check wins whichever mission it came from.
    assert.equal(headSound([check(10, 'y', 'cafe'), check(20, 'ʁ', 'hotel')]), 'ʁ');
    assert.equal(headSound([check(20, 'ʁ', 'hotel'), check(10, 'y', 'cafe')]), 'ʁ', 'the answer depends on the order on disk');

    // A self-guided attempt names no sound. It must not hide a measured one:
    // saying it aloud this morning is not evidence that yesterday's sound
    // stopped being worth practising.
    assert.equal(headSound([check(10, 'y'), check(30, null)]), 'y', 'an unmeasured attempt buried a measured sound');
    // An empty symbol is the same absence written differently.
    assert.equal(headSound([check(10, 'y'), check(30, '')]), 'y');
  });

  test('a learner with nothing measured gets no panel rather than a guessed sound', () => {
    assert.equal(headSound([]), null, 'a first check invented a sound to talk about');
    assert.equal(headSound([check(1, null), check(2, null)]), null, 'self-guided attempts were read as a measurement');
  });

  test('the sound check draws the panel above the line, and asks for the sound rather than choosing one', () => {
    const screen = stripComments(read('./SoundCheckScreen.tsx'));
    assert.match(screen, /loadSoundChecks\(\{ strict: true \}\)/, 'a corrupt history can be mistaken for no measured sound');
    assert.match(screen, /acousticFor\(headSound\(evidence\)\)/, 'the sound check picks its own sound instead of reading the checks');
    assert.match(screen, /readOwner\.scope === scopeGeneration\(\)[\s\S]*?readOwner\.userId === activeUserId\(\)/,
      'the measured focus is not tied to its storage owner');
    assert.match(screen, /const shownAcoustic = ownerMatches \? acoustic : null/, 'a prior account can show its measured focus before the new read lands');
    assert.match(screen, /<AcousticCard acoustic=\{shownAcoustic\} \/>/, 'the sound check draws no acoustic panel');
    // Absent rather than empty when there is nothing measured or the read is unknown.
    assert.match(screen, /shownAcoustic !== null && shownPhase !== 'result'/, 'the panel is drawn without a current measured sound');
    // Above the line to say, which is the whole point of moving it.
    const panelAt = screen.indexOf('<AcousticCard');
    const lineAt = screen.indexOf('fitDisplay(shownReference)');
    assert.ok(panelAt !== -1 && lineAt !== -1, 'the sound check lost its panel or its reference line; this test is stale');
    assert.ok(panelAt < lineAt, 'the acoustic panel is drawn below the line it is instructions for');

    // And the panel still stops its own voice when the screen goes, which is
    // F304 and is the one thing that follows a learner off a screen.
    const panel = stripComments(read('../myfrench/AcousticCard.tsx'));
    assert.match(
      panel.replace(/\s+/g, ' '),
      /useEffect\(\(\) => \(\) => tutorVoice\.stop\(\), \[\]\)/,
      'the acoustic panel starts a voice and never stops it',
    );
    // Every control that plays says what it will play, rather than "Listen".
    const plays = (panel.match(/tutorVoice\.speak\(/g) ?? []).length;
    const named = (panel.match(/accessibilityLabel=\{`Hear /g) ?? []).length;
    assert.equal(named, plays, `${plays} controls play and ${named} of them say what they will play`);
    // No score, no percentage, no badge: the panel says how a sound is made.
    assert.ok(!panel.includes('%'), 'the acoustic panel carries a percentage');
    assert.doesNotMatch(panel, /Mastered|Contrast/, 'a badge nobody can earn is back on the minimal pair');
  });
});
