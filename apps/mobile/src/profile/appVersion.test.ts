/**
 * The version line at the bottom of Profile — F369.
 *
 * Three things, and the middle one is what makes this worth a module. The rule
 * is pure, so it can be asked what it does with an empty string. The value it
 * will actually be handed is read out of `app.json` here, so the line the
 * footer prints on a real build is checked rather than assumed. And the screen
 * is read to prove the line is gated on null, because a footer reading
 * "Luvani undefined" is worse than no footer: it looks like a bug in the one
 * place somebody goes to report one.
 *
 * `expo-constants` is deliberately absent from this file and from
 * `appVersion.ts`. It pulls `expo-modules-core`, which ships TypeScript inside
 * `node_modules`, and node's type stripping refuses to touch anything under
 * there, so importing it would take this whole suite down at load time and the
 * run would still exit zero (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { appVersionLine } from './appVersion.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

describe('which build this is — F369', () => {
  test('the footer names the version app.json ships, and says nothing when there is none — F369', () => {
    // 1. What it prints, on the shape it is actually handed.
    assert.equal(appVersionLine('0.1.0'), 'Luvani 0.1.0', 'the line no longer names the product and its version');
    assert.equal(appVersionLine('1.2.3-beta.4'), 'Luvani 1.2.3-beta.4', 'a pre-release build is printed differently');
    assert.equal(appVersionLine(' 0.1.0 '), 'Luvani 0.1.0', 'whitespace from a JSON file reaches the footer');

    // 2. What it refuses. `expoConfig` is typed optimistically and comes from a
    //    file a build can ship without a version at all, so every one of these
    //    is reachable and every one of them has to be silence rather than a
    //    half-written line.
    for (const missing of [undefined, null, '', '   ', 0, 1, {}, [], true, NaN]) {
      assert.equal(
        appVersionLine(missing),
        null,
        `${JSON.stringify(missing) ?? String(missing)} was turned into a version line a learner would read`,
      );
    }

    // 3. The value it will really be handed, on a real build. Read out of
    //    app.json rather than restated, so the footer and the binary cannot
    //    disagree about which build somebody is looking at.
    const appJson = JSON.parse(readFileSync(fileURLToPath(new URL('../../app.json', import.meta.url)), 'utf8')) as {
      expo?: { version?: unknown };
    };
    const shipped = appJson.expo?.version;
    assert.equal(typeof shipped, 'string', 'app.json ships no version, so the footer would have nothing to say');
    assert.equal(
      appVersionLine(shipped),
      `Luvani ${String(shipped).trim()}`,
      'the line the footer prints is not the version this build ships',
    );

    // 4. The screen. Soft ink rather than the faint tertiary, because it is
    //    words somebody is asked to read back to us (F330), and absent rather
    //    than half written when there is nothing to say.
    const tab = stripComments(read('../tabs/ProfileTab.tsx'));
    assert.match(tab, /appVersionLine\(Constants\.expoConfig\?\.version\)/, 'the footer decides the version for itself');
    assert.match(
      tab,
      /\{versionLine === null \? null : \(/,
      'the footer draws the line whatever the config said, so an unknown build reads as a bug',
    );
    assert.match(
      tab,
      /\{versionLine\}/,
      'the version is worked out and never drawn',
    );
    const at = tab.indexOf('{versionLine}');
    assert.ok(at !== -1, 'the version line is not in the screen at all');
    const line = tab.slice(tab.lastIndexOf('<Text', at), at);
    assert.match(line, /type\.small/, 'the version line is not set at the secondary size the footer uses');
    assert.match(line, /paper\.inkSoft/, 'the version line is set in a colour that only ever cleared as a mark');
    assert.ok(!line.includes('inkFaint'), 'the version line is set in the faint ink F330 took off learner-facing text');

    // It sits under the legal paragraph rather than above it: the paragraph is
    // what the footer is for, and the build number is a footnote to it.
    const legal = tab.indexOf('A reviewed privacy policy');
    assert.ok(legal !== -1 && legal < at, 'the build number is drawn above the legal text it is a footnote to');
  });
});
