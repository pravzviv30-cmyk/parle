import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OpenAiResponsesBrainClient, openAiLiveModel, openAiModelFor } from './openaiResponses.ts';
import { sampleTurn } from '../contract/samples.ts';
import { buildSystemBlocks } from '../prompt/system.ts';
import { buildFixLineJudgeRequest } from './fixLineJudge.ts';
import { brainClientFromEnv } from './factory.ts';

test('live model resolution preserves legacy overrides and prefers an explicit live choice', () => {
  assert.equal(openAiLiveModel({}), 'gpt-6-luna');
  assert.equal(openAiLiveModel({ OPENAI_TURN_MODEL: ' custom-fast ' }), 'custom-fast');
  assert.equal(openAiLiveModel({ OPENAI_LIVE_MODEL: ' custom-live ', OPENAI_TURN_MODEL: 'old-fast' }), 'custom-live');
  assert.equal(openAiLiveModel({}, { turnModel: 'configured-fast' }), 'configured-fast');
  assert.equal(openAiLiveModel({ OPENAI_LIVE_MODEL: 'environment-live' }, { liveModel: 'configured-live' }), 'configured-live');
  assert.equal(openAiLiveModel({ OPENAI_LIVE_MODEL: '  ', OPENAI_TURN_MODEL: '  ' }), 'gpt-6-luna');
});

test('a live-only Luna migration preserves curated practice and written judges on their existing model', async () => {
  const models: string[] = [];
  const answers = [sampleTurn(), { topics: [] }, { fixed: null, hint: null }];
  const client = new OpenAiResponsesBrainClient({ apiKey: 'test', liveModel: 'gpt-6-luna' }, (async (_url: unknown, init: { body: string }) => {
    models.push(JSON.parse(init.body).model);
    return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(answers.shift()) }] }], usage: {} }));
  }) as never);
  await client.turn({ kind: 'turn', system: buildSystemBlocks(), messages: [{ role: 'user', text: 'Bonjour !' }] });
  await client.curate({ kind: 'curate', system: buildSystemBlocks(), request: 'No saved phrases.' });
  await client.judge(buildFixLineJudgeRequest({ original: 'Je suis vingt ans.', better: 'J’ai vingt ans.', attempt: 'J’ai vingt ans.', cefr: 'A1', why: null }));
  // 2026-10-24 (VOICE-012): curate moved to gpt-6-luna on its own knob. The judge
  // is deliberately still pinned on gpt-5.6-luna (OPENAI_TURN_MODEL).
  assert.deepEqual(models, ['gpt-6-luna', 'gpt-6-luna', 'gpt-5.6-luna']);
});

test('blank live config matches the worker preflight model rather than sending an empty model', () => {
  for (const liveModel of ['', '  ']) {
    assert.equal(openAiLiveModel({}, { liveModel }), openAiLiveModel({ OPENAI_LIVE_MODEL: liveModel }));
    assert.equal(openAiLiveModel({}, { liveModel, turnModel: ' legacy-model ' }), 'legacy-model');
  }
  assert.equal(openAiLiveModel({}, { liveModel: ' gpt-6-luna ' }), 'gpt-6-luna');
});

test('factory blank model overrides preserve all three preflight defaults on actual requests', async (t) => {
  const models: string[] = [];
  const answers = [sampleTurn(), { fixed: null, hint: null }, { facts: [], openerFr: null, openerEn: null }];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: { body: string }) => {
    models.push(JSON.parse(init.body).model);
    return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(answers.shift()) }] }], usage: {} }));
  });
  const client = brainClientFromEnv({ TUTOR_LLM: 'openai', OPENAI_API_KEY: 'test',
    OPENAI_LIVE_MODEL: ' ', OPENAI_TURN_MODEL: '', OPENAI_ANALYST_MODEL: '  ' });
  await client.turn({ kind: 'turn', system: buildSystemBlocks(), messages: [{ role: 'user', text: 'Bonjour !' }] });
  await client.judge(buildFixLineJudgeRequest({ original: 'Je suis vingt ans.', better: 'J’ai vingt ans.', attempt: 'J’ai vingt ans.', cefr: 'A1', why: null }));
  await client.extract({ kind: 'extract', system: buildSystemBlocks(), request: 'No facts.' });
  // The judge stays on gpt-5.6-luna (VOICE-012 moved curate only, not judge).
  assert.deepEqual(models, ['gpt-6-luna', 'gpt-5.6-luna', 'gpt-5.6-terra']);
});

