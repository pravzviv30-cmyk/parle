/**
 * The bottom bar at the largest reading sizes — F583, closing F461.
 *
 * F461 was filed off a screenshot at AX5: "My French" and "Profile" ran into
 * each other because five cells sharing the bar by flex let a long word borrow
 * room from a short one until there was none left. The fix is not a cap of any
 * kind, so the thing this test mostly does is prove the caps are still absent.
 *
 * Read as source, because there is no renderer in this workspace
 * (docs/TESTING.md). The ceiling is honest: it proves the bar asks the reading
 * size and lays its cells out from the answer, never that a phone drew two
 * whole words side by side. P8-2 in the device runbook is where that is settled.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { b } from '../palette.ts';
import { CAPSULE_INSET, MAIN_TABS, TAB_ICONS, TAB_LABELS, WRAPS_UNDER_GLYPH, labelsWrapUnderGlyph, tabAccessibilityLabel, tabCapsuleWidth, tabDot } from './tabBarModel.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const BAR = stripComments(read('./LuvaniTabBar.tsx'));
/** One line, so a regex about an expression reads code and not the wrapping. */
const FLAT = BAR.replace(/\s+/g, ' ');

describe('the bottom bar keeps every whole word at the largest reading size — F583', () => {
  test('the tab bar labels wrap without colliding at the largest reading size', () => {
    // The bar has to know the reading size before it can lay out differently
    // for it, and PixelRatio is the one that reports the OS setting itself.
    assert.match(
      FLAT,
      /PixelRatio\.getFontScale\(\)/,
      'the bar never asks how big the words are, so the AX5 layout is the same layout as the default one',
    );
    assert.match(
      FLAT,
      /const wrapped = labelsWrapUnderGlyph\(PixelRatio\.getFontScale\(\)\)/,
      'the reading size is read but nothing is decided from it',
    );
    // 2026-10-20 UI-008, Figma 292:1103: the rule moved to tabBarModel.ts.
    assert.equal(WRAPS_UNDER_GLYPH, 1.3, 'the wrapping threshold moved off 1.3 without a word about why');
    assert.equal(labelsWrapUnderGlyph(1.29), false, 'the words wrap below the threshold');
    assert.equal(labelsWrapUnderGlyph(1.3), true, 'the words do not wrap at the threshold');
    assert.match(BAR, /labelsWrapUnderGlyph,? .*from '\.\/tabBarModel\.ts'/, 'the bar decides wrapping by its own rule instead of the model');

    // And the large branch is a width per cell, not a cap on the word.
    assert.match(
      FLAT,
      /wrapped && st\.cellWrapped/,
      'the cells never take the wrapped layout, so the rule is decided and then thrown away',
    );
    const from = BAR.indexOf('cellWrapped: {');
    assert.notEqual(from, -1, 'the wrapped cell style is gone; this test is reading the wrong thing');
    const cell = BAR.slice(from, BAR.indexOf('},', from) + 1);
    assert.match(cell, /flexBasis: '20%'/, 'a wrapped cell does not take a fifth of the bar, so the five cells share it again');
    assert.match(cell, /flexGrow: 0/, 'a wrapped cell can still grow into its neighbour');
    assert.match(cell, /flexShrink: 0/, 'a wrapped cell can still be shrunk out of its quarter by a longer neighbour');

    // The floor under every cell is still a floor: a two-line word makes the
    // cell taller, and nothing here is allowed to make it shorter.
    // 2026-10-20 UI-008, Figma 292:1103: the floor is the 62pt cell.
    assert.match(FLAT, /const CELL_HEIGHT = 62;/, 'the cell is no longer the 62pt cell the Figma nav draws');
    assert.match(FLAT, /minHeight: CELL_HEIGHT/, 'the cell keeps no height floor, so a wrapped word could be clipped');
    assert.doesNotMatch(FLAT, /\bheight: CELL_HEIGHT/, 'the cell is a fixed height, so a wrapped word is clipped');

    // The whole of F313's rule, restated because this is the change most likely
    // to reach for one of them: no word is shortened, scaled or clipped to fit.
    for (const cap of ['numberOfLines', 'maxWidth', 'adjustsFontSizeToFit', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(
        !BAR.includes(cap),
        `the tab bar caps its label with ${cap}; at the largest reading size a word must wrap and the bar grow to hold it`,
      );
    }
  });

  test('the selected cell is violet with a sun Linear glyph and a bold cream word; the rest are cream on ink — UI-008', () => {
    // 2026-10-20 UI-008, Figma C2/Main2/Navigation 292:1103 (and Codex's bar).
    // Replaces revamp B's brand blue word on white: the words are cream on the
    // ink capsule or on the violet cell, both well over the text floor.
    assert.match(FLAT, /accessibilityState=\{\{ selected: focused \}\}/, 'a screen reader is not told which tab is selected');
    assert.match(
      FLAT,
      /if \(!focused && !event\.defaultPrevented\) \{ tapSettled\(\); navigation\.navigate\(route\.name as never\); announceTab\(route\.name\); \}/,
      'a tap on the tab you are already on announces a move that did not happen',
    );
    assert.match(FLAT, /color=\{focused \? t\.tabGlyphSelected : t\.tabLabel\}/, 'the selected glyph is not sun, or the others are not cream');
    // 2026-10-20 UI-008, Figma M3 292:1103: the selected glyph is the gold Linear
    // drawing. Bulk draws its body at 0.4 and reads as a muddy shape on violet.
    assert.match(FLAT, /variant="linear"/, 'the selected glyph is not the gold Linear drawing');
    assert.doesNotMatch(FLAT, /variant=\{bulk \? 'bulk'/, 'the selected glyph went back to the Bulk drawing');
    assert.match(FLAT, /style=\{\[st\.face, focused && st\.faceSelected\]\}/, 'the selected cell is not filled');
    assert.match(FLAT, /faceSelected: \{ backgroundColor: t\.tabSelected \}/, 'the selected cell is not the violet tab token');
    assert.match(FLAT, /fontFamily: focused \? font\.bold : font\.medium/, 'the selected word is not Bold and the rest Medium');
    assert.match(FLAT, /label: \{ \.\.\.boldType\.small, color: t\.tabLabel, textAlign: 'center' \}/, 'the word is not C2 small (13/18) in the cream label token');
    assert.match(FLAT, /size=\{22\}/, 'the glyph is not 22pt');
    assert.ok(!/\bst\.dot\b/.test(BAR), 'the bar marks the active cell with a dot again');
  });

  test('the cell is the 62pt Figma cell: radius 20, padding 4, gap 4 — UI-008', () => {
    // 2026-10-20 UI-008, Figma 292:1103.
    const from = BAR.indexOf('face: {');
    assert.notEqual(from, -1, 'the face style is gone; this test is reading the wrong thing');
    const face = BAR.slice(from, BAR.indexOf('},', from) + 1);
    assert.match(face, /borderRadius: 20/, 'the cell is not radius 20');
    assert.match(face, /padding: space\(1\)/, 'the cell is not padded 4');
    assert.match(face, /gap: space\(1\)/, 'the glyph and word are not 4 apart');
  });

  test('the bar is an ink capsule, radius 32, on the route ground, and never a floating shadow — UI-008', () => {
    // 2026-10-20 UI-008, Figma C2/Main2/Navigation 292:1103. Replaces "the bar
    // is white with a top hairline". The strip is the focused route's ground and
    // stays in layout; the capsule inside it is the ink in both themes.
    for (const gone of ['Animated', 'useReduceMotion', 'interpolate', 'activeSurface', 'ACTIVE_TAB_SURFACE', 'ACTIVE_TAB_OUTLINE', 'highlight']) {
      assert.ok(!BAR.includes(gone), `the tab bar still carries ${gone}`);
    }
    for (const other of ['accent.primary', 'accent.label', 'accent.brand', 'paper.', 'colour.']) {
      assert.ok(!BAR.includes(other), `the tab bar names ${other}; its colours come only from the b tokens`);
    }
    assert.doesNotMatch(BAR, /#[0-9A-Fa-f]{3,8}\b/, 'the tab bar carries a hex of its own');
    const bar = BAR.slice(BAR.indexOf('bar: {'), BAR.indexOf('},', BAR.indexOf('bar: {')) + 1);
    assert.match(bar, /backgroundColor: t\.ground/, 'the strip is not the route ground');
    assert.match(bar, /paddingTop: space\(2\)/, 'the strip has no 8pt above the capsule');
    assert.match(FLAT, /paddingBottom: Math\.max\(insets\.bottom, space\(2\)\)/, 'the safe area is not paid under the capsule');
    const capsule = BAR.slice(BAR.indexOf('capsule: {'), BAR.indexOf('},', BAR.indexOf('capsule: {')) + 1);
    assert.match(capsule, /backgroundColor: t\.tabCapsule/, 'the capsule is not the capsule token');
    assert.match(capsule, /borderRadius: 32/, 'the capsule is not radius 32');
    assert.match(capsule, /paddingHorizontal: space\(2\)/, 'the capsule is not padded 8 across');
    assert.match(capsule, /paddingVertical: space\(1\.5\)/, 'the capsule is not padded 6 down');
    assert.match(FLAT, /width: tabCapsuleWidth\(width, insets\.left, insets\.right\)/, 'the capsule is not inset 12 from the edges inside the safe areas');
    for (const dock of ['shadowOpacity', 'shadowRadius', 'shadowColor', 'elevation', "position: 'absolute'", 'borderTopWidth']) {
      assert.ok(!BAR.includes(dock), `the bar carries ${dock}; it sits in the page, flat`);
    }
    assert.doesNotMatch(BAR, /opacity/, 'pressing a tab fades the whole icon and word away');
    assert.match(FLAT, /tapSettled\(\); navigation\.navigate/, 'a successful tab change gives no tactile answer');
  });

  test('the capsule tokens are the ink, violet, sun and cream in both themes — UI-008', () => {
    for (const mode of ['light', 'dark'] as const) {
      assert.equal(b[mode].tabCapsule, '#16123A', `the ${mode} capsule is not the ink`);
      assert.equal(b[mode].tabSelected, '#3B2FE0', `the ${mode} selected cell is not violet`);
      assert.equal(b[mode].tabGlyphSelected, '#FFC93C', `the ${mode} selected glyph is not sun`);
      assert.equal(b[mode].tabLabel, '#FFF6E9', `the ${mode} words are not cream`);
    }
    assert.equal(b.light.ground, '#FFF6E9');
    assert.equal(b.dark.ground, '#151127');
  });

  test('the capsule is 12pt in from each edge inside the safe areas, capped at 640 — UI-008', () => {
    assert.equal(CAPSULE_INSET, 12);
    assert.equal(tabCapsuleWidth(390, 0, 0), 366, 'the Figma frame: 366 wide on a 390 phone');
    assert.equal(tabCapsuleWidth(320, 0, 0), 296);
    assert.equal(tabCapsuleWidth(600, 47, 47), 482, 'the side safe areas are not paid before the 12pt inset');
    assert.equal(tabCapsuleWidth(1024, 0, 0), 640, 'a tablet capsule is not capped at 640');
    assert.equal(tabCapsuleWidth(10, 0, 0), 0, 'a tiny window gives a negative width');
    // Five wrapped fifths of the narrowest capsule, inside its 8pt padding, stay over the floor.
    assert.ok((tabCapsuleWidth(320, 0, 0) - 16) / 5 >= 44, 'a fifth of the 320pt capsule is under the touch floor');
  });

  test('a tab cell presses through Press with no haptic of its own, and the bar still moves nothing', () => {
    // 2026-09-30, revamp B (F597, F600). The cell is the shared press: the one
    // spring, released on lift, instant under reduced motion. It asks for no
    // haptic, because the tick belongs to the tap that really changes tab and
    // is already given inside onPress; a second one would tick on the tab you
    // are already on.
    assert.match(
      FLAT,
      /<Press haptic="none" frame=\{\[st\.cell, wrapped && st\.cellWrapped\]\}/,
      'the tab cell does not press through the shared Press, or it asks for a haptic of its own',
    );
    assert.match(BAR, /^import \{ Press \} from '\.\.\/components\.tsx';$/m, 'the tab bar builds its own press instead of the shared one');
    const cell = FLAT.slice(FLAT.indexOf('<Press haptic="none"'), FLAT.indexOf('</Press>'));
    assert.match(cell, /accessibilityRole="tab"/, 'the pressed cell is announced as a button rather than a tab');
    assert.doesNotMatch(BAR, /<Pressable\b/, 'the tab bar hand-rolls a Pressable beside the shared press');
    assert.doesNotMatch(BAR, /cellPressed/, 'the static pressed style is back');
    assert.doesNotMatch(BAR, /scale: 0\.985/, 'the tab bar scales by hand again instead of on the spring');
    assert.doesNotMatch(BAR, /\bAnimated\b|useReduceMotion|interpolate/, 'the tab bar animates on its own; only the shared press may move a cell');
  });

  test('the five words are Today, Explore, Speak, Practice and Journey over Codex\'s Iconsax drawings — UI-008', () => {
    // 2026-10-20 UI-008, Figma 292:1103. Route names, which deep links and every
    // navigate() call spell, do not move; only the words and drawings did.
    assert.deepEqual([...MAIN_TABS], ['Home', 'Explore', 'Tutor', 'Practice', 'MyFrench']);
    assert.deepEqual(MAIN_TABS.map((r) => TAB_LABELS[r]), ['Today', 'Explore', 'Speak', 'Practice', 'Journey']);
    assert.deepEqual(MAIN_TABS.map((r) => TAB_ICONS[r]), ['home', 'exploring', 'microphone', 'cards', 'progress']);
    assert.match(FLAT, /<Icon name=\{icon\}/, 'the bar does not draw the model\'s Iconsax names');
    assert.match(FLAT, /const icon = TAB_ICONS\[route\.name\];/);
    assert.match(FLAT, /const label = TAB_LABELS\[route\.name\] \?\? route\.name;/);
    const names = read('../icons/names.ts');
    for (const name of Object.values(TAB_ICONS)) assert.match(names, new RegExp(`'${name}'`), `${name} is not in the generated set`);
  });

  test('the Practice dot waits for the deck and is heard as practice ready — UI-008', () => {
    assert.equal(tabDot('Practice', null), null, 'the dot shows before the deck is read');
    assert.equal(tabDot('Practice', 0), false);
    assert.equal(tabDot('Practice', 3), true);
    assert.equal(tabDot('Home', 3), false, 'a tab other than Practice carries the dot');
    assert.equal(tabAccessibilityLabel('Practice', true), 'Practice, practice ready');
    assert.equal(tabAccessibilityLabel('Practice', null), 'Practice');
    assert.equal(tabAccessibilityLabel('MyFrench', false), 'Journey');
    const glyph = read('./TabGlyph.tsx');
    assert.match(glyph, /style=\{\[st\.badge, \{ backgroundColor: t\.sun \}, mark\]\}/, 'the dot is not sun, so it vanishes into the ink capsule');
  });

  test('five cells fit a 320pt phone above the touch floor', () => {
    // A fifth of the narrowest supported phone, the width a wrapped cell takes.
    assert.ok(320 / 5 >= 44, 'a fifth of a 320pt bar falls under the 44pt touch floor');
    const order = [...FLAT.matchAll(/<Tab\.Screen name="(\w+)"/g)].map((m) => m[1]);
    assert.ok(order.length === 0 || order.length === 5, 'the bar no longer has five cells');
  });
});

describe('the selected tab icon pops once — F737', () => {
  test('the selected tab icon springs in TabGlyph and lands still under Reduce Motion', () => {
    // Come alive (D7): the selected tab shows it was chosen. The bar hands each
    // icon to TabGlyph and still moves nothing itself (F600); TabGlyph draws the
    // Bulk icon over the Linear one and pops it once on a real change.
    assert.match(BAR, /^import \{ TabGlyph \} from '\.\/TabGlyph\.tsx';$/m, 'the bar does not hand its icons to TabGlyph');
    assert.match(
      FLAT,
      /<TabGlyph focused=\{focused\} badged=\{dot\}> \{\(\) => <Icon name=\{icon\} variant="linear" size=\{22\} color=\{focused \? t\.tabGlyphSelected : t\.tabLabel\} \/>\} <\/TabGlyph>/,
      'the cell does not wrap its icon in TabGlyph, Linear and Bulk drawn by the same icon',
    );
    assert.match(FLAT, /const dot = tabDot\(route\.name, due\);/, 'the Practice dot does not come from the model rule that waits for the deck');

    const glyph = stripComments(read('./TabGlyph.tsx'));
    const flat = glyph.replace(/\s+/g, ' ');
    // Live reduced motion, from the one hook.
    assert.match(glyph, /^import \{ useReduceMotion \} from '\.\.\/motion\.ts';$/m, 'TabGlyph does not read reduced motion from motion.ts');
    assert.match(flat, /const reduced = useReduceMotion\(\);/, 'TabGlyph does not watch reduced motion live');
    // Only on a change to selected: not selected lands at rest, and selected already (mount or a re-tap) returns.
    assert.match(
      flat,
      /const before = wasFocused\.current; wasFocused\.current = focused; if \(!focused\) \{ cancel\(pop\); cancel\(fill\); pop\.value = 0; fill\.value = 0; return; \}/,
      'leaving a tab does not put its icon back to the still Linear drawing',
    );
    assert.match(flat, /if \(before\) return;/, 'the icon pops on mount or on a tap of the tab already open');
    // Under Reduce Motion the Bulk drawing is simply there, and nothing scales.
    assert.match(flat, /if \(reduced\) \{ pop\.value = 0; fill\.value = 1; return; \}/, 'Reduce Motion does not land the selected icon still');
    assert.match(flat, /useEffect\(\(\) => \{ if \(reduced\) land\(\); \}, \[reduced, land\]\);/, 'turning Reduce Motion on mid-pop does not land it');
    assert.match(flat, /pop\.value = 0; fill\.value = wasFocused\.current \? 1 : 0; dot\.value = 1;/, 'landing does not put the icon at rest on its own drawing');
    assert.match(flat, /useLandOnLeave\(land\);/, 'the pop keeps running when the app leaves the foreground');
    // The pop: up on the select beat, home on the pop spring; the Bulk drawing fades in over DUR.micro.
    assert.match(
      flat,
      /pop\.value = sequence\(reduced, timing\(1, SELECT_POP_MS, EASE\.out, reduced\), spring\(0, SPRING\.pop, reduced\)\);/,
      'the selected icon does not rise and come home on the pop spring',
    );
    assert.match(flat, /fill\.value = timing\(1, DUR\.micro, EASE\.out, reduced\);/, 'the Bulk drawing does not fade in over the Linear one');
    assert.match(
      flat,
      /transform: \[\{ translateY: -TAB_POP\.lift \* pop\.value \}, \{ scale: 1 \+ \(TAB_POP\.scale - 1\) \* pop\.value \}\]/,
      'the pop does not lift and grow the icon',
    );
    const motion = read('../icons/iconMotion.ts');
    assert.match(motion, /export const TAB_POP = \{ scale: 1\.15, lift: 2 \} as const;/, 'the pop is not to 1.15 and up two points');
    // The Practice dot pops only when nothing due becomes something due.
    assert.match(flat, /if \(badged !== true \|\| before !== false\) return;/, 'the dot pops for something other than nothing due becoming due');
    // Transform and opacity only, no loop.
    assert.doesNotMatch(glyph, /\brepeat\(|withRepeat|width:\s*\w+\.value|height:\s*\w+\.value/, 'TabGlyph loops or animates its size');
    const styles = [...glyph.matchAll(/useAnimatedStyle\(\(\) => \(\{([\s\S]*?)\}\)\);/g)];
    assert.equal(styles.length, (glyph.match(/useAnimatedStyle\(/g) ?? []).length, 'an animated style is written in a shape this check cannot read');
    assert.ok(styles.length >= 4, 'TabGlyph has lost its lift, cross-fade or dot styles, so this check reads nothing');
    for (const [, body] of styles) {
      const keys = [...(body ?? '').matchAll(/(\w+):/g)].map((m) => m[1]);
      assert.ok(keys.every((key) => ['transform', 'opacity', 'translateY', 'scale'].includes(key!)), `TabGlyph animates ${keys.join(', ')}`);
    }
  });
});

test('a cold Friends link exits to the main tabs instead of creating a Profile back loop', () => {
  const source = readFileSync(new URL('../tabs/FriendsTab.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(nav.canGoBack\(\)\) nav.goBack\(\); else nav.navigate\('Tabs'\)/);
});
