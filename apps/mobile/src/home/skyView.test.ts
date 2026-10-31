/**
 * Today's sky (UI-015): the hour picks the time of day and the palette picks
 * the colours. Held at all twenty-four hours, at each boundary, and against
 * the greeting word, so the sky and Bonsoir always agree.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sky } from '../palette.ts';
import { greetingWord } from './greeting.ts';
import { skyNow, skyView, type SkyTime } from './skyView.ts';

const at = (hour: number, minute = 0): number => new Date(2026, 0, 15, hour, minute, 0, 0).getTime();
const expected = (hour: number): SkyTime => (hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : hour >= 18 && hour < 22 ? 'evening' : 'night');

describe("Today's sky", () => {
  test('every hour has a time and the palette colours, in both modes', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const time = expected(hour);
      const day = time === 'morning' || time === 'afternoon';
      const light = skyView(hour, 'light');
      assert.equal(light.time, time, `${hour}:00`);
      assert.equal(light.discKind, day ? 'sun' : 'moon');
      assert.deepEqual({ ground: light.ground, disc: light.disc, chip: light.chip, lip: light.lip }, { ...sky.light[time] });
      const dark = skyView(hour, 'dark');
      assert.equal(dark.time, time);
      assert.equal(dark.discKind, day ? 'sun' : 'moon');
      assert.deepEqual({ ground: dark.ground, disc: dark.disc, chip: dark.chip, lip: dark.lip }, { ...(day ? sky.dark.day : sky.dark.night) });
    }
  });

  test('the boundaries fall on the hour', () => {
    assert.equal(skyView(4, 'light').time, 'night');
    assert.equal(skyView(5, 'light').time, 'morning');
    assert.equal(skyView(11, 'light').time, 'morning');
    assert.equal(skyView(12, 'light').time, 'afternoon');
    assert.equal(skyView(17, 'light').time, 'afternoon');
    assert.equal(skyView(18, 'light').time, 'evening');
    assert.equal(skyView(21, 'light').time, 'evening');
    assert.equal(skyView(22, 'light').time, 'night');
    assert.equal(skyNow(at(4, 59), 'light').time, 'night');
    assert.equal(skyNow(at(5), 'light').time, 'morning');
  });

  test('an unreadable hour or clock lands on the afternoon', () => {
    assert.equal(skyView(Number.NaN, 'light').time, 'afternoon');
    assert.equal(skyView(Number.POSITIVE_INFINITY, 'dark').time, 'afternoon');
    assert.equal(skyNow(Number.NaN, 'light').time, 'afternoon');
    assert.equal(skyNow(1e20, 'dark').time, 'afternoon');
  });

  test('the evening and the night are exactly the hours of Bonsoir', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const evening = ['evening', 'night'].includes(skyNow(at(hour), 'light').time);
      assert.equal(evening, greetingWord(at(hour)) === 'Bonsoir', `${hour}:00`);
    }
  });
});

describe('the clouds sit in the top of the sky — fix round 1', () => {
  test('both clouds start right of the greeting, the upper one clear of the profile button, sized with the width', async () => {
    const { cloudPlaces } = await import('./skyView.ts');
    for (const width of [320, 375, 402]) {
      // "Bonjour," at 34pt ExtraBold ends about 170pt across the band.
      const greetingRight = 170;
      const clouds = cloudPlaces(width, greetingRight);
      assert.ok(clouds.length >= 1, `no cloud at ${width}`);
      for (const c of clouds) {
        assert.ok(c.left >= greetingRight + 8, `a cloud sits on the greeting at ${width}`);
        assert.ok(c.top <= 64, `a cloud sits down by the tiles at ${width}`);
        if (c.top < 48) assert.ok(c.left + c.width <= width - 20 - 44 - 8, `the upper cloud runs into the profile button at ${width}`);
      }
    }
    const wide = cloudPlaces(375, 120);
    assert.equal(wide[0]!.left, Math.round(375 * 0.48));
    assert.equal(wide[1]!.left, Math.round(375 * 0.66));
    assert.deepEqual(wide.map((c) => c.top), [16, 56]);
    const band = readFileSync(new URL('./SkyBand.tsx', import.meta.url), 'utf8');
    assert.match(band, /cloudPlaces\(width, greetingRight\)\.map\(/);
    assert.doesNotMatch(band, /top: 120|top: 176/, 'the clouds are back at the board tops, under the tiles');
    assert.ok(band.indexOf('cloudPlaces(') < band.indexOf('accessibilityRole="header"'), 'a cloud is drawn over the greeting');
  });
});

describe('the status bar over Today, and path rows at large text — fix round 2', () => {
  test('light over the sky; the theme bar once the sky has scrolled under it; none while Today is not on top', async () => {
    const { skyBarStyle, skyScrolledPast } = await import('./skyView.ts');
    assert.equal(skyBarStyle({ focused: true, scrolledPast: false, themeBar: 'dark' }), 'light');
    assert.equal(skyBarStyle({ focused: true, scrolledPast: true, themeBar: 'dark' }), 'dark', 'white icons over white paper');
    assert.equal(skyBarStyle({ focused: true, scrolledPast: true, themeBar: 'light' }), 'light');
    assert.equal(skyBarStyle({ focused: false, scrolledPast: false, themeBar: 'dark' }), null);
    const size = { band: 300, bar: 62 };
    assert.equal(skyScrolledPast(0, size), false);
    assert.equal(skyScrolledPast(237, size), false);
    assert.equal(skyScrolledPast(238, size), true);
    assert.equal(skyScrolledPast(500, null), false, 'an unmeasured sky is called scrolled past');
    const band = readFileSync(new URL('./SkyBand.tsx', import.meta.url), 'utf8');
    assert.match(band, /const barStyle = skyBarStyle\(\{ focused, scrolledPast, themeBar: t\.statusBar \}\);/);
    assert.match(band, /\{barStyle !== null \? <StatusBar style=\{barStyle\} \/> : null\}/);
    assert.doesNotMatch(band, /<StatusBar style="light"/, 'the sky still pins the bar light');
    const home = readFileSync(new URL('../tabs/HomeTab.tsx', import.meta.url), 'utf8');
    assert.match(home, /onScroll=\{\(event\) => \{ const past = skyScrolledPast\(event\.nativeEvent\.contentOffset\.y, skySize\); if \(past !== scrolledPast\) setScrolledPast\(past\); \}\}/, 'the state is not set only when it changes');
    assert.match(home, /scrolledPast=\{scrolledPast\} onMeasure=\{setSkySize\}/);
  });

  test('at accessibility text sizes a row puts its action under the words, inside the one press', async () => {
    const { routeRowStacked } = await import('./skyView.ts');
    const { ROWS_FONT_SCALE } = await import('../game/todayHeroView.ts');
    assert.equal(routeRowStacked(1.0), false);
    assert.equal(routeRowStacked(1.59), false);
    assert.equal(routeRowStacked(ROWS_FONT_SCALE), true);
    assert.equal(routeRowStacked(2.2), true);
    assert.equal(routeRowStacked(Number.NaN), false);
    const row = readFileSync(new URL('./RoutePath.tsx', import.meta.url), 'utf8');
    assert.match(row, /const stacked = routeRowStacked\(useWindowDimensions\(\)\.fontScale\);/);
    const words = row.slice(row.indexOf('<View style={st.rowWords}>'), row.indexOf('{action !== null'));
    assert.match(words, /\{stacked && action !== null && <Text[^>]*>\{action\.label\}<\/Text>\}/, 'the action is not under the words');
    assert.match(row, /\? stacked \? null : <Text/, 'the action is drawn twice at large text');
    assert.equal((row.match(/<Press\b/g) ?? []).length, 1, 'the row is no longer one press');
  });
});