test('openAiModelFor names the model each activity is really sent to, overrides included', () => {
  assert.deepEqual(
    (['turn', 'frame', 'curate', 'judge', 'extract', 'drills'] as const).map((a) => openAiModelFor(a, {})),
    // 2026-10-23 (VOICE-008): drills moved from gpt-5.6-terra to gpt-6-luna.
    // 2026-10-24 (VOICE-012): curate moved from gpt-5.6-luna to gpt-6-luna; judge stays on gpt-5.6-luna.
    ['gpt-6-luna', 'gpt-6-luna', 'gpt-6-luna', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-6-luna'],
  );
  const env = { OPENAI_LIVE_MODEL: 'live-x', OPENAI_TURN_MODEL: 'fast-x', OPENAI_ANALYST_MODEL: 'analyst-x' };
  assert.equal(openAiModelFor('turn', env), 'live-x');
  // 2026-10-24 (VOICE-012): OPENAI_TURN_MODEL moves the judge, no longer curate.
  assert.equal(openAiModelFor('curate', env), 'gpt-6-luna');
  assert.equal(openAiModelFor('judge', env), 'fast-x');
  // 2026-10-23 (VOICE-008): OPENAI_ANALYST_MODEL no longer moves drills.
  assert.equal(openAiModelFor('drills', env), 'gpt-6-luna');
  assert.equal(openAiModelFor('extract', env), 'analyst-x');
});

test('drills have their own model: gpt-6-luna by default, OPENAI_DRILLS_MODEL to override (VOICE-008)', () => {
  assert.equal(openAiModelFor('drills', {}), 'gpt-6-luna');
  assert.equal(openAiModelFor('extract', {}), 'gpt-5.6-terra', 'memory extraction stays on the analyst');
  assert.equal(openAiModelFor('drills', { OPENAI_DRILLS_MODEL: ' drills-x ' }), 'drills-x');
  assert.equal(openAiModelFor('drills', { OPENAI_DRILLS_MODEL: '  ' }), 'gpt-6-luna');
  assert.equal(openAiModelFor('extract', { OPENAI_DRILLS_MODEL: 'drills-x' }), 'gpt-5.6-terra');
  const analystOnly = { OPENAI_ANALYST_MODEL: 'analyst-x' };
  assert.equal(openAiModelFor('extract', analystOnly), 'analyst-x');
  assert.equal(openAiModelFor('drills', analystOnly), 'gpt-6-luna', 'the analyst knob does not move drills');
  assert.equal(openAiModelFor('drills', {}, { drillsModel: 'configured-drills' }), 'configured-drills');
  assert.equal(openAiModelFor('drills', { OPENAI_DRILLS_MODEL: 'env-drills' }, { drillsModel: 'configured-drills' }), 'configured-drills');
});

test('curation has its own model: gpt-6-luna by default, OPENAI_CURATION_MODEL to override (VOICE-012)', () => {
  assert.equal(openAiModelFor('curate', {}), 'gpt-6-luna');
  assert.equal(openAiModelFor('curate', { OPENAI_CURATION_MODEL: ' curation-x ' }), 'curation-x');
  assert.equal(openAiModelFor('curate', { OPENAI_CURATION_MODEL: '  ' }), 'gpt-6-luna');
  // Neighbouring knobs do not move curate, and the curation knob moves nothing else.
  assert.equal(openAiModelFor('curate', { OPENAI_TURN_MODEL: 'fast-x' }), 'gpt-6-luna', 'the turn knob does not move curate');
  assert.equal(openAiModelFor('curate', { OPENAI_ANALYST_MODEL: 'analyst-x', OPENAI_LIVE_MODEL: 'live-x' }), 'gpt-6-luna');
  const curationOnly = { OPENAI_CURATION_MODEL: 'curation-x' };
  assert.equal(openAiModelFor('judge', curationOnly), 'gpt-5.6-luna', 'judge stays on the turn model');
  assert.equal(openAiModelFor('extract', curationOnly), 'gpt-5.6-terra', 'extract stays on the analyst');
  assert.equal(openAiModelFor('turn', curationOnly), 'gpt-6-luna');
  assert.equal(openAiModelFor('drills', curationOnly), 'gpt-6-luna');
  assert.equal(openAiModelFor('judge', { OPENAI_TURN_MODEL: 'fast-x' }), 'fast-x', 'the turn knob still moves the judge');
  assert.equal(openAiModelFor('curate', {}, { curationModel: 'configured-curation' }), 'configured-curation');
  assert.equal(openAiModelFor('curate', { OPENAI_CURATION_MODEL: 'env-curation' }, { curationModel: 'configured-curation' }), 'configured-curation');
  assert.equal(openAiModelFor('curate', {}, { turnModel: 'configured-turn' }), 'gpt-6-luna');
});

test('the env-built OpenAI client sends curate to OPENAI_CURATION_MODEL and judge to OPENAI_TURN_MODEL', async (t) => {
  const models: string[] = [];
  const answers = [{ topics: [] }, { fixed: null, hint: null }];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: { body: string }) => {
    models.push(JSON.parse(init.body).model);
    return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(answers.shift()) }] }], usage: {} }));
  });
  const client = brainClientFromEnv({ TUTOR_LLM: 'openai', OPENAI_API_KEY: 'test', OPENAI_CURATION_MODEL: 'curation-x', OPENAI_TURN_MODEL: 'turn-x' });
  await client.curate({ kind: 'curate', system: buildSystemBlocks(), request: 'No saved phrases.' });
  await client.judge(buildFixLineJudgeRequest({ original: 'Je suis vingt ans.', better: 'J’ai vingt ans.', attempt: 'J’ai vingt ans.', cefr: 'A1', why: null }));
  assert.deepEqual(models, ['curation-x', 'turn-x']);
});

test('the env-built OpenAI client sends drills to OPENAI_DRILLS_MODEL', async (t) => {
  const models: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: { body: string }) => {
    models.push(JSON.parse(init.body).model);
    return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ drills: [] }) }] }], usage: {} }));
  });
  const client = brainClientFromEnv({ TUTOR_LLM: 'openai', OPENAI_API_KEY: 'test', OPENAI_DRILLS_MODEL: 'drills-x', OPENAI_ANALYST_MODEL: 'analyst-x' });
  await client.drills({ kind: 'drills', system: buildSystemBlocks(), request: 'Write drills.' }).catch(() => undefined);
  assert.equal(models[0], 'drills-x');
});
