/**
 * Who draws which picture — F570.
 *
 * `maps.ts` is the only half of the art seam node can load, because it takes
 * the key type and nothing else from the registry. That is what makes these
 * three claims real assertions rather than a source walk: every place a learner
 * can be sent has a scene, every scene a map names is one the registry ships,
 * and no picture is claimed by two maps or by none.
 *
 * The registry itself is read as text, since `require` of a PNG is a Metro
 * thing (see `registry.test.ts`).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MISSIONS } from '@luvani/core';

import { HERO_ART, heroArt } from './maps.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/** The keys the registry ships, read out of its source. */
const KEYS = [...readFileSync(join(HERE, 'registry.ts'), 'utf8').matchAll(
  /^ {2}'?([a-z][a-z-]*)'?: \{ source: require\(/gm,
)].map(([, key]) => key as string);

describe('the pictures each place, tab and screen draws — F570', () => {
  test('every place a learner can be sent has a scene of its own', () => {
    const places = new Set(MISSIONS.map((mission) => mission.place));
    assert.ok(places.size >= 6, 'the catalogue has fewer places than the six scenes were drawn for');

    const used = new Set<string>();
    for (const place of places) {
      const key = heroArt(place);
      assert.ok(KEYS.includes(key), `${place} is drawn as ${key}, which the registry does not ship`);
      assert.equal(used.has(key), false, `${place} shares its scene with another place, so two situations look alike`);
      used.add(key);
    }
    assert.deepEqual(
      Object.keys(HERO_ART).sort(),
      [...places].sort(),
      'the hero map names a place the catalogue does not, or misses one it does',
    );
  });

  test('every picture a map names is a picture the registry ships', () => {
    for (const [where, map] of [
      ['the places', HERO_ART],
    ] as const) {
      for (const [name, key] of Object.entries(map)) {
        assert.ok(
          KEYS.includes(key),
          `${where} sends ${name} to ${key}, which is not in the registry, so that screen would crash on a device`,
        );
      }
    }
  });

  test('every picture the registry ships is claimed by exactly one map', () => {
    const claimed = new Map<string, string[]>();
    for (const [where, map] of [
      ['the places', HERO_ART],
    ] as const) {
      for (const key of Object.values(map)) {
        claimed.set(key, [...(claimed.get(key) ?? []), where]);
      }
    }
    for (const key of KEYS) {
      const owners = claimed.get(key) ?? [];
      assert.equal(
        owners.length,
        1,
        owners.length === 0
          ? `${key} is shipped and no map draws it`
          : `${key} is claimed by ${owners.join(' and ')}, so two surfaces would wear the same picture`,
      );
    }
  });
});
