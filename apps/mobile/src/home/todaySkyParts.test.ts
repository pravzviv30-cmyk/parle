/**
 * Today's sky parts (UI-015, T3): the rules the parts draw from, and the
 * shared lip chrome, read from source because the suite has no renderer.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { STAT_GAP, statCoins, statRowTileWidth, statTileLayout } from '../game/todayHeroView.ts';
import { flamePops } from './homeDraw.ts';
import { routeRowLabel } from './routeRow.ts';
import { greetingLines } from './skyView.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (body: string) => body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the stat tiles choose their layout from the measured row', () => {
  test('a row is three tiles with two gaps between them', () => {
    assert.equal(statRowTileWidth(343), (343 - 2 * STAT_GAP) / 3);
    // 375 less the page margins: side by side; 320: the coin stacks; accessibility text: rows.
    assert.equal(statTileLayout(statRowTileWidth(375 - 32), 1), 'side');
    assert.equal(statTileLayout(statRowTileWidth(320 - 32), 1), 'stacked');
    assert.equal(statTileLayout(statRowTileWidth(375 - 32), 1.6), 'rows');
  });

  test('the tiles measure their row and read the reading size', () => {
    const tiles = strip(read('../game/TodayStatTiles.tsx'));
    assert.match(tiles, /statTileLayout\(statRowTileWidth\(rowWidth \?\? windowWidth - ROW_MARGINS\), fontScale, \[tiles\.streak\.number, tiles\.goal\.number, tiles\.level\.number\]\)/);
    assert.match(tiles, /onLayout=\{\(event\) => setRowWidth\(event\.nativeEvent\.layout\.width\)\}/);
    assert.match(tiles, /<CountUp key=\{`run-\$\{run\.mount\}`\} from=\{run\.from\} to=\{run\.to\}/);
    assert.match(tiles, /<CountUp key=\{`level-\$\{chip\.mount\}`\} from=\{chip\.from\} to=\{chip\.to\}/);
    assert.match(tiles, /<PopOnce play=\{flamePop\}>/);
    assert.match(tiles, /<LipTile lip=\{lip\} onPress=\{onPress\} accessibilityLabel=\{label\}/, 'a tile is not the shared chrome with one spoken label');
  });

  test('the flame pops only when the streak rose and today counted', () => {
    assert.equal(flamePops({ from: 2, to: 3, mount: 1 }, true), true);
    assert.equal(flamePops({ from: 2, to: 3, mount: 1 }, false), false);
    assert.equal(flamePops({ from: 3, to: 3, mount: 1 }, true), false);
    assert.equal(flamePops(undefined, true), false);
  });

  test('the coins follow the dark table', () => {
    const tokens = { butter: 'b', heroChip: 'h', sage: 's', lavender: 'l' };
    assert.deepEqual(statCoins({ ...tokens, mode: 'light' }), { streak: 'b', goal: 's', level: 'l' });
    assert.deepEqual(statCoins({ ...tokens, mode: 'dark' }), { streak: 'h', goal: 's', level: 'l' });
  });

  test('the container keeps every behaviour of the old hero', () => {
    const stats = strip(read('../game/TodayStats.tsx'));
    // Fix round 3: the focus effect re-reads the game layer; an emptied callback fails.
    assert.match(stats, /useFocusEffect\(\s*useCallback\(\(\) => \{\s*refresh\(\);\s*\}, \[refresh\]\),?\s*\)/, 'Today does not re-read the game layer on focus');
    assert.match(stats, /if \(dayTurned\(today, Date\.now\(\)\)\) refresh\(\);/);
    assert.match(stats, /DAY_CHECK_MS/);
    assert.match(stats, /useHomeDraw<HeroModel>\(today, hero === null \? null : \{ hero, nudge \}, \(model\) => heroCounts\(model\.hero\)\)/);
    assert.match(stats, /tiles: failed \? null : <TodayStatTilesSkeleton sky=\{sky\} \/>/, 'an unread game layer draws something');
    assert.match(stats, /streak: shown\.flame\.count === null \? undefined : counters\.streak/, 'no run counts a nought up');
    assert.match(stats, /onStreak=\{\(\) => nav\.navigate\('Streak'\)\}/);
    assert.match(stats, /onGoal=\{\(\) => nav\.navigate\('Streak'\)\}/);
    assert.match(stats, /onLevel=\{\(\) => nav\.navigate\('MyFrench'\)\}/);
  });
});

describe("Today's path row and greeting", () => {
  test('a row says its title, its line and what the press does, once', () => {
    // Fix round 3: an English row is one label, eyebrow first.
    assert.deepEqual(routeRowLabel({ title: 'Review 4 phrases', line: 'About 2 minutes', action: { label: 'Practise' } }), { label: 'Review 4 phrases, About 2 minutes, Practise', hint: undefined, language: undefined });
    assert.deepEqual(routeRowLabel({ eyebrow: 'Next scene', title: 'Order at a café', line: ' ' }), { label: 'Next scene, Order at a café', hint: undefined, language: undefined });
    // A French title is the label alone, in French; the eyebrow, line and action are the hint.
    assert.deepEqual(
      routeRowLabel({ eyebrow: "Today's phrase", title: 'Je voudrais un café.', titleLang: 'fr', line: 'I would like a coffee, please.', action: { label: 'Say it' } }),
      { label: 'Je voudrais un café.', hint: "Today's phrase. I would like a coffee, please. Say it", language: 'fr' },
    );
    assert.deepEqual(routeRowLabel({ title: 'Salut', titleLang: 'fr' }), { label: 'Salut', hint: undefined, language: 'fr' });
    const route = strip(read('./RoutePath.tsx'));
    assert.match(route, /const said = routeRowLabel\(\{ eyebrow, title, titleLang, line, action \}\);/, 'the eyebrow or the language is dropped from what is said');
    assert.match(route, /accessibilityLabel=\{said\.label\} accessibilityHint=\{said\.hint\} accessibilityLanguage=\{said\.language\}/);
    assert.match(route, /row: \{ minHeight: HIT,/);
  });

  test('the greeting is two lines with a name and one without', () => {
    assert.deepEqual(greetingLines({ word: 'Bonjour', name: 'Léa' }), ['Bonjour,', 'Léa.']);
    assert.deepEqual(greetingLines({ word: 'Bonsoir', name: null }), ['Bonsoir.']);
    const band = strip(read('./SkyBand.tsx'));
    assert.match(band, /accessibilityRole="header" accessibilityLabel=\{greeting\.title\}/);
    assert.doesNotMatch(band, /#[0-9A-Fa-f]{6}|rgba\(/);
  });
});

describe('LipTile, the shared game-button chrome', () => {
  const lip = (() => {
    const body = strip(read('../components.tsx'));
    return body.slice(body.indexOf('export type LipTone'), body.indexOf('const lipStyles'));
  })();

  test('each tone is the token of its name, and the lip defaults to line', () => {
    assert.match(lip, /export type LipTone = 'card' \| 'mint' \| 'mintWash' \| 'butter' \| 'lavender' \| 'sage' \| 'peach';/);
    assert.match(lip, /backgroundColor: t\[tone\]/);
    // mintWash (drill B v2's right tile and sheet) is a useB() token, so t[tone] fills it.
    assert.match(read('../palette.ts'), /mintWash:/);
    assert.match(lip, /backgroundColor: lip \?\? t\.line/);
    assert.match(lip, /tile: \{ radius: radius\.stat, lip: 4 \}/);
    assert.match(lip, /chip: \{ radius: radius\.field, lip: 3 \}/);
    assert.doesNotMatch(lip, /shadow/i, 'the lip is a shadow');
  });

  test('a press sinks the tile 2pt into its lip, at the touch floor', () => {
    assert.match(lip, /export const LIP_PRESS = 2;/);
    assert.match(lip, /const sunk = pressed && !disabled \? LIP_PRESS : 0;/);
    assert.match(lip, /marginTop: sunk,\s*marginBottom: shape\.lip - sunk/);
    assert.match(lip, /onPressIn=\{\(\) => setPressed\(true\)\}/);
    assert.match(lip, /haptic="light"/);
    assert.match(read('../components.tsx'), /const lipStyles = StyleSheet\.create\(\{ hit: \{ minHeight: HIT \} \}\);/);
  });

  test('selected draws the mark edge, disabled fades and takes no press', () => {
    assert.match(lip, /selected \? \{ borderWidth: LIP_EDGE, borderColor: t\.mark \}/);
    assert.match(lip, /const faded = disabled \? \{ opacity: LIP_DISABLED \} : null;/);
    assert.match(lip, /disabled=\{disabled\}/);
    assert.match(lip, /if \(onPress === undefined\) \{/, 'a tile with no press is still a button');
  });
});
