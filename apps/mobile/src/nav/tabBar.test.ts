/** M2/M3 dock contracts. Historical visual titles remain for defect evidence.
 * The approved C2 dock supersedes white-bar/four-tab styling; accessibility,
 * large text, tactile feedback and bounded icon motion remain mandatory.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8');
function stripComments(source: string): string { return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); }
const BAR = stripComments(read('./LuvaniTabBar.tsx'));
const FLAT = BAR.replace(/\s+/g, ' ');
test("the tab bar labels wrap without colliding at the largest reading size", () => {
  assert.match(FLAT, /const wrapped = labelsWrapUnderGlyph\(PixelRatio.getFontScale\(\)\)/);
  assert.match(FLAT, /fontScale >= WRAPS_UNDER_GLYPH/);
  assert.match(FLAT, /WRAPS_UNDER_GLYPH = 1.6/);
  assert.match(FLAT, /wrapped && st.cellWrapped/);
  assert.match(FLAT, /cellWrapped: \{ flexBasis: '20%', flexGrow: 0, flexShrink: 0/);
  assert.match(FLAT, /minHeight: HIT \+ space\(4\)/);
  for (const cap of ['numberOfLines', 'maxWidth', 'adjustsFontSizeToFit', 'maxFontSizeMultiplier', 'allowFontScaling']) assert.ok(!BAR.includes(cap), cap);
});

test("the active tab is the brand blue at weight 700, the rest soft ink at 600, and a screen reader still hears selected", () => {
  assert.match(FLAT, /accessibilityState=\{\{ selected: focused \}\}/);
  assert.match(FLAT, /aria-selected=\{focused\}/);
  assert.match(FLAT, /if \(!focused && !event.defaultPrevented\) \{ tapSettled\(\); navigation.navigate\(route.name as never\); announceTab\(route.name\); \}/);
  assert.match(FLAT, /focused && \{ backgroundColor: colour.blue \}/);
  assert.match(FLAT, /color=\{focused \? colour.sun : paper.ground\}/);
  assert.match(FLAT, /fontFamily: focused \? font.bold : font.medium/);
  assert.doesNotMatch(BAR, /\bst.dot\b/);
});

test("the bar is white with a top hairline, and never a floating shadow", () => {
  assert.match(FLAT, /backgroundColor: colors.background/);
  assert.match(FLAT, /cells: \{ flexDirection: 'row', backgroundColor: paper.ink, borderRadius: 32/);
  assert.doesNotMatch(BAR, /shadowOpacity|shadowRadius|elevation|position: 'absolute'/);
  assert.doesNotMatch(BAR, /opacity|Animated|interpolate/);
  assert.match(FLAT, /tapSettled\(\); navigation.navigate/);
});

test("a tab cell presses through Press with no haptic of its own, and the bar still moves nothing", () => {
  assert.match(FLAT, /<Press key=\{route.key\} haptic="none"/);
  assert.match(FLAT, /frame=\{\[st.cell, wrapped && st.cellWrapped\]\}/);
  assert.match(FLAT, /accessibilityRole="tab"/);
  assert.match(BAR, /import \{ Press \} from '\.\.\/components.tsx'/);
  assert.doesNotMatch(BAR, /<Pressable\b|cellPressed|scale: 0.985|useReduceMotion|interpolate/);
});

test("the four words are Home, Speak, Practice and Progress; Friends remains a stack route", () => {
  const tabs = BAR.match(/MAIN_TABS = \[([^\]]+)\]/)?.[1]?.match(/'([^']+)'/g) ?? [];
  assert.deepEqual(tabs, ["'Home'", "'Explore'", "'Tutor'", "'Library'", "'MyFrench'"]);
  assert.equal(new Set(tabs).size, 5);
  for (const label of ["Home: 'Home'", "Explore: 'Explore'", "Tutor: 'Speak'", "Library: 'My French'", "MyFrench: 'Progress'"]) assert.ok(BAR.includes(label), label);
  assert.match(BAR, /current === 'Practice' && name === 'Library'/);
  const nav = read('./RootNavigator.tsx');
  assert.match(nav, /name="Practice" component=\{LegacyPracticeRoute\}/);
  assert.match(nav, /<Stack.Screen name="Friends"/);
});

describe('the selected tab icon pops once — F737', () => {
  test('the selected tab icon springs in TabGlyph and lands still under Reduce Motion', () => {
    // Come alive (D7): the selected tab shows it was chosen. The bar hands each
    // icon to TabGlyph and still moves nothing itself (F600); TabGlyph draws the
    // Bulk icon over the Linear one and pops it once on a real change.
    assert.match(BAR, /^import \{ TabGlyph \} from '\.\/TabGlyph\.tsx';$/m, 'the bar does not hand its icons to TabGlyph');
    assert.match(FLAT, /<TabGlyph focused=\{focused\} badged=\{dot\}>/);
    assert.match(FLAT, /variant=\{bulk \? 'bulk' : 'linear'\}/);
    assert.match(FLAT, /const dot = name === 'Library' \? due === null \? null : due > 0 : false;/, 'the Practice dot does not wait for the first read of the deck');

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
