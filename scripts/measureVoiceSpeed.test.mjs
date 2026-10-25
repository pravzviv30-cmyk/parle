import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAP, CONDITIONS, LINES, buildPlan, clipStats, estimateTotal, summarise } from './measureVoiceSpeed.mjs';

test('voice speed plan is 8 requests, every one with an explicit speed, under the cap', () => {
  const plan = buildPlan();
  assert.equal(plan.length, 8);
  assert.equal(CONDITIONS.length * LINES.length, 8);
  assert.ok(CONDITIONS.some(c => c.speed === 1), 'speed 1.0 is its own condition, sent explicitly');
  assert.ok(estimateTotal(plan) > 0 && estimateTotal(plan) <= CAP);
  assert.equal(new Set(plan.map(p => p.name)).size, 8, 'clip names are unique');
  const flash = plan.find(p => p.model === 'eleven_flash_v2_5');
  assert.equal(flash.estimate, Math.ceil(flash.chars / 2));
});

test('clip stats and summary derive pace from PCM bytes and compare with speed 1.0', () => {
  assert.deepEqual(clipStats({ bytes: 22050 * 2 * 2, chars: 40, credits: 40 }), { bytes: 88200, seconds: 2, charsPerSecond: 20, creditsPerChar: 1 });
  const clip = (speed, seconds) => ({ status: 'complete', model: 'eleven_multilingual_v2', speed, chars: 60, seconds, charsPerSecond: 60 / seconds, credits: 60, deepgram: { wordAccuracy: 1 } });
  const rows = summarise([clip(1, 3), clip(0.9, 4)]);
  assert.equal(rows.find(r => r.speed === 1).paceVsNormal, 1);
  assert.equal(rows.find(r => r.speed === 0.9).paceVsNormal, 0.75);
});
