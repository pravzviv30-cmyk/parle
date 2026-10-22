/**
 * Which postcard each scene sends home, F865.
 *
 * Twelve missions once borrowed another scene's postcard on the recap, so a
 * pharmacy visit came back as a street map. Every scene now has a postcard of
 * its own. This test fails if two missions share one, if the map names a
 * drawing the registry does not ship, or if a shipped postcard has no owner.
 *
 * The registry is read as text, since it imports react-native-svg components
 * that node cannot run, the same way `art/flat/scenes.test.ts` does.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MISSIONS } from '@luvani/core';

import { POSTCARD, postcardIllustration } from './postcardArt.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/** The names the registry ships, read out of its generated source. */
const NAMES = [
  ...readFileSync(join(HERE, '..', 'art', 'flat', 'index.ts'), 'utf8').matchAll(/^ {2}'([a-z][a-z0-9-]*)': \{ draw: /gm),
].map(([, name]) => name as string);

describe('the postcard each scene sends home, F865', () => {
  test('every scene hands back a postcard of its own', () => {
    assert.ok(NAMES.length > 0, 'the registry was read as empty, so this test is reading nothing');
    const ids = MISSIONS.map((mission) => mission.id);

    const used = new Map<string, string>();
    for (const id of ids) {
      const name = postcardIllustration(id);
      assert.ok(name.startsWith('postcard-'), `${id} sends ${name}, which is not a postcard`);
      assert.ok(NAMES.includes(name), `${id} sends ${name}, which the registry does not ship`);
      const other = used.get(name);
      assert.equal(other, undefined, `${id} shares ${name} with ${other}, so two scenes send the same postcard`);
      used.set(name, id);
    }
    assert.deepEqual(
      Object.keys(POSTCARD).sort(),
      [...ids].sort(),
      'the postcard map names a scene the catalogue does not, or misses one it does',
    );

    const postcards = NAMES.filter((name) => name.startsWith('postcard-'));
    assert.equal(postcards.length, 19, 'the registry ships a different number of postcards than the nineteen scenes');
    for (const name of postcards) {
      const owners = Object.entries(POSTCARD)
        .filter(([, drawn]) => drawn === name)
        .map(([scene]) => scene);
      assert.equal(
        owners.length,
        1,
        owners.length === 0
          ? `${name} is shipped and no scene sends it`
          : `${name} is claimed by ${owners.join(' and ')}, so two scenes would send the same postcard`,
      );
    }
  });
});
