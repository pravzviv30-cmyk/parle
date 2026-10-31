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
    assert.equal(skyScrolledPast(500, null), false, 'an unmeasured sky should never count as scrolled past');
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

describe('fix round 3: clouds, the one sky clock, and the greeting clear of the disc', () => {
  test('a cloud with under 40pt of room is left out, and the first frame guesses the greeting at half the band', async () => {
    const { cloudPlaces } = await import('./skyView.ts');
    // A greeting that runs almost to the profile button leaves the upper cloud no room.
    const crowded = cloudPlaces(320, 220);
    assert.ok(crowded.every((c) => c.top !== 16), 'a cloud under 40pt wide is still drawn');
    assert.ok(crowded.every((c) => c.width >= 40));
    // Unmeasured: the greeting is taken to end at half the band.
    const first = cloudPlaces(375, null);
    assert.equal(first[0]!.left, Math.round(375 * 0.5 + 8), 'the first frame does not keep clear of a greeting it has not measured');
    assert.ok(first.every((c) => c.left >= 375 * 0.5 + 8));
  });

  test('the sky and the greeting move on together at 12:00, 18:00, 22:00 and 05:00, and not between', async () => {
    const { skyClockMoved } = await import('./skyView.ts');
    assert.equal(skyClockMoved(at(11, 58), at(11, 59)), false);
    assert.equal(skyClockMoved(at(9), at(11, 59)), false, 'the clock moves inside one window');
    for (const [from, to] of [[11, 12], [17, 18], [21, 22], [4, 5]] as const) assert.equal(skyClockMoved(at(from, 59), at(to)), true, `Today keeps the old sky past ${to}:00`);
    const home = readFileSync(new URL('../tabs/HomeTab.tsx', import.meta.url), 'utf8');
    assert.match(home, /const skyClock = useSkyClock\(focused\);/);
    assert.match(home, /homeGreeting\(firstName, skyClock\)/);
    assert.match(home, /skyNow\(skyClock, t\.mode\)/);
    assert.doesNotMatch(home, /skyNow\(Date\.now\(\)|homeGreeting\(firstName, Date\.now\(\)\)/, 'the sky and the greeting read two clocks');
    assert.doesNotMatch(home, /setInterval|setTimeout/, 'HomeTab runs a timer of its own');
    const hook = readFileSync(new URL('./useSkyClock.ts', import.meta.url), 'utf8');
    assert.match(hook, /if \(!focused\) return;/);
    assert.match(hook, /setInterval\(check, DAY_CHECK_MS\)/);
    assert.match(hook, /skyClockMoved\(drawn, at\) \? at : drawn/, 'the clock bumps on every tick');
  });

  test('the disc slides right just enough to clear the measured greeting, and never caps it', async () => {
    const { SKY_DISC, discShiftFor } = await import('./skyView.ts');
    const r = SKY_DISC.size / 2;
    const clears = (width: number, bar: number, box: { left: number; right: number; top: number; bottom: number }, shift: number) => {
      const cx = width + SKY_DISC.bleed - r + shift;
      const cy = r - SKY_DISC.bleed;
      const near = Math.min(Math.max(cy, bar + 8 + box.top), bar + 8 + box.bottom);
      const nx = Math.min(Math.max(cx, box.left), box.right);
      return Math.hypot(nx - cx, near - cy) >= r + 8 - 0.5;
    };
    // "Bonjour," / "Léa." at the default size on 375: no slide.
    const short = { left: 20, right: 154, top: 0, bottom: 72 };
    assert.equal(discShiftFor({ width: 375, bar: 62, box: short }), 0);
    // A long name at 320 reaches under the disc: it slides exactly enough, no more.
    const long = { left: 20, right: 240, top: 0, bottom: 72 };
    const shift = discShiftFor({ width: 320, bar: 20, box: long });
    assert.ok(shift > 0, 'a greeting under the disc does not move it');
    assert.ok(clears(320, 20, long, shift), 'the slide is not enough');
    assert.ok(!clears(320, 20, long, shift - 2), 'the disc slides further than it needs to');
    // A box the width of the band slides the disc fully off.
    assert.equal(discShiftFor({ width: 320, bar: 20, box: { left: 20, right: 320, top: 0, bottom: 144 } }), 320 - (320 + SKY_DISC.bleed - 2 * r));
    // Unmeasured, or not a number: no slide, never NaN.
    assert.equal(discShiftFor({ width: 320, bar: 20, box: null }), 0);
    assert.equal(discShiftFor({ width: 320, bar: null, box: long }), 0);
    for (const bad of [Number.NaN, Infinity]) {
      assert.equal(discShiftFor({ width: bad, bar: 20, box: long }), 0);
      assert.equal(discShiftFor({ width: 320, bar: 20, box: { ...long, right: bad } }), 0);
    }
    const band = readFileSync(new URL('./SkyBand.tsx', import.meta.url), 'utf8');
    assert.match(band, /const shift = discShiftFor\(\{ width, bar, box: greetingBox \}\);/);
    assert.match(band, /style=\{\[s\.disc, \{ right: DISC_BLEED - shift \}\]\}/, 'the disc does not slide clear of the greeting');
    assert.match(band, /setGreetingBox\(\{ left: BAND_PAD \+ x, right: BAND_PAD \+ x \+ w, top: y, bottom: y \+ h \}\)/, 'the slide is not from the measured box');
    assert.doesNotMatch(band, /maxWidth/, 'the greeting is capped again, which splits words');
    const sky = readFileSync(new URL('./skyView.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(sky, /GREETING_CHAR_WIDTH|greetingWordWidth|greetingLayout|greetingMaxWidth/, 'the width estimate is back');
  });

  test('the sky clock stops its timer when Today leaves the top or unmounts', () => {
    const hook = readFileSync(new URL('./useSkyClock.ts', import.meta.url), 'utf8');
    assert.match(hook, /const timer = setInterval\(check, DAY_CHECK_MS\);\s*return \(\) => clearInterval\(timer\);/, 'the interval keeps running after cleanup');
  });

  test('the row art is one size from RoutePath, and a label on a still LipTile is read', () => {
    const route = readFileSync(new URL('./RoutePath.tsx', import.meta.url), 'utf8');
    assert.match(route, /export const ROW_ART = 40;/);
    for (const file of ['../tabs/HomeTab.tsx', '../practice/NextTaskCard.tsx', '../dev/TodayPreview.tsx']) {
      const body = readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.doesNotMatch(body, /const ROW_ART\b/, `${file} sizes the row art itself`);
      assert.match(body, /import \{ ROW_ART, RouteRow \} from '\.\.\/home\/RoutePath\.tsx';/);
    }
    const components = readFileSync(new URL('../components.tsx', import.meta.url), 'utf8');
    const lip = components.slice(components.indexOf('export function LipTile('), components.indexOf('return (\n    <View style={[ground, faded]}>\n      <Press'));
    assert.match(lip, /if \(onPress === undefined\) \{[\s\S]*?<View style=\{\[ground, faded\]\} accessible=\{accessibilityLabel !== undefined\} accessibilityLabel=\{accessibilityLabel\}/, 'a still LipTile carries a label no screen reader reaches');
  });
});
