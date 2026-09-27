/**
 * The first scene's microphone primer: one button, the OS prompt only after
 * it, Open Settings plus typing if refused, and "Type instead" always there.
 * The decisions are values here; the wiring is read from the screen and the
 * navigator, in the idiom of the rest of this folder.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { MEET_MIC } from './disclosure.ts';
import {
  OPEN_SETTINGS,
  PRIMER_ACTION,
  PRIMER_COPY,
  TYPE_INSTEAD,
  afterPermission,
  primerView,
} from './micPrimer.ts';

const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (relative: string) => strip(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));

describe('the first scene opens with a microphone primer', () => {
  test('one button asks, and typing is always one tap away', () => {
    const ask = primerView('ask', true);
    assert.equal(ask.primary.act, 'ask');
    assert.equal(ask.primary.label, PRIMER_ACTION);
    assert.equal(ask.note, MEET_MIC, 'the primer says something other than the first-run microphone line');
    assert.deepEqual(ask.secondary, { label: TYPE_INSTEAD, act: 'type' });
    assert.equal(ask.busy, false);
    assert.equal(primerView('asking', true).busy, true, 'the pill can be tapped twice while the OS is asking');

    for (const phase of ['ask', 'asking', 'refused'] as const) {
      for (const settings of [true, false]) {
        const view = primerView(phase, settings);
        const typing = [view.primary, view.secondary].filter((a) => a?.act === 'type');
        assert.equal(typing.length, 1, `${phase}/${settings}: "Type instead" is not on screen exactly once`);
        assert.equal(typing[0]!.label, TYPE_INSTEAD);
      }
    }
  });

  test('a refusal offers the phone’s settings where there are any, and typing either way', () => {
    const native = primerView('refused', true);
    assert.deepEqual(native.primary, { label: OPEN_SETTINGS, act: 'settings' });
    assert.deepEqual(native.secondary, { label: TYPE_INSTEAD, act: 'type' });
    const web = primerView('refused', false);
    assert.deepEqual(web.primary, { label: TYPE_INSTEAD, act: 'type' }, 'the web offers a settings app it does not have');
    assert.equal(web.secondary, null);
    assert.equal(afterPermission(true), 'start');
    assert.equal(afterPermission(false), 'refused');
  });

  test('primer copy is plain and kind', () => {
    for (const line of PRIMER_COPY) {
      assert.equal(guiltIn(line), undefined, `guilt in "${line}"`);
      assert.doesNotMatch(line, /[—–]/, `em dash in "${line}"`);
    }
  });

  test('the OS prompt is raised only by the primer’s button, and the scene opens through the ordinary route', () => {
    const screen = read('./FirstSceneScreen.tsx');
    assert.equal((screen.match(/requestRecordingPermissionsAsync/g) ?? []).length, 1, 'the primer asks for the microphone from more than one place');
    const ask = screen.slice(screen.indexOf('const ask = async'), screen.indexOf('const act ='));
    assert.match(ask, /requestRecordingPermissionsAsync\(\)/, 'the ask is not inside the button handler');
    assert.doesNotMatch(screen, /useEffect\([^)]*requestRecordingPermissionsAsync/, 'the primer asks on mount');
    assert.match(screen, /onStart\(false\)/, 'a granted microphone does not open the spoken scene');
    assert.match(screen, /onStart\(true\)/, 'typing does not open the typed scene');
    assert.match(screen, /openPhoneSettings\(\)/, 'a refusal cannot reach the phone’s settings');
    assert.doesNotMatch(screen, /from '\.\.\/live\//, 'the primer reaches into live session logic');

    const navigator = read('../nav/RootNavigator.tsx');
    assert.match(navigator, /<Stack\.Screen name="FirstScene" component=\{FirstSceneRoute\} \/>/, 'the first scene is not a route');
    assert.match(navigator, /nav\.replace\('Convo', \{ missionId, textMode \}\)/, 'the primer does not hand over to the ordinary conversation route');
    assert.match(read('../nav/types.ts'), /FirstScene: \{ missionId: string \}/);
    assert.match(read('../nav/theme.ts'), /FirstScene: 'first-scene\/:missionId'/);
  });
});
