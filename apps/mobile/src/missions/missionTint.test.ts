/**
 * Every situation has one tint, every tint has a situation — F362.
 *
 * Six places, six tints, a bijection. A seventh mission arriving without a
 * tint is a compile error on the Record; a tint nobody uses, or two places on
 * one paper, is what this test is for.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from '@luvani/core';

import { tint } from '../palette.ts';
import { MISSION_TINT, missionTint } from './missionTint.ts';

describe('the tint under each situation — F362', () => {
  test('every situation has one tint, every tint has a situation — F362', () => {
    const places = new Set(MISSIONS.map((mission) => mission.place));
    assert.ok(places.size >= 6, 'the catalogue has fewer places than the six tints were drawn for');

    const used = new Set<string>();
    for (const place of places) {
      const name = missionTint(place);
      assert.ok(name in tint, `${place} sits on ${name}, which is not a tint in the palette`);
      assert.equal(used.has(name), false, `${place} shares its paper with another place`);
      used.add(name);
    }
    for (const name of Object.keys(tint)) {
      assert.ok(used.has(name), `the ${name} tint has no situation to sit under`);
    }
    assert.deepEqual(Object.keys(MISSION_TINT).sort(), [...places].sort(), 'the map names a place the catalogue does not');
  });
});
