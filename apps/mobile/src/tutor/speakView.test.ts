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
import {
  HERE_MARK,
  MORE_WAYS,
  MORE_WAYS_LABEL,
  SPEAK_COPY,
  SPEAK_INSTEAD,
  TYPE_INSTEAD,
  YOU_ARE_HERE,
  moreWaysOpen,
  pathCard,
  speakPath,
  startModes,
  startNote,
  tutorCardFacts,
} from './speakView.ts';

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
    assert.deepEqual(path.groups.map((group) => group.level), ['A0', 'A1'], 'the path draws a level with no scene on it, or misses one');

    // Grouped rows, one per scene, in spine order, each with its can-do and minutes.
    const rows = path.groups.flatMap((group) => group.rows);
    assert.equal(rows.length, SCENE_SPINE.length);
    assert.deepEqual(rows.map((row) => row.missionId), [...SCENE_SPINE]);
    assert.equal(rows.filter((row) => row.state === 'here').length, 1, 'the path has more or less than one "you are here"');
    assert.equal(rows[0]!.state, 'here');
    assert.ok(rows.slice(1).every((row) => row.state === 'ahead'));
    for (const row of rows) {
      const mission = getMission(row.missionId)!;
      assert.equal(row.french, mission.title, 'a row does not carry the scene\'s French name');
      assert.equal(row.title, mission.titleEn);
      assert.equal(row.gloss, mission.canDoEn);
      assert.equal(row.meta, minutesLine(missionMinutes(mission)));
      assert.deepEqual(row.route, { screen: 'Missions', params: { focus: mission.id } }, 'a row does not open its brief in the chooser');
    }
    assert.equal(rows[0]!.meta, 'About 3 minutes', 'the opener is not offered as about three minutes, said in full (F602)');
    for (const group of path.groups) {
      assert.ok(group.rows.every((row) => getMission(row.missionId)!.cefr === group.level), `${group.level} holds a scene of another level`);
    }
  });

  test('an earned scene reads as earned, and "here" moves on', () => {
    const progress = missionStates([{ id: FIRST_MISSION, at: NOW - 1000, rung: 4 }], [], NOW);
    const rows = speakPath(progress).groups.flatMap((group) => group.rows);
    assert.equal(rows[0]!.state, 'earned');
    assert.equal(rows[0]!.gloss, getMission(FIRST_MISSION)!.earnedEn);
    assert.equal(rows[1]!.state, 'here');
    assert.equal(spineFrom(progress).next!.id, SCENE_SPINE[1]);
  });

  // 2026-09-27, notebook Phase 4 (B1). The Phase 3 browser proof found Speak
  // drawing the path twice: the level path's can-do stops, then the same can-do
  // lines again as rows. It is one list now, so the model hands the screen rows
  // and nothing a second list could be drawn from.
  test('the path is drawn once: rows grouped by level, each saying where the learner stands', () => {
    const path = speakPath(missionStates([], [], NOW));
    assert.deepEqual(Object.keys(path), ['groups'], 'the path model still carries a second list to draw');
    const rows = path.groups.flatMap((group) => group.rows);
    const here = rows.find((row) => row.state === 'here')!;
    assert.equal(here.label, YOU_ARE_HERE, 'the "here" row does not say so in words, so the mark is colour alone');
    assert.ok(rows.filter((row) => row.state !== 'here').every((row) => row.label === undefined), 'a row that is not "here" carries the here line');
    assert.equal(HERE_MARK, 'ici', 'the highlighter mark on the "here" row is not the French word for it');
    for (const row of rows) {
      // One sentence to a screen reader: the scene, the can-do, the minutes and where the learner stands.
      const where = row.state === 'here' ? 'you are here' : row.state === 'earned' ? 'done' : 'not yet';
      assert.equal(row.accessibilityLabel, `${row.title}, ${row.gloss}, ${row.progressLabel}, ${row.meta}, ${where}`);
      assert.equal(row.progressLabel, row.state === 'here' ? 'Next scene' : 'Available scene');
    }
    assert.ok(SPEAK_COPY.includes(YOU_ARE_HERE));
  });

  // Revamp B, F603. Speak draws the path as one white card: the scenes of the
  // level the learner is in, by their French names, and one line for the level
  // after. The card opens the list of every scene, so nothing here is lost.
  test("the path card holds the current level's scenes in French and names the rest in one line", () => {
    const levelOf = (level: 'A0' | 'A1') => SCENE_SPINE.filter((id) => getMission(id)!.cefr === level);
    const a0 = levelOf('A0');
    const a1 = levelOf('A1');
    assert.ok(a0.length > 0 && a1.length > 0, 'the spine lost a level, so this test reads nothing');

    // A first run: the "here" is the opener, so the card is A0 and names A1 after it.
    const fresh = pathCard(speakPath(missionStates([], [], NOW)));
    assert.equal(fresh.level, 'A0');
    assert.deepEqual(fresh.rows.map((row) => row.missionId), a0, 'the card holds something other than the current level, in spine order');
    for (const row of fresh.rows) {
      const mission = getMission(row.missionId)!;
      assert.equal(row.french, mission.title, 'a path row is not drawn by its French name');
      assert.notEqual(row.french, row.title, 'the French name is the English one');
    }
    assert.equal(fresh.rows.filter((row) => row.state === 'here').length, 1, 'the card lost the "here" row');
    assert.equal(fresh.rest, `Then A1, ${a1.length} more scenes`);

    // Every A0 scene earned: "here" moves into A1, the card follows it, and
    // with nothing after A1 there is no line to add.
    const pastA0 = missionStates(a0.map((id, i) => ({ id, at: NOW - 10_000 + i, rung: 4 as const })), [], NOW);
    const second = pathCard(speakPath(pastA0));
    assert.equal(second.level, 'A1', 'the card stayed on a level the learner has finished');
    assert.deepEqual(second.rows.map((row) => row.missionId), a1);
    assert.equal(second.rest, null, 'the last level names a level after it that does not exist');

    // Everything earned: there is no "here" at all, and the last level stands.
    const done = missionStates(SCENE_SPINE.map((id, i) => ({ id, at: NOW - 10_000 + i, rung: 4 as const })), [], NOW);
    const last = pathCard(speakPath(done));
    assert.equal(last.level, 'A1');
    assert.ok(last.rows.every((row) => row.state === 'earned'));
    assert.equal(last.rest, null);

    // One scene after this level reads as one scene, not "1 more scenes".
    const path = speakPath(missionStates([], [], NOW));
    const one = pathCard({ groups: [path.groups[0]!, { ...path.groups[1]!, rows: path.groups[1]!.rows.slice(0, 1) }] });
    assert.equal(one.rest, 'Then A1, 1 more scene');

    // One line, joined with a comma, and nothing the punctuation ratchet bans.
    for (const line of [fresh.rest!, one.rest!]) {
      assert.doesNotMatch(line, /\n|[·—–]/, `"${line}" is not one plain line`);
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
    }
  });
});

describe('offline Speak', () => {
  // 2026-09-27, notebook Phase 4 (B1): offline, the line under the Start said
  // the tutor was away and the card under it said it could not connect. One
  // unavailable message is enough, and the card is the one with a way forward.
  test('says it is unavailable once: the line under the Start stands down while the offline card is up', () => {
    const away = { state: 'error' as const, subline: 'Your tutor is away right now.' };
    assert.equal(startNote(away, true), null, 'offline Speak says it is unavailable twice');
    assert.equal(startNote({ state: 'idle', subline: 'No speaking time just now.' }, false), 'No speaking time just now.');
    assert.equal(startNote({ state: 'connecting', subline: 'Opening your room.' }, false), 'Opening your room.');
    assert.equal(startNote({ state: 'ready', subline: 'anything' }, false), null, 'a ready tutor still carries a state line');
    assert.equal(startNote({ state: 'idle', subline: 'No speaking time just now.' }, true), null);
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
