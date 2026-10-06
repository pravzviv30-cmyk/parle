/**
 * A recorder's ring moves only by a level the microphone really reported
 * (come alive, core loop 3.6). Pure; the hook that polls the recorder and the
 * rings it feeds are read as text, because this workspace has no renderer and
 * no suite may import expo-audio or the engine (motion.test.ts, rule 7).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LEVEL_CEILING_DB, LEVEL_FLOOR_DB, LEVEL_POLL_MS, levelFromMetering, levelOfStatus } from './recorderLevel.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const flat = (relative: string): string =>
  read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\s+/g, ' ');

describe('a recorder level, heard and never made up', () => {
  test('metering maps onto the ring from still to full, and no reading is no level', () => {
    assert.equal(levelFromMetering(LEVEL_FLOOR_DB), 0);
    assert.equal(levelFromMetering(-160), 0, 'silence moved the ring');
    assert.equal(levelFromMetering(LEVEL_CEILING_DB), 1);
    assert.equal(levelFromMetering(0), 1, 'the loudest the microphone takes overflowed the ring');
    assert.equal(levelFromMetering((LEVEL_FLOOR_DB + LEVEL_CEILING_DB) / 2), 0.5);
    for (const nothing of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(levelFromMetering(nothing), null, `${String(nothing)} became a level`);
    }
    // Only a live, metered take has a level.
    assert.equal(levelOfStatus(null), null);
    assert.equal(levelOfStatus({ isRecording: false, metering: -20 }), null, 'a stopped recorder still swelled the ring');
    assert.equal(levelOfStatus({ isRecording: true }), null, 'a recorder that does not meter was given a level');
    assert.equal(levelOfStatus({ isRecording: true, metering: -30 }), 0.5);
    assert.ok(LEVEL_POLL_MS > 0 && LEVEL_POLL_MS <= 100, 'the ring would lag the voice it follows');
  });

  test('each recorder in the core loop is metered and rings only once a level is heard', () => {
    const hook = flat('./useRecorderLevel.ts');
    assert.match(hook, /const now = levelOfStatus\(status\); if \(now === null\) return; level\.value = now;/, 'the ring is fed something other than a level the recorder reported');
    assert.match(hook, /if \(!heard\) \{ heard = true; setMetered\(true\); \}/);
    for (const file of ['../DrillScreen.tsx', '../drill/SpokenAttempt.tsx', '../daily/DailyPracticeScreen.tsx']) {
      const screen = flat(file);
      assert.match(screen, /const METERED_TAKE = \{ \.\.\.RecordingPresets\.HIGH_QUALITY, isMeteringEnabled: true \};/, `${file} records without metering, so its ring could never move`);
      assert.match(screen, /useAudioRecorder\(METERED_TAKE\)/, `${file} records with an unmetered preset`);
      assert.match(screen, /useRecorderLevel\(recorder, /, `${file} has no level for its ring`);
      assert.match(screen, /&& voice\.metered && /, `${file} draws its ring before any level was heard`);
    }
  });
});
