/**
 * The Acknowledgements screen credits the face the app is set in — F596.
 *
 * Revamp B sets every word in Outfit and takes Fraunces and DM Sans out of the
 * bundle. The OFL lets us embed a font only if its copyright notice and licence
 * travel with it, so the screen has to credit the face that actually ships, and
 * must stop crediting two faces that no longer do. A credit for a font we do
 * not ship is a small lie; a font we ship with no credit is a licence breach.
 *
 * The screen also tells the learner the licence text ships with the app, so the
 * licence file has to be in the fonts folder, and the author line has to be the
 * one that file carries rather than one written from memory.
 *
 * Source-read rather than rendered, like the other contract tests here: the
 * failure this exists to catch is a stale string in one file, not a layout.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCREEN = fileURLToPath(new URL('./Acknowledgements.tsx', import.meta.url));
const OFL_OUTFIT = fileURLToPath(new URL('../../assets/fonts/OFL-Outfit.txt', import.meta.url));

test('Acknowledgements credits Outfit under the OFL and names no retired face', () => {
  const source = readFileSync(SCREEN, 'utf8');

  assert.match(source, /name: 'Outfit'/, 'the screen does not credit Outfit, the face every word is set in');
  assert.match(source, /SIL Open Font License 1\.1/, 'the screen does not name the licence Outfit is embedded under');
  assert.doesNotMatch(
    source,
    /Fraunces|DM Sans/,
    'the screen still credits a face the app no longer ships',
  );

  assert.ok(
    existsSync(OFL_OUTFIT),
    'the screen says the licence text ships with the app, and OFL-Outfit.txt is not in assets/fonts',
  );

  // The credit names the authors the licence file names, not a paraphrase.
  const by = source.match(/name: 'Outfit',\s*by: '([^']+)'/);
  assert.ok(by, 'the Outfit notice has no author line next to its name');
  const copyright = readFileSync(OFL_OUTFIT, 'utf8').split('\n')[0] ?? '';
  assert.ok(
    copyright.includes(by[1]!),
    `the Outfit credit says "${by[1]}" but OFL-Outfit.txt says "${copyright}"`,
  );
});
