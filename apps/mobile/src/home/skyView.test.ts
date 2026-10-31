/**
 * Today's sky (UI-015): the hour picks the time of day and the palette picks
 * the colours. Held at all twenty-four hours, at each boundary, and against
 * the greeting word, so the sky and Bonsoir always agree.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

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
