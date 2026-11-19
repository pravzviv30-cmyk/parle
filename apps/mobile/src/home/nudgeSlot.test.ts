/**
 * Today's nudge slot as Today draws it (Board A moment 3, founder 2026-11-19):
 * the freeze line waits for its seen mark to be read, so it never shows and
 * then vanishes, is marked seen (synced) once it has been drawn, and the sky
 * draws the 20pt freeze mark beside it only when the line asks for one.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addDays, streakFrom } from '@luvani/core';

import { homeNudge } from './nudge.ts';
import { nudgeSlot } from './nudgeSlot.ts';

const TODAY = '2026-10-07';
const before = (n: number): string => addDays(TODAY, -n);
const covered = streakFrom({ practiceDays: [before(4), before(3), before(2)], covers: [{ day: before(1), kind: 'freeze', at: 1 }], today: TODAY });
const KEY = `covered:${before(1)}`;
const flat = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\s+/g, ' ');

describe("Board A: Today's nudge slot, drawn and marked seen", () => {
  test('the freeze line waits until its seen mark is read, then shows once, or gives way to the usual line', () => {
    assert.deepEqual(nudgeSlot(covered, TODAY, new Map()), { nudge: null, ask: KEY }, 'the line drew before its seen mark was read');
    assert.deepEqual(nudgeSlot(covered, TODAY, new Map([[KEY, false]])), { nudge: { text: 'A freeze covered yesterday.', freezeMark: true, seenKey: KEY }, ask: null });
    assert.deepEqual(nudgeSlot(covered, TODAY, new Map([[KEY, true]])), { nudge: { text: homeNudge(covered)!, freezeMark: false, seenKey: null }, ask: null }, 'a seen line came back');
    // No freeze to tell: nothing to read first.
    const plain = streakFrom({ practiceDays: [before(3), before(2), before(1)], covers: [], today: TODAY });
    assert.deepEqual(nudgeSlot(plain, TODAY, new Map()), { nudge: { text: homeNudge(plain)!, freezeMark: false, seenKey: null }, ask: null });
    assert.deepEqual(nudgeSlot(null, TODAY, new Map()), { nudge: null, ask: null });
  });

  test('Today reads the seen mark, and marks the line seen in the synced game store once it has drawn where Home can be seen', () => {
    const stats = flat('../game/TodayStats.tsx');
    assert.match(stats, /const \{ nudge, ask \} = nudgeSlot\(run, today, known\);/);
    assert.match(stats, /hasSeen\(ask\)/);
    // Marked from what was drawn, never from what was only computed.
    assert.match(stats, /const shownKey = seenNow\(drawn\?\.model\.nudge\?\.seenKey \?\? null, useDrawGate\(\)\);/);
    assert.match(stats, /void markSeen\(\[\{ key: shownKey, at: Date\.now\(\) \}\]\)/);
    assert.match(stats, /return children\(\{ tiles, nudge: drawn\.model\.nudge\?\.text \?\? null, freezeMark: drawn\.model\.nudge\?\.freezeMark === true \}\);/);
    assert.match(flat('../tabs/HomeTab.tsx'), /nudge=\{nudge\} freezeMark=\{freezeMark\}/);
  });

  test('the sky draws the 20pt freeze mark beside the line only when the line asks for it, on one row', () => {
    // Every sky ground, light and dark, takes white onBrand words; on 'blue' the crystal trades to white, so it reads where they do.
    const sky = flat('./SkyBand.tsx');
    assert.match(sky, /\{nudge !== null \? \( <View style=\{s\.nudge\}> \{freezeMark \? <FreezeMark size=\{20\} ground="blue" \/> : null\} <Text style=\{\[type\.body, s\.grow, \{ color: t\.onBrand \}\]\}>\{nudge\}<\/Text> <\/View> \) : null\}/);
    assert.match(sky, /nudge: \{ flexDirection: 'row', alignItems: 'center', gap: space\(2\) \}/);
  });
});
