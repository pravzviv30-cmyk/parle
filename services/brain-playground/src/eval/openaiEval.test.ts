/**
 * The evals label and price an OpenAI run from the model the client really
 * sends that activity to, not from a constant. These tests failed while
 * runEval.ts and frameEval.ts used DEFAULT_OPENAI_TURN_MODEL (gpt-5.6-luna) and
 * the client sent live turns and frames to gpt-6-luna.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { costUsd, type LlmUsage } from '@luvani/brain';

import { evalCostUsd } from '../usage.ts';
import { curationCostModel } from './curationEval.ts';
import { openAiEvalClient, openAiEvalModel } from './openaiEval.ts';

const KEYS = ['OPENAI_LIVE_MODEL', 'OPENAI_TURN_MODEL', 'OPENAI_ANALYST_MODEL', 'OPENAI_DRILLS_MODEL', 'OPENAI_CURATION_MODEL', 'BRAIN_EFFORT'] as const;

const usage: LlmUsage = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 };

describe('eval model label and price', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  test('the turn and frame evals use gpt-6-luna with no override, and the override when one is set', () => {
    assert.equal(openAiEvalClient('turn', 'k').costModel, 'gpt-6-luna');
    assert.equal(openAiEvalClient('frame', 'k').costModel, 'gpt-6-luna');
    process.env.OPENAI_LIVE_MODEL = 'custom-live';
    assert.equal(openAiEvalClient('turn', 'k').costModel, 'custom-live');
    assert.equal(openAiEvalClient('frame', 'k').costModel, 'custom-live');
    delete process.env.OPENAI_LIVE_MODEL;
    process.env.OPENAI_TURN_MODEL = 'legacy-fast';
    assert.equal(openAiEvalModel('turn'), 'legacy-fast');
  });

  // 2026-10-23 (VOICE-008): drills moved to gpt-6-luna with their own knob,
  // OPENAI_DRILLS_MODEL; OPENAI_ANALYST_MODEL no longer moves them.
  // 2026-10-24 (VOICE-012): curation moved to gpt-6-luna with its own knob,
  // OPENAI_CURATION_MODEL; OPENAI_TURN_MODEL no longer moves it.
  test('curate follows OPENAI_CURATION_MODEL and drills follow OPENAI_DRILLS_MODEL', () => {
    assert.equal(openAiEvalClient('drills', 'k').costModel, 'gpt-6-luna');
    assert.equal(curationCostModel('openai', {}), 'gpt-6-luna');
    assert.equal(curationCostModel('openai', { OPENAI_CURATION_MODEL: 'custom-curation' }), 'custom-curation');
    assert.equal(curationCostModel('openai', { OPENAI_TURN_MODEL: 'custom-fast' }), 'gpt-6-luna');
    assert.equal(curationCostModel('openai', { OPENAI_LIVE_MODEL: 'custom-live' }), 'gpt-6-luna');
    process.env.OPENAI_ANALYST_MODEL = 'custom-analyst';
    assert.equal(openAiEvalClient('drills', 'k').costModel, 'gpt-6-luna');
    process.env.OPENAI_DRILLS_MODEL = 'custom-drills';
    assert.equal(openAiEvalClient('drills', 'k').costModel, 'custom-drills');
  });

  test('a run is priced on the model stamped on its usage, then on the label model', () => {
    const stamped = { ...usage, model: 'gpt-6-luna' };
    // The old constant priced this at gpt-5.6-luna ($1.40); the model that answered is $0.60.
    assert.equal(evalCostUsd(stamped, 'gpt-5.6-luna'), costUsd(usage, 'gpt-6-luna'));
    assert.equal(evalCostUsd(usage, 'gpt-6-luna'), 0.6);
    // A stamp with no price row falls back to the label model rather than the opus fallback.
    assert.equal(evalCostUsd({ ...usage, model: 'unlisted' }, 'gpt-6-luna'), 0.6);
  });
});
