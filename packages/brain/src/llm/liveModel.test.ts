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
  assert.deepEqual(models, ['gpt-6-luna', 'gpt-5.6-luna', 'gpt-5.6-luna']);
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
  assert.deepEqual(models, ['gpt-6-luna', 'gpt-5.6-luna', 'gpt-5.6-terra']);
});

test('openAiModelFor names the model each activity is really sent to, overrides included', () => {
  assert.deepEqual(
    (['turn', 'frame', 'curate', 'judge', 'extract', 'drills'] as const).map((a) => openAiModelFor(a, {})),
    ['gpt-6-luna', 'gpt-6-luna', 'gpt-5.6-luna', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-terra'],
  );
  const env = { OPENAI_LIVE_MODEL: 'live-x', OPENAI_TURN_MODEL: 'fast-x', OPENAI_ANALYST_MODEL: 'analyst-x' };
  assert.equal(openAiModelFor('turn', env), 'live-x');
  assert.equal(openAiModelFor('curate', env), 'fast-x');
  assert.equal(openAiModelFor('drills', env), 'analyst-x');
});
