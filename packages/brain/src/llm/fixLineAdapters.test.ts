import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnthropicBrainClient } from './anthropic.ts';
import { OpenAiResponsesBrainClient } from './openaiResponses.ts';
import { OpenAiCompatBrainClient } from './openaiCompat.ts';
import { ClaudeCliBrainClient } from './claudeCli.ts';
import { buildFixLineJudgeRequest } from './fixLineJudge.ts';
import type { BrainJudgeRequest } from './client.ts';

const fixed = { fixed: null, hint: null };
const own = { meaningKept: true, comprehensible: true, natural: 'yes', betterLine: null, note: 'Both work.' };
const retry = buildFixLineJudgeRequest({ original: 'Je suis vingt ans.', better: 'J’ai vingt ans.', attempt: 'J’ai vingt ans.', why: null, cefr: 'A1' });
const paraphrase: BrainJudgeRequest = { kind: 'judge', system: 'Read a paraphrase.', request: 'Their own words.' };
function assertSchemas(bodies: unknown[]) {
  assert.match(JSON.stringify(bodies[0]), /"fixed"/); assert.doesNotMatch(JSON.stringify(bodies[0]), /"meaningKept"/);
  assert.match(JSON.stringify(bodies[1]), /"meaningKept"/); assert.doesNotMatch(JSON.stringify(bodies[1]), /"fixed"/);
}
test('Anthropic sends a distinct closed correction schema and preserves the ordinary judge schema', async () => {
  const bodies: unknown[] = []; const answers = [fixed, own];
  const client = new AnthropicBrainClient({}, { messages: { parse: async params => {
    bodies.push(params); return { parsed_output: answers.shift(), stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } };
  } } });
  assert.deepEqual((await client.judge(retry)).verdict, fixed);
  assert.deepEqual((await client.judge(paraphrase)).verdict, own); assertSchemas(bodies);
});
test('Responses validates an uncertain correction separately and keeps the own-words wire shape', async () => {
  const bodies: unknown[] = []; const answers = [fixed, own];
  const client = new OpenAiResponsesBrainClient({ apiKey: 'test' }, (async (_url: unknown, init: { body: string }) => {
    bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answers.shift()) }] }], usage: { input_tokens: 10, output_tokens: 5 } }) };
  }) as never);
  assert.deepEqual((await client.judge(retry)).verdict, fixed);
  assert.deepEqual((await client.judge(paraphrase)).verdict, own); assertSchemas(bodies);
});
test('the JSON-compatible judge enforces the correction schema locally and retains the existing paraphrase shape', async () => {
  const bodies: unknown[] = []; const answers = [fixed, own];
  const client = new OpenAiCompatBrainClient({ apiKey: 'test' }, (async (_url: unknown, init: { body: string }) => {
    bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({
      choices: [{ message: { content: JSON.stringify(answers.shift()) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }) };
  }) as never);
  assert.deepEqual((await client.judge(retry)).verdict, fixed);
  assert.deepEqual((await client.judge(paraphrase)).verdict, own);
  // Schemas travel as escaped JSON inside the system string for this adapter.
  const systems = bodies.map(value => (value as { messages: { content: string }[] }).messages[0]!.content);
  assertSchemas(systems.map(text => JSON.parse(text.slice(text.indexOf('{')))));
});
test('the CLI correction check unwraps its own verdict without changing the ordinary CLI judge', async () => {
  const prompts: string[] = []; const answers = [fixed, own];
  const client = new ClaudeCliBrainClient({ run: async (_args, prompt) => {
    prompts.push(prompt); return { code: 0, stderr: '', stdout: JSON.stringify({ is_error: false, result: JSON.stringify(answers.shift()), usage: { input_tokens: 10, output_tokens: 5 } }) };
  } });
  assert.deepEqual((await client.judge(retry)).verdict, fixed);
  assert.deepEqual((await client.judge(paraphrase)).verdict, own);
  assert.match(prompts[0]!, /"fixed"/); assert.doesNotMatch(prompts[0]!, /"meaningKept"/);
  assert.match(prompts[1]!, /"meaningKept"/); assert.doesNotMatch(prompts[1]!, /"fixed"/);
});
