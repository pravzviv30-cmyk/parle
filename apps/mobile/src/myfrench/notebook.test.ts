/**
 * My French in the notebook system (Phase 3, 2026-09-27): the level and the
 * can-dos earned, the phrase bank with audio, the sounds map, and the one line
 * a first visit reads. Every block is decided here, so the tab stays a layout.
 *
 * The rules pinned below are the ones a screen could get wrong while looking
 * right: no rank name and no points, a can-do reads as earned only by core's
 * rule, the "here" stop is the spine's next scene, a sound is marked only by a
 * check the assessor measured, and a recording is said to be a recording while
 * the phone's voice is said to be the phone's.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_LEVELS } from '../scenes/scenePreview.ts';
import {
  FRENCH_PHONEMES,
  MISSIONS,
  SCENE_SPINE,
  getMission,
  missionStates,
  newCard,
  phraseKeyOf,
  type MissionProgress,
  type ReviewCard,
} from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { DEVICE_VOICE, RECORDED_AUDIO } from '../copy/access.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { NOTEBOOK, NOTEBOOK_COPY, isFirstVisit, levelPathFrom, phraseBankFrom, soundsMapFrom, PHRASE_BANK_ROWS } from './notebook.ts';

const NOW = Date.parse('2026-09-27T09:00:00Z');
const DAY = 86_400_000;
const BASE = missionStates([], [], NOW);

/** Progress with the named missions earned on the learner's own. */
function earning(...ids: string[]): MissionProgress[] {
  return BASE.map((p) => (ids.includes(p.mission.id) ? { ...p, independence: 'on-your-own' as const } : p));
}

const card = (fr: string, addedAt: number): ReviewCard => newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: `means ${fr}`, context: '', ipa: '' }, addedAt);

const check = (over: Partial<SoundCheckEvidence>): SoundCheckEvidence => ({
  missionId: 'mission:cafe',
  reference: "Un café, s'il vous plaît.",
  at: NOW - DAY,
  kind: 'assessed-focus',
  focus: null,
  phoneme: 'ʁ',
  ...over,
});

describe('the level and the can-dos earned — notebook Phase 3', () => {
  test('a learner with nothing earned is at A0, "here" on the first scene, every other stop ahead', () => {
    const path = levelPathFrom(BASE);
    assert.equal(path.level, 'A0');
    const carried = MISSION_LEVELS.filter((level) => SCENE_SPINE.some((id) => getMission(id)!.cefr === level));
    assert.ok(carried.includes('A0') && carried.includes('A1'));
    assert.deepEqual(path.levels.map((l) => l.level), carried, 'a level with no scene was drawn, or one with scenes was not');
    const stops = path.levels.flatMap((l) => l.stops);
    assert.equal(stops.length, SCENE_SPINE.length, 'a scene on the spine has no stop');
    assert.equal(stops.filter((s) => s.state === 'here').length, 1, 'the path has more or fewer than one "you are here"');
    assert.equal(stops[0]!.state, 'here');
    assert.equal(stops[0]!.canDo, getMission(SCENE_SPINE[0]!)!.canDoEn, 'the next scene does not say what the learner will be able to do');
    assert.ok(stops.slice(1).every((s) => s.state === 'ahead'));
    assert.deepEqual(Object.keys(path).sort(), ['level', 'levels'], 'the path carries something a screen could draw as a count');
  });

  test('an earned scene reads as its earned line, and "here" moves to the spine\'s next', () => {
    const path = levelPathFrom(earning('mission:cafe'));
    const stops = path.levels.flatMap((l) => l.stops);
    // The full café earns the opener too (core's subsumption rule).
    assert.equal(stops[0]!.state, 'earned');
    assert.equal(stops[0]!.canDo, getMission('mission:premier-cafe')!.earnedEn);
    assert.equal(stops[1]!.state, 'earned');
    assert.equal(stops[1]!.canDo, getMission('mission:cafe')!.earnedEn);
    assert.equal(stops[2]!.state, 'here');
    assert.equal(stops[2]!.canDo, getMission('mission:hotel')!.canDoEn);
    assert.equal(path.level, 'A0');
    // A finish with help earns nothing.
    const helped = BASE.map((p) => (p.mission.id === 'mission:cafe' ? { ...p, independence: 'mostly-yours' as const, timesFinished: 3 } : p));
    assert.equal(levelPathFrom(helped).levels[0]!.stops[1]!.state, 'ahead');
  });

  test('A1 once every A0 scene is earned, and no "here" once every scene is', () => {
    const a0 = MISSIONS.filter((m) => m.cefr === 'A0').map((m) => m.id);
    assert.equal(levelPathFrom(earning(...a0)).level, 'A1');
    const all = levelPathFrom(earning(...MISSIONS.map((m) => m.id)));
    assert.equal(all.levels.flatMap((l) => l.stops).filter((s) => s.state === 'here').length, 0);
  });
});

