import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AnthropicBrainClient } from './anthropic.ts';
import { OpenAiResponsesBrainClient } from './openaiResponses.ts';
import { buildFixLineJudgeRequest } from './fixLineJudge.ts';

const system = { persona: 'p', pack: 'f', contract: 'c' };
const requests = [
  (c: Client) => c.turn({ kind: 'turn', system, messages: [{ role: 'user', text: 'Bonjour' }] }),
  (c: Client) => c.frame({ kind: 'frame', system, request: 'r' }),
  (c: Client) => c.extract({ kind: 'extract', system, request: 'r' }),
  (c: Client) => c.drills({ kind: 'drills', system, request: 'r' }),
  (c: Client) => c.curate({ kind: 'curate', system, request: 'r' }),
  (c: Client) => c.judge({ kind: 'judge', system: 's', request: 'r' }),
  (c: Client) => c.judge(buildFixLineJudgeRequest({ original: 'a', better: 'b', attempt: 'b', why: null, cefr: 'A1' })),
];
type Client = AnthropicBrainClient | OpenAiResponsesBrainClient;

/** Every `type` keyword in a schema tree that is an array, with its path. */
function typeArrays(node: unknown, path = '$', out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((item, i) => typeArrays(item, `${path}[${i}]`, out));
  else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'type' && Array.isArray(value)) out.push(`${path}: ${JSON.stringify(value)}`);
      typeArrays(value, `${path}.${key}`, out);
    }
  }
  return out;
}

test('nullable fields reach the provider as anyOf with null, as on zod 3', async () => {
  // Founder, 2026-11-18: zod 4 writes a nullable primitive as a `type` array.
  // The wire keeps the zod 3 form, `anyOf` with `{ type: "null" }`, which both
  // providers have been taking in strict mode all along.
  const sent: { where: string; schema: unknown }[] = [];
  const anthropic = new AnthropicBrainClient({}, { messages: { parse: async (params: { output_config: { format: { schema: unknown } } }) => {
    sent.push({ where: 'anthropic', schema: params.output_config.format.schema });
    throw new Error('captured');
  } } } as never);
  const openAi = (turnReplyFirst: string) => new OpenAiResponsesBrainClient({ apiKey: 'test', turnReplyFirst }, (async (_url: string, init: { body: string }) => {
    sent.push({ where: `openai reply-first=${turnReplyFirst}`, schema: (JSON.parse(init.body) as { text: { format: { schema: unknown } } }).text.format.schema });
    throw new Error('captured');
  }) as never, async () => {});

  for (const client of [anthropic, openAi('0'), openAi('1')]) {
    for (const send of requests) await send(client).catch(() => {});
  }

  assert.equal(sent.length, 21, 'every activity on every client reached the wire');
  for (const { where, schema } of sent) {
    assert.ok(JSON.stringify(schema).includes('"type":"null"'), `${where} still carries its nullable fields`);
    assert.deepEqual(typeArrays(schema), [], `${where} sent a type array; nullables must stay anyOf with null`);
  }
});
