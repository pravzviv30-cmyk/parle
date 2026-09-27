/**
 * What Speak draws, decided — notebook Phase 3, B1 (2026-09-27).
 *
 * Speak leads with the tutor (name, how the voice sounds, the French half of
 * the voice sample as the signature line), then the A0 to A1 path from the
 * spine with "you are here" on the next scene, then every scene as a row that
 * opens its brief in the chooser. "More ways to practise" appears only after a
 * first finished scene. None of this may invent a number or a rank.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FIRST_MISSION, SCENE_SPINE, TUTOR_VOICES, getMission, missionStates, spineFrom, tutorSampleLine, type TutorVoiceKey } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { minutesLine, missionMinutes } from '../home/estimate.ts';
import { MORE_WAYS, MORE_WAYS_LABEL, SPEAK_COPY, SPEAK_INSTEAD, TYPE_INSTEAD, moreWaysOpen, speakPath, startModes, tutorCardFacts } from './speakView.ts';

const NOW = new Date(2026, 8, 12, 21, 0, 0).getTime();

describe('the tutor card', () => {
  test('names the tutor from TUTOR_VOICES, says how the voice sounds, and signs with the French half of the sample', () => {
    for (const key of Object.keys(TUTOR_VOICES) as TutorVoiceKey[]) {
      const facts = tutorCardFacts(key);
      assert.equal(facts.name, TUTOR_VOICES[key].persona.name);
      assert.equal(facts.voice, TUTOR_VOICES[key].sound);
      assert.ok(tutorSampleLine(key).startsWith(facts.signature), 'the signature is not what the sample clip says first');
      assert.match(facts.signature, /^Bonjour, je m’appelle .+\.$/, 'the signature is not the French line of the sample');
      assert.doesNotMatch(facts.signature, /Hi, my name/, 'the English half leaked into a French line');
    }
  });
});

describe('the level path', () => {
  test('draws A0 then A1 from the spine, with "here" on the next scene and nothing invented', () => {
    const progress = missionStates([], [], NOW);
    const path = speakPath(progress);
    assert.deepEqual(path.levels.map((level) => level.level), ['A0', 'A1'], 'the path draws a level with no scene on it, or misses one');
    const stops = path.levels.flatMap((level) => level.stops);
    assert.equal(stops.length, SCENE_SPINE.length);
    assert.deepEqual(stops.filter((stop) => stop.state === 'here').length, 1, 'the path has more or less than one "you are here"');
    assert.equal(stops[0]!.state, 'here');
    assert.equal(stops[0]!.canDo, getMission(FIRST_MISSION)!.canDoEn);
    assert.ok(stops.slice(1).every((stop) => stop.state === 'ahead'));

    // Grouped rows, one per scene, in spine order, each with its can-do and minutes.
    const rows = path.groups.flatMap((group) => group.rows);
    assert.deepEqual(rows.map((row) => row.missionId), [...SCENE_SPINE]);
    for (const row of rows) {
      const mission = getMission(row.missionId)!;
      assert.equal(row.title, mission.titleEn);
      assert.equal(row.gloss, mission.canDoEn);
      assert.equal(row.meta, minutesLine(missionMinutes(mission)));
      assert.deepEqual(row.route, { screen: 'Missions', params: { focus: mission.id } }, 'a row does not open its brief in the chooser');
    }
    assert.equal(rows[0]!.meta, 'About 3 min');
    for (const group of path.groups) {
      assert.ok(group.rows.every((row) => getMission(row.missionId)!.cefr === group.level), `${group.level} holds a scene of another level`);
    }
  });

  test('an earned scene reads as earned, and "here" moves on', () => {
    const progress = missionStates([{ id: FIRST_MISSION, at: NOW - 1000, rung: 4 }], [], NOW);
    const path = speakPath(progress);
    const stops = path.levels.flatMap((level) => level.stops);
    assert.equal(stops[0]!.state, 'earned');
    assert.equal(stops[0]!.canDo, getMission(FIRST_MISSION)!.earnedEn);
    assert.equal(stops[1]!.state, 'here');
    assert.equal(spineFrom(progress).next!.id, SCENE_SPINE[1]);
    const first = path.groups[0]!.rows[0]!;
    assert.equal(first.state, 'earned');
    assert.equal(first.gloss, getMission(FIRST_MISSION)!.earnedEn);
  });
});

describe('more ways to practise', () => {
  test('appear only after a first finished scene', () => {
    assert.equal(moreWaysOpen(missionStates([], [], NOW)), false, 'a first run is offered more ways before it has had one');
    assert.equal(moreWaysOpen(missionStates([{ id: FIRST_MISSION, at: NOW - 1000, rung: 1 }], [], NOW)), true);
    assert.equal(MORE_WAYS_LABEL, 'More ways to practise');
    assert.deepEqual(MORE_WAYS.map((way) => way.key), ['free', 'rehearse', 'memory']);
    assert.deepEqual(MORE_WAYS.map((way) => way.screen), [null, 'RealMoment', 'TutorMemory']);
  });

  // 2026-09-27 (notebook Phase 3, follow-up): the learner's standing "Prefer
  // typing" choice from Profile decides which way the one Start opens, and the
  // quiet link offers the other way.
  test('the Start opens in the preferred mode and the quiet link offers the other one', () => {
    assert.deepEqual(startModes(false), { mode: 'speak', textMode: false, other: { label: TYPE_INSTEAD, textMode: true } });
    assert.deepEqual(startModes(true), { mode: 'type', textMode: true, other: { label: SPEAK_INSTEAD, textMode: false } });
    assert.equal(SPEAK_INSTEAD, 'Speak instead');
    assert.ok(SPEAK_COPY.includes(SPEAK_INSTEAD));
  });

  test('every word Speak spells is plain, counts nothing, and never says "Ready when you are"', () => {
    assert.equal(TYPE_INSTEAD, 'Type instead');
    assert.ok(SPEAK_COPY.length >= 6);
    for (const line of SPEAK_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d|%/, `"${line}" carries an em dash or a number`);
      assert.doesNotMatch(line, /Ready when you are|Beginner|Veteran/, `"${line}" is a line the redesign retired`);
    }
  });
});