describe('the phrase bank, with audio that says whose voice it is', () => {
  const recordings = { alexandre: { 'phrase:situation:cafe-first-coffee:0': 7 } } as const;
  const items = [{ id: 'phrase:situation:cafe-first-coffee:0', fr: 'Bonjour, je vais prendre un café.' }];

  test('authored turn cards use their French back, and sounds or incomplete cards do not displace phrases', () => {
    const authored = { ...card('English cue', NOW), kind: 'turn' as const, back: items[0]!.fr };
    const invalid = { ...card('Incomplete', NOW + 1), back: '' };
    const sound = { ...card('ʁ', NOW + 2), kind: 'phoneme' as const };
    const bank = phraseBankFrom({ deck: [sound, invalid, authored], voice: 'alexandre', recordings, items });
    assert.equal(bank.length, 1);
    assert.equal(bank[0]!.fr, items[0]!.fr);
    assert.equal(bank[0]!.en, 'English cue');
    assert.deepEqual(bank[0]!.audio, { kind: 'recorded', asset: 7, label: RECORDED_AUDIO });
  });

  test('the newest kept phrases, capped, each with a recording where one exists and the device voice named where not', () => {
    const deck = [
      card('Bonjour, je vais prendre un café.', NOW - 3 * DAY),
      card('Sur place', NOW - DAY),
      card('Merci', NOW - 5 * DAY),
      card('Au revoir', NOW - 9 * DAY),
    ];
    const bank = phraseBankFrom({ deck, voice: 'alexandre', recordings, items });
    assert.equal(bank.length, PHRASE_BANK_ROWS);
    assert.deepEqual(bank.map((r) => r.fr), ['Sur place', 'Bonjour, je vais prendre un café.', 'Merci']);
    const recorded = bank[1]!;
    assert.deepEqual(recorded.audio, { kind: 'recorded', asset: 7, label: RECORDED_AUDIO });
    assert.deepEqual(bank[0]!.audio, { kind: 'device', label: DEVICE_VOICE }, 'the phone\'s voice is not named as the phone\'s');
    // Another tutor never fills the gap.
    assert.equal(phraseBankFrom({ deck, voice: 'emilie', recordings, items })[1]!.audio.kind, 'device');
    assert.deepEqual(phraseBankFrom({ deck: [], voice: 'alexandre', recordings, items }), []);
  });
});

describe('the sounds map over the inventory — marks only from real checks', () => {
  test('every sound once, example word first, and nothing marked with nothing measured', () => {
    const map = soundsMapFrom([], NOW);
    assert.equal(map.cells.length, FRENCH_PHONEMES.length);
    assert.equal(map.cells.length, 36, 'the inventory is no longer the thirty-six sounds this map was drawn for');
    for (const cell of map.cells) {
      const phoneme = FRENCH_PHONEMES.find((p) => p.ipa === cell.ipa)!;
      assert.equal(cell.example, phoneme.examples[0], `/${cell.ipa}/ does not lead with the inventory's own example word`);
      assert.equal(cell.calledOut, false);
    }
    assert.equal(map.show, false, 'the map is drawn with nothing measured to put on it');
  });

  test('a sound is marked only by a measured check that called it out', () => {
    const unmeasured = soundsMapFrom([check({ kind: 'self-guided', phoneme: 'ʁ' }), check({ kind: 'unavailable', phoneme: 'y' })], NOW);
    assert.equal(unmeasured.show, false, 'practice without assessment was drawn as a measurement');
    assert.ok(unmeasured.cells.every((c) => !c.calledOut));

    const measured = soundsMapFrom([check({}), check({ kind: 'assessed-clear', phoneme: null }), check({ phoneme: 'ʁ', at: NOW + DAY })], NOW);
    assert.equal(measured.show, true);
    assert.deepEqual(measured.cells.filter((c) => c.calledOut).map((c) => c.ipa), ['ʁ']);
    // A clear check marks nothing: it names no sound, so nothing can be said to be "clear".
    const clearOnly = soundsMapFrom([check({ kind: 'assessed-clear', phoneme: null })], NOW);
    assert.equal(clearOnly.show, true);
    assert.ok(clearOnly.cells.every((c) => !c.calledOut));
  });
});

describe('the first visit, and the words', () => {
  test('a first visit is one with nothing earned, kept, measured or said', () => {
    assert.equal(isFirstVisit({ progress: BASE, deck: [], checks: [], packs: 0 }), true);
    assert.equal(isFirstVisit({ progress: earning('mission:cafe'), deck: [], checks: [], packs: 0 }), false);
    assert.equal(isFirstVisit({ progress: BASE, deck: [card('Merci', NOW)], checks: [], packs: 0 }), false);
    assert.equal(isFirstVisit({ progress: BASE, deck: [], checks: [check({})], packs: 0 }), false);
    assert.equal(isFirstVisit({ progress: BASE, deck: [], checks: [check({ kind: 'self-guided', phoneme: null })], packs: 0 }), true);
    assert.equal(isFirstVisit({ progress: BASE, deck: [], checks: [], packs: 1 }), false);
  });

  test('no rank name, no points, no digits, no em dash, no guilt word', () => {
    assert.ok(NOTEBOOK_COPY.includes(NOTEBOOK.firstVisit));
    for (const line of NOTEBOOK_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      // The level's own name (A0 to B1) is a level, not a count, and is the one digit allowed.
      assert.doesNotMatch(line.replace(/\b(A[012]|B1)\b/g, ''), /—|\d|%/, `"${line}" carries an em dash, a digit or a percentage`);
      assert.doesNotMatch(line, /\b(beginner|novice|intermediate|advanced|veteran|expert|points?|xp|rank)\b/i, `"${line}" names a rank or points`);
    }
  });
});
