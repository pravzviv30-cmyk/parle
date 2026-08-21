import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ScenarioFrameSchema } from './contract/schemas.ts';
import { requestFallbackFrame } from './fixtures.ts';

describe('the request-grounded scenario fallback', () => {
  test('a driving request can never become the café fixture when the scenario builder fails', () => {
    const request = 'Driving with friends and talking about the things we see on the road';
    const frame = requestFallbackFrame(request);

    assert.equal(frame.titleEn, request);
    assert.ok(frame.setting.includes(request), 'the exact intent rides every later turn in the scene plan');
    assert.ok(frame.openingNarration.en.includes(request), 'the learner hears that their own situation was kept');
    assert.doesNotMatch(JSON.stringify(frame), /coffee|café|barista/i);
    assert.deepEqual(ScenarioFrameSchema.parse(frame), frame, 'the fallback is a complete playable frame');
  });

  test('rough or oversized transcripts become safe, bounded scene labels', () => {
    const frame = requestFallbackFrame(`  a trip\n\nwith   friends ${'and scenery '.repeat(40)}  `);

    assert.ok(frame.titleEn.length <= 96);
    assert.ok(frame.setting.length < 400);
    assert.doesNotMatch(frame.setting, /\n|\s{2}/);
    assert.deepEqual(ScenarioFrameSchema.parse(frame), frame);
  });
});
