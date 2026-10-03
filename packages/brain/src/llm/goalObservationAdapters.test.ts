import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnthropicBrainClient } from './anthropic.ts';
import { OpenAiResponsesBrainClient } from './openaiResponses.ts';
import { OpenAiCompatBrainClient } from './openaiCompat.ts';
import { ClaudeCliBrainClient } from './claudeCli.ts';
import { BrainParseError, type LlmClient } from './client.ts';
import { sampleTurn } from '../contract/samples.ts';
import { buildSystemBlocks } from '../prompt/system.ts';
import { TurnSchema, withMissingGoalObservation } from '../contract/schemas.ts';

const request = { kind: 'turn', system: buildSystemBlocks(), messages: [{ role: 'user', text: 'Bonjour, un café.' }] } as const;
function adapters(answer: unknown, calls: unknown[]): [string, LlmClient][] {
  return [
    ['Anthropic', new AnthropicBrainClient({}, { messages: { parse: async params => {
      calls.push(params); return { parsed_output: answer, stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } };
    } } })],
    ['Responses', new OpenAiResponsesBrainClient({ apiKey: 'test' }, (async (_url: unknown, init: { body: string }) => {
      calls.push(JSON.parse(init.body)); return new Response(JSON.stringify({ status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }], usage: { input_tokens: 10, output_tokens: 5 } }));
    }) as never)],
    ['JSON-compatible', new OpenAiCompatBrainClient({ apiKey: 'test' }, (async (_url: unknown, init: { body: string }) => {
      calls.push(JSON.parse(init.body)); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    }) as never)],
    ['CLI', new ClaudeCliBrainClient({ run: async (_args, prompt) => {
      calls.push(prompt); return { code: 0, stderr: '', stdout: JSON.stringify({ is_error: false, result: JSON.stringify(answer), usage: { input_tokens: 10, output_tokens: 5 } }) };
    } })],
  ];
}
for (const index of [0, 1, 2, 3]) {
  test(`goal observation adapter ${index} normalizes old absence without relaxing its requested contract`, async () => {
    const old = JSON.parse(JSON.stringify(sampleTurn())); delete old.scene.goalMet;
    const calls: unknown[] = []; const [name, client] = adapters(old, calls)[index]!;
    const result = await client.turn({ ...request, messages: [...request.messages] });
    assert.equal(result.turn.scene.goalMet, null, name);
    assert.equal(calls.length, 1, 'compatibility does not add a retry');
    assert.match(JSON.stringify(calls), /goalMet/);
  });
  test(`goal observation adapter ${index} rejects wrong types and missing scene instead of inventing evidence`, async () => {
    for (const answer of [{ ...sampleTurn(), scene: { ...sampleTurn().scene, goalMet: 'yes' } }, { ...sampleTurn(), scene: undefined }]) {
      const [, client] = adapters(answer, [])[index]!;
      await assert.rejects(client.turn({ ...request, messages: [...request.messages] }), BrainParseError);
    }
  });
}
test('the turn wire schema requires a nullable observation and absence normalization changes nothing else', () => {
  const old = JSON.parse(JSON.stringify(sampleTurn())); delete old.scene.goalMet;
  assert.throws(() => TurnSchema.parse(old));
  assert.deepEqual(TurnSchema.parse(withMissingGoalObservation(old)), sampleTurn());
  assert.equal(Object.hasOwn(old.scene, 'goalMet'), false, 'normalizer does not mutate the input');
  assert.throws(() => TurnSchema.parse(withMissingGoalObservation({ ...sampleTurn(), scene: null })));
});

test('Anthropic SDK format parser normalizes absent goalMet before parsed_output exists and preserves required wire fields', async () => {
  const old = JSON.parse(JSON.stringify(sampleTurn())); delete old.scene.goalMet;
  let checked = false;
  const client = new AnthropicBrainClient({}, { messages: { parse: async params => {
    const format = (params as { output_config: { format: { parse: (text: string) => unknown; schema: { properties: { scene: { required: string[] } } } } } }).output_config.format;
    assert.ok(format.schema.properties.scene.required.includes('goalMet'));
    const parsed = format.parse(JSON.stringify(old));
    assert.deepEqual(parsed, sampleTurn());
    assert.throws(() => format.parse(JSON.stringify({ ...sampleTurn(), scene: { ...sampleTurn().scene, goalMet: 'yes' } })));
    checked = true;
    return { parsed_output: parsed, stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } };
  } } });
  assert.equal((await client.turn({ ...request, messages: [...request.messages] })).turn.scene.goalMet, null);
  assert.equal(checked, true);
});
