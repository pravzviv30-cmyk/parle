/**
 * "Your sound to tune": which sound Practice leads with, and what it may say
 * about it (notebook Phase 3, 2026-09-27).
 *
 * Three honesty rules are pinned here, because a screen that gets them wrong
 * looks exactly like one that gets them right:
 *
 * - A measured fact appears only when a check the assessor actually measured
 *   named the sound. Scoring is off by default, so most learners never have
 *   one, and a self-guided attempt is practice, never a measurement.
 * - Native audio is a bundled recording or nothing. The phone's synthesiser is
 *   never offered here, so it can never be mistaken for the tutor.
 * - The learner's own voice is never offered, because the app keeps no
 *   recording of it (`speech/discardRecording.ts`).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CAFE_LESSON, getPhoneme, type TutorVoiceKey } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { LESSON_MINUTES, RECORDED_AUDIO } from '../copy/access.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { LESSON_SOUND, SOUND_LEAD, SOUND_LEAD_COPY, recordedLineFor, soundLead, type RecordedItem } from './soundLead.ts';

const NOW = Date.parse('2026-09-27T09:00:00Z');
const VOICE: TutorVoiceKey = 'alexandre';

const ITEMS: readonly RecordedItem[] = [
  { id: 'phrase:situation:cafe-terrace:0', fr: "Bonjour, on peut s'asseoir dehors ?" },
  { id: 'phrase:situation:cafe-first-coffee:0', fr: 'Bonjour, je vais prendre un café.' },
  { id: 'word:rue', fr: 'la rue' },
  { id: 'word:unvoiced', fr: 'bonjourno' },
];
const RECORDINGS = {
  alexandre: {
    'phrase:situation:cafe-terrace:0': 11,
    'phrase:situation:cafe-first-coffee:0': 12,
    'word:rue': 13,
  },
} as const;

const check = (over: Partial<SoundCheckEvidence>): SoundCheckEvidence => ({
  missionId: 'mission:cafe',
  reference: "Un café, s'il vous plaît.",
  at: NOW - 60_000,
  kind: 'assessed-focus',
  focus: 'The r sits at the back of the throat.',
  phoneme: 'ʁ',
  ...over,
});

describe('the sound Practice leads with — notebook Phase 3', () => {
  test('starter and checked labels describe their actual evidence', () => {
    assert.equal(SOUND_LEAD.starterLabel, 'A sound to try');
    assert.equal(SOUND_LEAD.measuredLabel, 'Your focus from the check');
    assert.match(SOUND_LEAD.unassessed, /not a check/);
    assert.match(SOUND_LEAD.measuredScope, /one checked line/);
  });
  test('with nothing measured it is the bonjour lesson\'s own sound, from the inventory', () => {
    const first = CAFE_LESSON.turns[0]!;
    assert.equal(first.target, 'Bonjour', 'the lesson no longer opens on bonjour; the day-one sound is stale');
    assert.equal(LESSON_SOUND.ipa, first.focusPhonemes[0]);
    const phoneme = getPhoneme(LESSON_SOUND.ipa)!;
    assert.ok(phoneme.examples.includes(LESSON_SOUND.example), 'the example word is not the inventory\'s own');
    assert.equal(LESSON_SOUND.example, 'bonjour', 'the day-one example is not the word the lesson opens on');

    const lead = soundLead({ checks: [], now: NOW, voice: VOICE, recordings: RECORDINGS, items: ITEMS })!;
    assert.equal(lead.ipa, LESSON_SOUND.ipa);
    assert.equal(lead.example, 'bonjour');
    assert.equal(lead.cue, phoneme.cue, 'the mouth cue is not the inventory\'s');
    assert.equal(lead.measured, null, 'a sound nobody measured carries a measured fact');
    assert.equal(lead.own, null, 'the learner\'s own recording is offered, and the app keeps none');
  });

  test('a self-guided or unavailable check measures nothing, so the lead stays the lesson sound', () => {
    const unmeasured = [
      check({ kind: 'self-guided', focus: null, phoneme: null }),
      check({ kind: 'unavailable', focus: null, phoneme: null }),
      // A malformed row that names a sound without being measured still
      // measures nothing.
      check({ kind: 'self-guided', phoneme: 'y' }),
    ];
    const lead = soundLead({ checks: unmeasured, now: NOW, voice: VOICE, recordings: RECORDINGS, items: ITEMS })!;
    assert.equal(lead.ipa, LESSON_SOUND.ipa);
    assert.equal(lead.measured, null);
  });

  test('a measured check that named a sound leads, with a timeless measured line and its situation', () => {
    const lead = soundLead({ checks: [check({})], now: NOW, voice: VOICE, recordings: RECORDINGS, items: ITEMS })!;
    assert.equal(lead.ipa, 'ʁ');
    assert.equal(lead.example, getPhoneme('ʁ')!.examples[0]);
    assert.equal(lead.cue, getPhoneme('ʁ')!.cue);
    assert.deepEqual(lead.measured, { line: 'The r sits at the back of the throat.', missionId: 'mission:cafe' });

    // A stored sentence that was only true on the day falls back to the
    // timeless line rather than being read months later.
    const dated = soundLead({ checks: [check({ focus: 'It came up 4 times today.' })], now: NOW, voice: VOICE, recordings: RECORDINGS, items: ITEMS })!;
    assert.doesNotMatch(dated.measured!.line, /\d|today/);

    // The newest measured sound wins; an assessed-clear row names none.
    const newer = soundLead({
      checks: [check({}), check({ phoneme: 'y', focus: null, at: NOW - 1000 }), check({ kind: 'assessed-clear', phoneme: null, focus: null, at: NOW - 10 })],
      now: NOW,
      voice: VOICE,
      recordings: RECORDINGS,
      items: ITEMS,
    })!;
    assert.equal(newer.ipa, 'y');
  });

  test('native audio is a bundled recording that says the example word, or nothing at all', () => {
    // The shortest recorded line with the word as a whole word, so the sound
    // is heard with as little around it as possible.
    const found = recordedLineFor('bonjour', VOICE, RECORDINGS, ITEMS)!;
    assert.equal(found.id, 'phrase:situation:cafe-first-coffee:0');
    assert.equal(found.fr, 'Bonjour, je vais prendre un café.');
    assert.equal(found.asset, 12);
    assert.equal(found.label, RECORDED_AUDIO);

    // Only a whole word counts, only in the chosen voice, and never a line
    // with no recording behind it.
    assert.equal(recordedLineFor('bon', VOICE, RECORDINGS, ITEMS), null, 'a word inside another word counts as the word');
    assert.equal(recordedLineFor('bonjour', 'emilie', RECORDINGS, ITEMS), null, 'another voice fills a missing recording');
    assert.equal(recordedLineFor('très', VOICE, RECORDINGS, ITEMS), null, 'a line with no recording is offered as audio');

    const lead = soundLead({ checks: [], now: NOW, voice: VOICE, recordings: RECORDINGS, items: ITEMS })!;
    assert.equal(lead.native?.asset, 12);
    const silent = soundLead({ checks: [], now: NOW, voice: VOICE, recordings: {}, items: ITEMS })!;
    assert.equal(silent.native, null, 'with no recording the lead offers audio anyway');
  });

  test('the day-one action is the guided lesson, with the shared live-minutes line', () => {
    assert.equal(SOUND_LEAD.lessonCost, LESSON_MINUTES);
    assert.match(SOUND_LEAD.lesson, /bonjour/i, 'the day-one action does not name the bonjour lesson');
    for (const line of SOUND_LEAD_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.doesNotMatch(line, /—|\d|%/, `"${line}" carries an em dash, a digit or a percentage`);
      assert.doesNotMatch(line, /\btutor'?s? voice\b/i, `"${line}" calls some voice the tutor's`);
    }
  });
});
