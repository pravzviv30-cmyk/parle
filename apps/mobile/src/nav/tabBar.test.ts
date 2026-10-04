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
    assert.match(
      FLAT,
      /function labelsWrapUnderGlyph\(fontScale: number\): boolean \{ return fontScale >= WRAPS_UNDER_GLYPH; \}/,
      'the threshold is decided inline rather than by one named rule, so the bar and this test can drift apart',
    );
    assert.match(FLAT, /const WRAPS_UNDER_GLYPH = 1\.6;/, 'the wrapping threshold moved off 1.6 without a word about why');

    // And the large branch is a width per cell, not a cap on the word.
    assert.match(
      FLAT,
      /wrapped && st\.cellWrapped/,
      'the cells never take the wrapped layout, so the rule is decided and then thrown away',
    );
    const from = BAR.indexOf('cellWrapped: {');
    assert.notEqual(from, -1, 'the wrapped cell style is gone; this test is reading the wrong thing');
    const cell = BAR.slice(from, BAR.indexOf('},', from) + 1);
    assert.match(cell, /flexBasis: '25%'/, 'a wrapped cell does not take a quarter of the bar, so the four cells share it again');
    assert.match(cell, /flexGrow: 0/, 'a wrapped cell can still grow into its neighbour');
    assert.match(cell, /flexShrink: 0/, 'a wrapped cell can still be shrunk out of its quarter by a longer neighbour');

    // The floor under every cell is still a floor: a two-line word makes the
    // cell taller, and nothing here is allowed to make it shorter.
    assert.match(FLAT, /minHeight: HIT \+ space\(4\)/, 'the cell no longer keeps a height floor at the touch target');

    // The whole of F313's rule, restated because this is the change most likely
    // to reach for one of them: no word is shortened, scaled or clipped to fit.
    for (const cap of ['numberOfLines', 'maxWidth', 'adjustsFontSizeToFit', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(
        !BAR.includes(cap),
        `the tab bar caps its label with ${cap}; at the largest reading size a word must wrap and the bar grow to hold it`,
      );
    }
  });

  test('the active tab is the brand blue at weight 700, the rest soft ink at 600, and a screen reader still hears selected', () => {
    // The layout change is the only change: every signal F313 and F325 put on
    // this bar is read back here, because a cell restyled without them is a bar
    // a screen reader cannot use.
    assert.match(FLAT, /accessibilityState=\{\{ selected: focused \}\}/, 'a screen reader is not told which tab is selected');
    assert.match(
      FLAT,
      /if \(!focused && !event\.defaultPrevented\) \{ tapSettled\(\); navigation\.navigate\(route\.name as never\); announceTab\(route\.name\); \}/,
      'a tap on the tab you are already on announces a move that did not happen',
    );
    // 2026-09-30, revamp B (F600): SNIPPETS' bar. Selected is the glyph and the
    // word in the brand blue at Outfit Bold (7.9 on white); the rest are the
    // glyph and the word in soft ink at SemiBold (6.6 on white), so every word
    // on the bar clears the text floor, selected or not.
    assert.match(
      FLAT,
      /color=\{focused \? accent\.brand : paper\.inkSoft\}/,
      'the active tab glyph is not the brand blue, or the inactive one is not soft ink',
    );
    assert.match(
      FLAT,
      /focused \? \{ color: accent\.brand, fontFamily: font\.bold \}/,
      'the active tab label is not the brand blue at Outfit Bold',
    );
    assert.match(FLAT, /\{ color: paper\.inkSoft \}/, 'the inactive tab label is no longer soft ink');
    // The 600 is the tab label token's own weight, so the unselected word takes
    // it by not naming a face, and the token is read to prove it is SemiBold.
    assert.match(FLAT, /label: \{ \.\.\.type\.tabLabel, textAlign: 'center' \}/, 'the tab word is not set in the tab label token');
    assert.match(read('../theme.ts'), /tabLabel: \{ fontFamily: font\.semiBold,/, 'the tab label token is no longer Outfit SemiBold, so the unselected word is not at 600');
    assert.ok(!/\bst\.dot\b/.test(BAR), 'the bar marks the active cell with a dot again');
  });

  test('the bar is white with a top hairline, and never a floating shadow', () => {
    // 2026-09-30, revamp B (F600). Replaces "the bar is flat on paper with a top
    // hairline". The wash, its outline, its lift and every animation stay
    // refused; the one accent the bar may name is the brand blue, and the
    // identity ink, the caps-label colour and the chartreuse stay off it.
    for (const gone of ['Animated', 'useReduceMotion', 'interpolate', 'activeSurface', 'ACTIVE_TAB_SURFACE', 'ACTIVE_TAB_OUTLINE', 'highlight']) {
      assert.ok(!BAR.includes(gone), `the tab bar still carries ${gone}`);
    }
    assert.match(BAR, /\baccent\.brand\b/, 'the bar no longer names the brand blue for the selected tab');
    for (const other of ['accent.primary', 'accent.label']) {
      assert.ok(!BAR.includes(other), `the tab bar names ${other}; the selected tab is the brand blue and nothing else`);
    }
    const from = BAR.indexOf('bar: {');
    assert.notEqual(from, -1, 'the bar style is gone; this test is reading the wrong thing');
    const bar = BAR.slice(from, BAR.indexOf('},', from) + 1);
    assert.match(bar, /backgroundColor: paper\.card/, 'the bar is not white');
    assert.match(bar, /borderTopWidth: HAIRLINE/, 'the bar has no top hairline');
    assert.match(bar, /borderTopColor: paper\.line/, 'the top rule is not the paper hairline');
    for (const dock of ['borderRadius', 'marginHorizontal', 'borderColor: paper.ink', 'shadowOpacity', 'shadowRadius', 'elevation', "position: 'absolute'"]) {
      assert.ok(!bar.includes(dock), `the bar still carries ${dock}, so it is a dock rather than a flat bar`);
    }
    // Pressing a tab shrinks it on the spring; it never fades the icon and word away.
    assert.doesNotMatch(BAR, /opacity/, 'pressing a tab fades the whole icon and word away');
    assert.match(FLAT, /tapSettled\(\); navigation\.navigate/, 'a successful tab change gives no tactile answer');
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

  test('the four words are Home, Speak, Practice and Progress; Friends remains a stack route', () => {
    // 2026-09-30, revamp B (F600). Replaces "Home is labelled Today". The words
    // under the glyphs follow the approved bar; the route names, which deep
    // links and every navigate() call spell, do not move.
    assert.match(
      FLAT,
      /const LABELS: Record<string, string> = \{ Home: 'Home', Tutor: 'Speak', Practice: 'Practice', MyFrench: 'Progress', \};/,
      'the four words under the glyphs are not Home, Speak, Practice and Progress',
    );
    assert.match(
      FLAT,
      /const ICONS: Record<string, \(p: TabIconProps\) => React\.ReactElement> = \{ Home: HomeIcon, Tutor: TutorIcon, Practice: PracticeIcon, MyFrench: MyFrenchIcon, \};/,
      'a route name changed; only the word under the glyph was meant to',
    );
  });
});

test('a cold Friends link exits to the main tabs instead of creating a Profile back loop', () => {
  const source = readFileSync(new URL('../tabs/FriendsTab.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(nav.canGoBack\(\)\) nav.goBack\(\); else nav.navigate\('Tabs'\)/);
});
