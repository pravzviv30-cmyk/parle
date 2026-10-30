/**
 * An off switch is visible on iOS — F736.
 *
 * React Native's Switch takes `trackColor.false` for an off track, and on
 * Android and the web that is what it paints. iOS paints the off state from
 * `ios_backgroundColor` instead, which defaults to clear, so every off toggle
 * in Settings showed as a bare white thumb on the white card: a control with
 * no shape, which reads as missing rather than off. Each Switch therefore says
 * the same colour twice, once per platform, and the two must agree.
 *
 * Read from the source, every Switch in the app, so a new one built outside
 * SwitchRow is held to it too.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (entry.name.endsWith('.tsx') && !/\.test\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('a switch is drawn on every platform — F736', () => {
  test('an off switch shows its track on iOS', () => {
    const switches: { file: string; element: string }[] = [];
    for (const path of sources(SRC)) {
      const body = stripComments(readFileSync(path, 'utf8'));
      for (const m of body.matchAll(/<Switch\b/g)) {
        switches.push({ file: relative(SRC, path).split(sep).join('/'), element: body.slice(m.index, body.indexOf('/>', m.index) + 2) });
      }
    }
    assert.ok(switches.length > 0, 'no Switch is drawn anywhere, so this check reads nothing');
    for (const { file, element } of switches) {
      const off = /trackColor=\{\{ true: [\w.]+, false: ([\w.]+) \}\}/.exec(element);
      assert.ok(off, `${file} draws a Switch with no off track colour`);
      const ios = /ios_backgroundColor=\{([\w.]+)\}/.exec(element);
      assert.ok(ios, `${file} draws a Switch that iOS paints clear when it is off, a bare thumb on the card`);
      assert.equal(ios[1], off[1], `${file} paints its off track one colour on iOS and another elsewhere`);
    }
  });
});

describe('the whole row is the switch — F927', () => {
  test('the whole switch row toggles, said once as a switch', () => {
    const body = stripComments(readFileSync(join(SRC, 'settings/SwitchRow.tsx'), 'utf8'));
    const row = /<Press\b[\s\S]*?style=\{\[st\.row, frame\]\}>/.exec(body)?.[0] ?? '';
    assert.ok(row, 'the row is not a Press, so only the small switch takes a tap');
    assert.match(row, /accessibilityRole="switch"/, 'the row is not announced as a switch');
    assert.match(row, /accessibilityState=\{\{ checked: value, disabled \}\}/, 'the row does not say on or off');
    assert.match(row, /aria-checked=\{value\}/, 'the web does not hear on or off');
    assert.match(row, /onPress=\{\(\) => onChange\(!value\)\}/, 'a tap on the row does not toggle');
    // The knob is the picture of the state, not a second control.
    assert.match(body, /<SwitchKnob value=\{value\} disabled=\{disabled\} on=\{accent\.brand\} off=\{offTrack\} thumb=\{paper\.card\} \/>/, 'the row does not draw its state, or draws it off the palette');
    assert.doesNotMatch(body, /onValueChange=/, 'the inner switch toggles on its own as well as the row');
  });
});

describe('a switch row has one tab stop', () => {
  // React Native Web renders <Switch> as a focusable checkbox, and inside a
  // hidden subtree that is an invisible, unnamed tab stop after the row.
  test('neither switch row draws a platform Switch inside it', () => {
    for (const file of ['settings/SwitchRow.tsx', 'live/DockParts.tsx']) {
      const body = stripComments(readFileSync(join(SRC, file), 'utf8'));
      assert.doesNotMatch(body, /<Switch\b/, `${file} renders a platform Switch inside a row that is already the switch`);
      assert.match(body, /<SwitchKnob\b/, `${file} no longer draws the row's state`);
    }
  });
  test('the knob has nothing to focus, press or announce', () => {
    const knob = stripComments(readFileSync(join(SRC, 'settings/SwitchKnob.tsx'), 'utf8'));
    assert.doesNotMatch(knob, /<(?:Switch|Press|Pressable|TextInput)\b|accessibilityRole|onPress/, 'the knob became a control');
    assert.match(knob, /<View \{\.\.\.decorative\} pointerEvents="none"/, 'the knob is not hidden from assistive tech');
    assert.match(knob, /backgroundColor: value \? on \?\? t\.brand : off \?\? t\.field, alignItems: value \? 'flex-end' : 'flex-start'/, 'on is not brand with the thumb trailing, or off is not field with it leading');
  });
});
