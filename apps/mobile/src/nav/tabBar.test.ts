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
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { b } from '../palette.ts';
import { CAPSULE_HEIGHT, CAPSULE_INSET, MAIN_TABS, TAB_ICONS, TAB_LABELS, LABEL_SIZE, WIDEST_LABEL, WRAPS_UNDER_GLYPH, labelsWrapUnderGlyph, tabAccessibilityLabel, tabCellAt, tabCellUnderFinger, tabLabelsShown, tabPillLeft, tabCapsuleWidth, tabDot } from './tabBarModel.ts';

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
      /const fontScale = PixelRatio\.getFontScale\(\); const wrapped = labelsWrapUnderGlyph\(fontScale\);/,
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
    assert.equal(CAPSULE_HEIGHT, 74, 'the capsule is no longer the 74pt capsule the Figma nav draws');
    assert.match(FLAT, /const CELL_HEIGHT = CAPSULE_HEIGHT - 2 \* space\(1\.5\);/, 'the cell is no longer the 62pt cell inside the capsule');
    assert.match(FLAT, /paddingVertical: space\(1\.5\)/, 'the capsule padding no longer matches what the cell height subtracts');
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
    // Item 7 (2026-11-02): the violet is the one sliding pill, not the cell.
    assert.doesNotMatch(FLAT, /faceSelected/, 'the selected cell paints its own violet beside the pill');
    const pill = read('./TabPill.tsx');
    assert.match(pill, /backgroundColor: t\.tabSelected/, 'the pill is not the violet tab token');
    assert.match(pill, /borderRadius: 20/, 'the pill is not the cell radius');
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

  test('the bar is an ink capsule, radius 32, and never a floating shadow — UI-008, UI-017', () => {
    // 2026-10-20 UI-008, Figma C2/Main2/Navigation 292:1103. Replaces "the bar
    // is white with a top hairline". The capsule is the ink in both themes; the
    // strip around it is clear since UI-017 (founder, 2026-11-01).
    for (const gone of ['Animated', 'useReduceMotion', 'interpolate', 'activeSurface', 'ACTIVE_TAB_SURFACE', 'ACTIVE_TAB_OUTLINE', 'highlight']) {
      assert.ok(!BAR.includes(gone), `the tab bar still carries ${gone}`);
    }
    for (const other of ['accent.primary', 'accent.label', 'accent.brand', 'paper.', 'colour.']) {
      assert.ok(!BAR.includes(other), `the tab bar names ${other}; its colours come only from the b tokens`);
    }
    assert.doesNotMatch(BAR, /#[0-9A-Fa-f]{3,8}\b/, 'the tab bar carries a hex of its own');
    const bar = BAR.slice(BAR.indexOf('bar: {'), BAR.indexOf('},', BAR.indexOf('bar: {')) + 1);
    assert.match(bar, /paddingTop: space\(2\)/, 'the strip has no 8pt above the capsule');
    assert.match(FLAT, /paddingBottom: Math\.max\(insets\.bottom, space\(2\)\)/, 'the safe area is not paid under the capsule');
    const capsule = BAR.slice(BAR.indexOf('capsule: {'), BAR.indexOf('},', BAR.indexOf('capsule: {')) + 1);
    assert.match(capsule, /backgroundColor: t\.tabCapsule/, 'the capsule is not the capsule token');
    assert.match(capsule, /borderRadius: 32/, 'the capsule is not radius 32');
    assert.match(capsule, /paddingHorizontal: space\(2\)/, 'the capsule is not padded 8 across');
    assert.match(capsule, /paddingVertical: space\(1\.5\)/, 'the capsule is not padded 6 down');
    assert.match(FLAT, /const capsule = tabCapsuleWidth\(width, insets\.left, insets\.right\);/, 'the capsule is not inset 12 from the edges inside the safe areas');
    assert.match(FLAT, /\{ width: capsule \}/, 'the capsule is not drawn at that width');
    for (const dock of ['shadowOpacity', 'shadowRadius', 'shadowColor', 'elevation', 'borderTopWidth']) {
      assert.ok(!BAR.includes(dock), `the bar carries ${dock}; it sits in the page, flat`);
    }
    assert.doesNotMatch(BAR, /opacity/, 'pressing a tab fades the whole icon and word away');
    assert.match(FLAT, /tapSettled\(\); navigation\.navigate/, 'a successful tab change gives no tactile answer');
  });

  test('the tab bar is a floating capsule: only the capsule covers content — UI-017', () => {
    // Founder, 2026-11-01 (iPhone): a full-width strip above the capsule cut
    // "Today's three" in half. The strip is now clear, floats over the screen
    // and lets touches through; it reports its height so screens pad past it.
    const bar = BAR.slice(BAR.indexOf('bar: {'), BAR.indexOf('},', BAR.indexOf('bar: {')) + 1);
    assert.doesNotMatch(bar, /backgroundColor/, 'the strip around the capsule is painted, so it covers content');
    assert.match(bar, /position: 'absolute'/, 'the bar is in layout, so content stops at its top edge');
    assert.match(bar, /left: 0, right: 0, bottom: 0/, 'the bar is not pinned full width to the bottom');
    assert.match(FLAT, /pointerEvents="box-none"/, 'the clear strip swallows taps meant for the content behind it');
    assert.match(FLAT, /useContext\(BottomTabBarHeightCallbackContext\)/, 'the bar does not report its height to the navigator');
    assert.match(FLAT, /onLayout=\{\(e\) => reportHeight\?\.\(e\.nativeEvent\.layout\.height\)\}/, 'the bar does not report its measured height');
  });

  test('Profile scrolls past its detached floating bar by the bar\'s own height — UI-017', () => {
    const profile = stripComments(read('../tabs/ProfileTab.tsx')).replace(/\s+/g, ' ');
    assert.match(profile, /<BottomTabBarHeightContext\.Provider value=\{barHeight\}> <ScrollScreen bottom="tab"/, 'Profile does not pad its scroll past the floating bar');
    assert.match(profile, /<BottomTabBarHeightCallbackContext\.Provider value=\{setBarHeight\}> <DetachedTabBar/, 'the detached bar does not report its height to Profile');
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

  test('a tab cell presses through Press with no haptic of its own, and only the selection pill moves', () => {
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
    assert.doesNotMatch(BAR, /\bAnimated\b|useReduceMotion|interpolate/, 'the tab bar animates on its own; only the shared press and TabPill may move');
  });

  test('any tab can be held and dragged sideways to another, with a tick per cell — item 7', () => {
    // Founder, 2026-11-02 (iPhone): hold a tab and drag it to another; any tab, 2026-11-06.
    assert.match(BAR, /^import \{ TabPill \} from '\.\/TabPill\.tsx';$/m, 'the capsule does not draw the sliding pill');
    assert.match(FLAT, /<View ref=\{capsuleRef\} \{\.\.\.drag\.panHandlers\}/, 'the capsule row takes no drag');
    assert.match(FLAT, /<TabPill /, 'the capsule does not draw the pill');
    // Claimed only on sideways movement, from any tab, so a tap and a still long press stay the cell's.
    assert.match(FLAT, /onMoveShouldSetPanResponderCapture: \(_, g\) => geo\.current\.selected >= 0 && Math\.abs\(g\.dx\) > 8 && Math\.abs\(g\.dx\) > Math\.abs\(g\.dy\)/, 'the drag claims taps, long presses or vertical moves');
    assert.match(FLAT, /onPanResponderGrant: \(_, g\) => \{ tick\(\); over\.current = tabCellUnderFinger\(g\.moveX, capsuleX\.current, CAPSULE_SIDE, geo\.current\.cell, routesRef\.current\.length\); \}/, 'the drag grant does not tick and start from the cell under the finger');
    assert.match(FLAT, /if \(now !== over\.current\) \{ over\.current = now; tick\(\); \}/, 'crossing into another cell does not tick');
    assert.match(FLAT, /if \(to !== selected\) routesRef\.current\[to\]\?\.onPress\(\); else tapSettled\(\);/, 'letting go does not navigate the way a tap does');
    assert.match(FLAT, /onPanResponderTerminate: \(\) => setDragX\(null\)/, 'a cancelled drag does not put the pill back');
    // The pill: follows the finger while held, slides on a tap, jumps under Reduce Motion.
    const pill = stripComments(read('./TabPill.tsx')).replace(/\s+/g, ' ');
    assert.match(pill, /const reduced = useReduceMotion\(\);/, 'the pill does not watch Reduce Motion');
    assert.match(pill, /if \(reduced\) \{ cancel\(x\); cancel\(gap\); gap\.value = 0; x\.value = to; held\.current = following; return; \}/, 'the pill does not jump under Reduce Motion');
    assert.match(pill, /x\.value = timing\(to, DUR\.fast, EASE\.out, reduced\);/, 'a tap does not slide the pill');
    assert.match(pill, /\{\.\.\.decorative\}/, 'the pill is heard by a screen reader');
    assert.match(pill, /transform: \[\{ translateX: x\.value \+ gap\.value \}\]/, 'the pill moves by something other than a transform');
  });

  test('the drag geometry: the cell under a finger, clamped, and when it changes — item 7', () => {
    assert.equal(tabCellAt(0, 70, 5), 0);
    assert.equal(tabCellAt(69.9, 70, 5), 0);
    assert.equal(tabCellAt(70, 70, 5), 1);
    assert.equal(tabCellAt(349, 70, 5), 4);
    assert.equal(tabCellAt(-40, 70, 5), 0, 'a finger left of the capsule is not the first cell');
    assert.equal(tabCellAt(900, 70, 5), 4, 'a finger right of the capsule is not the last cell');
    assert.equal(tabCellAt(10, 0, 5), 0, 'an unmeasured capsule divides by zero');
  });

  test('a drag lands on the cell under the finger, not under the pill (verifier, fix 1)', () => {
    // Capsule at x 12, padded 8, cells 70 wide. Grab cell 1 at 0.45 of a cell right of its centre, drag +0.1 cell.
    const grab = 12 + 8 + 70 * 1.5 + 70 * 0.45;
    assert.equal(tabCellUnderFinger(grab, 12, 8, 70, 5), 1);
    assert.equal(tabCellUnderFinger(grab + 7, 12, 8, 70, 5), 2, 'the finger is over the next cell');
    assert.match(FLAT, /tabCellUnderFinger\(g\.moveX, capsuleX\.current, CAPSULE_SIDE, cell, n\)/, 'the bar does not read the finger on move');
  });

  test('the dragged pill is centred on the finger, over the cell release picks (push-check, fix 1)', () => {
    // Capsule at x 12, padded 8, cells 70 wide, five cells.
    const grab = 12 + 8 + 70 * 1.5 + 70 * 0.45;
    const centreCell = (left: number) => tabCellAt(left + 35, 70, 5);
    assert.equal(centreCell(tabPillLeft(grab + 7, 12, 8, 70, 5)), 2, 'the pill is drawn over the old cell while release opens the next');
    for (let x = -100; x <= 500; x += 0.5) {
      const left = tabPillLeft(x, 12, 8, 70, 5);
      assert.ok(left >= 0 && left <= 4 * 70, `the pill leaves the row at finger ${x}`);
      assert.equal(centreCell(left), tabCellUnderFinger(x, 12, 8, 70, 5), `the pill and release disagree at finger ${x}`);
    }
    assert.equal(tabPillLeft(0, 12, 8, 70, 5), 0, 'the pill passes the first end');
    assert.equal(tabPillLeft(900, 12, 8, 70, 5), 280, 'the pill passes the last end');
    assert.match(FLAT, /setDragX\(tabPillLeft\(g\.moveX, capsuleX\.current, CAPSULE_SIDE, cell, n\)\)/, 'the bar draws the pill from the grab, not the finger');
  });

  test('a sideways drag from any tab claims, ticks, and lands on the cell under the finger; the rest is the cell\'s', () => {
    // Lifts the real PanResponder config out of the source and runs it with its free names supplied by hand.
    const start = BAR.indexOf('PanResponder.create(');
    const end = BAR.indexOf('})).current', start) + 2;
    assert.ok(start > 0 && end > start, 'the PanResponder config is not where this test looks');
    const js = stripTypeScriptTypes(`const lifted = ${BAR.slice(start, end)};`);
    function build(selected: number) {
      const log = { ticks: 0, settled: 0, dragX: [] as (number | null)[], pressed: [] as number[] };
      const world: Record<string, unknown> = {
        PanResponder: { create: (c: unknown) => c },
        tick: () => { log.ticks += 1; },
        tapSettled: () => { log.settled += 1; },
        setDragX: (x: number | null) => { log.dragX.push(x); },
        tabCellAt, tabCellUnderFinger, tabPillLeft,
        CAPSULE_SIDE: 8,
        geo: { current: { cell: 70, selected } },
        routesRef: { current: [0, 1, 2, 3, 4].map((i) => ({ onPress: () => { log.pressed.push(i); } })) },
        capsuleX: { current: 12 },
        over: { current: 0 },
      };
      const names = Object.keys(world);
      const pan = new Function(...names, `"use strict";\n${js}\nreturn lifted;`)(...names.map((n) => world[n])) as Record<'onMoveShouldSetPanResponderCapture' | 'onPanResponderGrant' | 'onPanResponderRelease' | 'onStartShouldSetPanResponderCapture', (...a: unknown[]) => unknown>;
      return { pan, log, world };
    }
    const over3 = 12 + 8 + 70 * 3 + 35;
    const ev = { nativeEvent: { pageX: over3 } };
    const g = (dx: number, dy: number) => ({ dx, dy, moveX: over3 });

    const bar = build(0);
    assert.equal(bar.pan.onMoveShouldSetPanResponderCapture(ev, g(20, 2)), true, 'a sideways move from a tab that is not open is not claimed');
    bar.pan.onPanResponderGrant(ev, g(20, 2));
    assert.equal(bar.log.ticks, 1, 'the grant does not tick once');
    bar.pan.onPanResponderRelease(ev, g(20, 2));
    assert.deepEqual(bar.log.pressed, [3], 'letting go without moving further does not land on the cell under the finger');
    assert.equal(bar.pan.onMoveShouldSetPanResponderCapture(ev, g(8, 0)), false, 'a move of 8 or less is claimed');
    assert.equal(bar.pan.onMoveShouldSetPanResponderCapture(ev, g(0, 0)), false, 'a still long press is claimed (F947)');
    assert.equal(bar.pan.onMoveShouldSetPanResponderCapture(ev, g(20, 30)), false, 'a mostly vertical move is claimed');
    assert.equal(bar.pan.onStartShouldSetPanResponderCapture, undefined, 'the touch start is sorted again');

    const detached = build(-1);
    assert.equal(detached.pan.onMoveShouldSetPanResponderCapture(ev, g(20, 2)), false, 'the bar with no open tab claims a drag');
  });

  test('a held pill tracks the finger from the first move and eases only its starting gap; Reduce Motion jumps (Impeccable, F961)', () => {
    const src = read('./TabPill.tsx');
    const start = src.indexOf('useEffect(() => {') + 'useEffect(() => {'.length;
    // The effect body carries no types, so it runs as written.
    const js = src.slice(start, src.indexOf('}, [to,', start));
    const effect = new Function('x', 'gap', 'held', 'to', 'following', 'reduced', 'cancel', 'timing', 'DUR', 'EASE', `"use strict";\n${js}`);
    const pill = (at: number) => {
      const x = { value: at };
      const gap = { value: 0 };
      const held = { current: false };
      const log: string[] = [];
      const run = (to: number, following: boolean, reduced = false) => {
        log.length = 0;
        effect(x, gap, held, to, following, reduced, (v: unknown) => log.push(v === gap ? 'cancel gap' : 'cancel x'), (v: number) => { log.push(`timing ${v}`); return v; }, { fast: 1 }, { out: 0 });
        return [...log];
      };
      return { x, gap, run };
    };
    // Today open (pill at 0), a drag picked up over Journey (target 280), then quick moves 40 apart.
    const p = pill(0);
    assert.ok(p.run(280, true).includes('timing 0'), 'picking the pill up far from the finger does not ease the gap closed');
    assert.equal(p.x.value, 280, 'the pill does not track the finger from the first move');
    for (const to of [240, 200, 160]) {
      assert.ok(!p.run(to, true).some((l) => l.startsWith('timing')), `a quick move to ${to} starts another ease, so the pill trails the finger`);
      assert.equal(p.x.value, to, `the pill is not under the finger at ${to}`);
    }
    // Released over Speak (140): the pill slides from where it is drawn.
    assert.ok(p.run(140, false).includes('timing 140'), 'letting go does not slide the pill home');
    assert.equal(p.gap.value, 0, 'the gap survives the release, so the next drag starts offset');
    // A tap slides; Reduce Motion jumps with no ease at all.
    assert.deepEqual(pill(0).run(70, false), ['timing 70'], 'a tap no longer slides the pill');
    const r = pill(0);
    assert.ok(!r.run(280, true, true).some((l) => l.startsWith('timing')), 'under Reduce Motion the pill eases instead of jumping');
    assert.equal(r.x.value, 280);
    assert.equal(r.gap.value, 0);
  });

  test('a drag across the bar does not select the tab words on web (push-check browser pass)', () => {
    assert.match(FLAT, /<Text selectable=\{false\} style=\{\[st\.label,/, 'a mouse drag over the bar highlights the words it crosses');
  });

  test('the drag guards: a tap stays the cell\'s, geometry is measured, no pill without a tab (push-check, fix 3)', () => {
    assert.doesNotMatch(BAR, /startedOnSelected|onStartShouldSetPanResponder/, 'the touch start takes or sorts the touch, so a tap no longer reaches the cell');
    assert.match(FLAT, /<View ref=\{capsuleRef\} [^>]*onLayout=\{\(\) => capsuleRef\.current\?\.measureInWindow\(\(x\) => \{ capsuleX\.current = x; \}\)\}/, 'the capsule never measures where it sits, so the finger is read from 0');
    assert.doesNotMatch(BAR, /\bCAPSULE_PAD\b/, 'the bar reuses tabBarModel\'s CAPSULE_PAD name (16, both sides) for 8 per side');
    const pad = Number(/const CAPSULE_SIDE = (\d+);/.exec(BAR)?.[1]);
    const capsuleStyle = FLAT.slice(FLAT.indexOf('capsule: {'), FLAT.indexOf('cell: {'));
    const styled = /paddingHorizontal: space\((\d+(?:\.\d+)?)\)/.exec(capsuleStyle);
    assert.ok(styled, 'the capsule style lost its side padding');
    assert.equal(pad, Number(styled[1]) * 4, 'the drag\'s side padding is not the capsule style\'s, so the finger maps to the wrong cell');
    assert.match(FLAT, /const cell = Math\.max\(0, \(capsule - 2 \* CAPSULE_SIDE\) \/ routes\.length\);/, 'the cell width is not the padded capsule over the tab count');
    assert.match(FLAT, /\{selected >= 0 && <TabPill /, 'Profile\'s detached bar, with no open tab, draws a pill');
    const release = FLAT.slice(FLAT.indexOf('onPanResponderRelease:'), FLAT.indexOf('onPanResponderTerminationRequest:'));
    assert.match(release, /setDragX\(null\);/, 'letting go leaves the pill pinned to the finger');
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

  test('tab bar labels never clip at accessibility text sizes', () => {
    // F947, founder decision 2026-10-31: icons only at the largest sizes. The
    // widest word is measured at the label's size times the reading size; when
    // it cannot fit whole in a fifth of the capsule, every word goes and the
    // icons stay, each tab still heard by its full name.
    const em = 0.6; // must stay at or above the widest real Outfit Bold average per letter
    for (const phone of [320, 402]) {
      const capsule = tabCapsuleWidth(phone, 0, 0);
      const room = (capsule - 16) / 5 - 8;
      for (const scale of [1.3, 2.0, 2.35, 3.1]) {
        const widest = Math.max(...Object.values(TAB_LABELS).map((w) => w.length * 13 * em * scale));
        assert.ok(
          widest <= room || !tabLabelsShown(scale, capsule),
          `at ${scale}x on ${phone}pt a ${Math.round(widest)}pt word is drawn in ${Math.round(room)}pt and clips`,
        );
      }
      // Below the accessibility sizes nothing changes.
      assert.equal(tabLabelsShown(1, capsule), true, `the words are hidden at the default size on ${phone}pt`);
      assert.equal(tabLabelsShown(1.2, capsule), true, `the words are hidden below the accessibility sizes on ${phone}pt`);
    }
    // A tablet's capsule has room for the words at 1.5.
    assert.equal(tabLabelsShown(1.5, tabCapsuleWidth(768, 0, 0)), true, 'the words are hidden on a tablet at 1.5');
    // The measure is the label's real size and the real widest word.
    const small = /export const boldType = \{[\s\S]*?\n  small: \{[^}]*fontSize: (\d+)/.exec(read('../theme.ts'));
    assert.equal(Number(small?.[1]), LABEL_SIZE, 'the measured label size is not boldType.small');
    assert.equal(WIDEST_LABEL, Math.max(...MAIN_TABS.map((r) => TAB_LABELS[r]!.length)));
    // With the words hidden, iOS's Large Content Viewer shows the word on a long press.
    assert.match(FLAT, /accessibilityShowsLargeContentViewer=\{!shown\}/, 'a hidden word has no Large Content Viewer');
    assert.match(FLAT, /accessibilityLargeContentTitle=\{shown \? undefined : label\}/, 'the Large Content Viewer has no title');
    assert.match(FLAT, /style=\{\[st\.capsule, \{ width: capsule \}\]\}>/, 'the capsule width is computed twice');
    // The bar draws the word only when the model says it fits, and every tab
    // keeps its full name for a screen reader.
    assert.match(FLAT, /tabLabelsShown\(fontScale, capsule\)/, 'the bar does not ask the model whether the words fit');
    assert.match(FLAT, /\{shown && <Text (?:selectable=\{false\} )?style=\{\[st\.label/, 'the bar draws the word even when it cannot fit whole');
    assert.match(FLAT, /accessibilityLabel=\{tabAccessibilityLabel\(route\.name, dot\)\}/, 'a tab without its word loses its name for a screen reader');
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
    // icon to TabGlyph; only its selection pill moves (F600, item 7); TabGlyph draws the
    // Linear icon once, in one layer, and lifts it once on a real change.
    assert.match(BAR, /^import \{ TabGlyph \} from '\.\/TabGlyph\.tsx';$/m, 'the bar does not hand its icons to TabGlyph');
    assert.match(
      FLAT,
      /<TabGlyph focused=\{focused\} badged=\{dot\}> \{\(\) => <Icon name=\{icon\} variant="linear" size=\{22\} color=\{focused \? t\.tabGlyphSelected : t\.tabLabel\} \/>\} <\/TabGlyph>/,
      'the cell does not wrap its Linear icon in TabGlyph',
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
      /const before = wasFocused\.current; wasFocused\.current = focused; if \(!focused\) \{ cancel\(pop\); pop\.value = 0; return; \}/,
      'leaving a tab does not put its icon back at rest',
    );
    assert.match(flat, /if \(before\) return;/, 'the icon pops on mount or on a tap of the tab already open');
    // Under Reduce Motion the icon is simply there, and nothing moves.
    assert.match(flat, /if \(reduced\) \{ pop\.value = 0; return; \}/, 'Reduce Motion does not land the selected icon still');
    assert.match(flat, /useEffect\(\(\) => \{ if \(reduced\) land\(\); \}, \[reduced, land\]\);/, 'turning Reduce Motion on mid-pop does not land it');
    assert.match(flat, /pop\.value = 0; dot\.value = 1;/, 'landing does not put the icon at rest on its own drawing');
    assert.match(flat, /useLandOnLeave\(land\);/, 'the pop keeps running when the app leaves the foreground');
    // The lift: up on the select beat, home on the pop spring.
    assert.match(
      flat,
      /pop\.value = sequence\(reduced, timing\(1, SELECT_POP_MS, EASE\.out, reduced\), spring\(0, SPRING\.pop, reduced\)\);/,
      'the selected icon does not rise and come home on the pop spring',
    );
    // Item 8 (founder, 2026-11-01): one icon layer, no cross-fade, no scale, so the icon stays sharp.
    assert.equal((flat.match(/\{children\(\)\}/g) ?? []).length, 1, 'TabGlyph draws the icon more than once');
    assert.doesNotMatch(flat, /\bfill\b|children\((true|false)\)/, 'TabGlyph cross-fades two drawings of the icon');
    assert.match(flat, /transform: \[\{ translateY: -TAB_POP\.lift \* pop\.value \}\]/, 'the pop does not only lift the icon');
    const motion = read('../icons/iconMotion.ts');
    assert.match(motion, /export const TAB_POP = \{ lift: 2 \} as const;/, 'the pop is not up two points only');
    // The Practice dot pops only when nothing due becomes something due.
    assert.match(flat, /if \(badged !== true \|\| before !== false\) return;/, 'the dot pops for something other than nothing due becoming due');
    // Transform and opacity only, no loop.
    assert.doesNotMatch(glyph, /\brepeat\(|withRepeat|width:\s*\w+\.value|height:\s*\w+\.value/, 'TabGlyph loops or animates its size');
    const styles = [...glyph.matchAll(/useAnimatedStyle\(\(\) => \(\{([\s\S]*?)\}\)\);/g)];
    assert.equal(styles.length, (glyph.match(/useAnimatedStyle\(/g) ?? []).length, 'an animated style is written in a shape this check cannot read');
    assert.equal(styles.length, 2, 'TabGlyph has not exactly its lift and dot styles');
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
