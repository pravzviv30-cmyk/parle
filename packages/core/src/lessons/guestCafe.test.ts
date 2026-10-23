import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CAFE_LESSON, LESSONS, getLesson } from './index.ts';
import {
  GUEST_CAFE_SCENE,
  GUEST_SCENE,
  GUEST_SCENE_MAX_SECONDS,
  GUEST_SCENE_TURN_IDS,
  guestScenePhrases,
  isGuestScene,
  isGuestSceneTurnId,
  parseGuestSceneTurnIds,
} from './guestCafe.ts';
import { isAcceptable, phonemeCoverage } from './types.ts';
import { getPhoneme } from '../phonemes/inventory.ts';
import * as core from '../index.ts';

describe('guest scene structure', () => {
  test('the scene takes the café originals by reference, in scene order', () => {
    assert.equal(GUEST_CAFE_SCENE.turns.length, 5);
    GUEST_SCENE_TURN_IDS.forEach((id, i) => {
      const original = CAFE_LESSON.turns.find((t) => t.id === id);
      assert.ok(original, `${id} exists in the café lesson`);
      assert.equal(GUEST_CAFE_SCENE.turns[i], original, `${id} is the same object, not a copy`);
    });
  });

  test('every allowed turn id exists in the café lesson', () => {
    const ids = new Set(CAFE_LESSON.turns.map((t) => t.id));
    for (const id of GUEST_SCENE_TURN_IDS) assert.ok(ids.has(id), `${id} missing from CAFE_LESSON`);
  });

  test('the scene is not a catalogue lesson', () => {
    assert.equal(GUEST_CAFE_SCENE.id, 'cafe-guest');
    assert.ok(!LESSONS.some((l) => l.id === 'cafe-guest' || l === GUEST_CAFE_SCENE));
    assert.equal(getLesson('cafe-guest'), undefined);
  });

  test('constants and core exports', () => {
    assert.equal(GUEST_SCENE, 'guest-cafe');
    assert.equal(GUEST_SCENE_MAX_SECONDS, 180);
    assert.equal(core.GUEST_CAFE_SCENE, GUEST_CAFE_SCENE);
    assert.equal(core.parseGuestSceneTurnIds, parseGuestSceneTurnIds);
  });

  test('the premise and scenario are honest about the short scene and use no em dash', () => {
    assert.match(GUEST_CAFE_SCENE.premise, /two minutes/);
    assert.ok(!GUEST_CAFE_SCENE.premise.includes('\u2014'));
    assert.ok(!GUEST_CAFE_SCENE.scenario.includes('\u2014'));
    assert.ok(!/orders a coffee and a pastry|pays by card, asks where/.test(GUEST_CAFE_SCENE.scenario));
  });

  test('the rest of the café lesson is kept', () => {
    assert.equal(GUEST_CAFE_SCENE.title, CAFE_LESSON.title);
    assert.equal(GUEST_CAFE_SCENE.tutorRole, CAFE_LESSON.tutorRole);
    assert.equal(GUEST_CAFE_SCENE.openingRung, CAFE_LESSON.openingRung);
    assert.deepEqual(GUEST_CAFE_SCENE.culturalNotes, CAFE_LESSON.culturalNotes);
  });
});

describe('guest scene passes the catalogue lesson checks', () => {
  const lesson = GUEST_CAFE_SCENE;

  test('turn ids are unique', () => {
    assert.equal(new Set(lesson.turns.map((t) => t.id)).size, lesson.turns.length);
  });

  test('every turn carries material for all four rungs', () => {
    for (const t of lesson.turns) {
      assert.ok(t.target.length > 0 && t.options.length >= 2 && t.hint.length > 0);
      assert.ok(t.tutor.length > 0 && t.reference.length > 0);
      assert.ok(t.options.some((o) => o.acceptable), `${t.id}: no acceptable option`);
      assert.ok(t.tutorEn.length > 0 && t.targetEn.length > 0);
    }
  });

  test('every focus phoneme is real, and every targeted phoneme is exercised', () => {
    for (const t of lesson.turns) for (const p of t.focusPhonemes) assert.ok(getPhoneme(p), `unknown /${p}/`);
    const covered = phonemeCoverage(lesson);
    for (const claimed of lesson.targetPhonemes) {
      assert.ok(covered.includes(claimed), `scene claims /${claimed}/ but no turn exercises it`);
    }
  });

  test('each scene turn accepts its own target line', () => {
    for (const t of lesson.turns) assert.ok(isAcceptable(t, t.target), `${t.id} rejects its own target`);
  });
});

describe('guest scene ids', () => {
  test('isGuestScene and isGuestSceneTurnId', () => {
    assert.ok(isGuestScene('guest-cafe'));
    assert.ok(!isGuestScene('cafe-guest'));
    assert.ok(!isGuestScene(undefined));
    assert.ok(isGuestSceneTurnId('t1-greet'));
    assert.ok(!isGuestSceneTurnId('t4-repeat'));
    assert.ok(!isGuestSceneTurnId(1));
  });

  test('parseGuestSceneTurnIds accepts valid lists and returns scene order', () => {
    assert.deepEqual(parseGuestSceneTurnIds([]), []);
    assert.deepEqual(parseGuestSceneTurnIds(['t1-greet']), ['t1-greet']);
    assert.deepEqual(parseGuestSceneTurnIds(['t12-goodbye', 't1-greet', 't3-sur-place']), ['t1-greet', 't3-sur-place', 't12-goodbye']);
    assert.deepEqual(parseGuestSceneTurnIds([...GUEST_SCENE_TURN_IDS].reverse()), [...GUEST_SCENE_TURN_IDS]);
  });

  test('parseGuestSceneTurnIds rejects anything else', () => {
    for (const bad of [undefined, null, 'ids', 't1-greet', { 0: 't1-greet', length: 1 }, 7]) {
      assert.equal(parseGuestSceneTurnIds(bad), null, `non-array ${String(bad)}`);
    }
    assert.equal(parseGuestSceneTurnIds(['t1-greet', 't4-repeat']), null, 'unknown id');
    assert.equal(parseGuestSceneTurnIds(['t1-greet', 't1-greet']), null, 'duplicate');
    assert.equal(parseGuestSceneTurnIds([...GUEST_SCENE_TURN_IDS, 't1-greet']), null, 'more than five');
    assert.equal(parseGuestSceneTurnIds(['t1-greet', 5]), null, 'non-string');
    assert.equal(parseGuestSceneTurnIds([null]), null);
  });
});

describe('guestScenePhrases', () => {
  test('returns the target and its meaning in scene order', () => {
    const phrases = guestScenePhrases(['t12-goodbye', 't2-order']);
    assert.deepEqual(phrases, [
      { turnId: 't2-order', fr: "Un café, s'il vous plaît", en: 'A coffee, please' },
      { turnId: 't12-goodbye', fr: 'Au revoir, madame', en: 'Goodbye, madam' },
    ]);
    assert.deepEqual(guestScenePhrases([]), []);
    assert.equal(guestScenePhrases(GUEST_SCENE_TURN_IDS).length, 5);
  });
});
