/**
 * Which flat drawing each scene draws — F599 (revamp B), from F570.
 *
 * `scenes.ts` is the only half of the flat art seam node can load, because it
 * takes the name type and nothing else from the registry. That is what makes
 * these claims real assertions rather than a source walk: every scene a learner
 * can be sent to has a drawing of its own, every drawing the map names is one
 * the registry ships, and every place drawing the registry ships is claimed by
 * exactly one scene.
 *
 * The registry itself is read as text, since it imports react-native-svg
 * components that node cannot run. Rewritten from `art/maps.test.ts`, which
 * held the watercolours to the same three promises by place.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MISSIONS } from '@luvani/core';

import { SCENE_ILLUSTRATION, sceneIllustration } from './scenes.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/** The names the registry ships, read out of its generated source. */
const NAMES = [...readFileSync(join(HERE, 'index.ts'), 'utf8').matchAll(/^ {2}'([a-z][a-z0-9-]*)': \{ draw: /gm)].map(
  ([, name]) => name as string,
);

describe('the drawing each scene draws — F599', () => {
  test('every scene has a flat drawing of its own, and no two scenes share one', () => {
    assert.ok(NAMES.length > 0, 'the registry was read as empty, so this test is reading nothing');
    const ids = MISSIONS.map((mission) => mission.id);
    assert.ok(ids.length >= 19, 'the catalogue has fewer scenes than the nineteen place drawings were drawn for');

    const used = new Set<string>();
    for (const id of ids) {
      const name = sceneIllustration(id);
      assert.ok(name.startsWith('place-'), `${id} is drawn as ${name}, which is not a place scene`);
      assert.ok(NAMES.includes(name), `${id} is drawn as ${name}, which the registry does not ship`);
      assert.equal(used.has(name), false, `${id} shares ${name} with another scene, so two situations look alike`);
      used.add(name);
    }
    assert.deepEqual(
      Object.keys(SCENE_ILLUSTRATION).sort(),
      [...ids].sort(),
      'the scene map names a scene the catalogue does not, or misses one it does',
    );
  });

  test('every drawing the scene map names is a drawing the registry ships', () => {
    for (const [scene, name] of Object.entries(SCENE_ILLUSTRATION)) {
      assert.ok(
        NAMES.includes(name),
        `${scene} is sent to ${name}, which is not in the registry, so that screen would fail to compile`,
      );
    }
  });

  test('every place drawing the registry ships is claimed by exactly one scene', () => {
    const claimed = new Map<string, string[]>();
    for (const [scene, name] of Object.entries(SCENE_ILLUSTRATION)) {
      claimed.set(name, [...(claimed.get(name) ?? []), scene]);
    }
    const places = NAMES.filter((name) => name.startsWith('place-'));
    assert.equal(places.length, 19, 'the registry ships a different number of place drawings than the nineteen scenes');
    for (const name of places) {
      const owners = claimed.get(name) ?? [];
      assert.equal(
        owners.length,
        1,
        owners.length === 0
          ? `${name} is shipped and no scene draws it`
          : `${name} is claimed by ${owners.join(' and ')}, so two scenes would wear the same picture`,
      );
    }
  });
});
