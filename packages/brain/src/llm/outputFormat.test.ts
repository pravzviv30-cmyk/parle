import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { z } from 'zod/v4';

import { AnthropicBrainClient } from './anthropic.ts';
import { ClaudeCliBrainClient } from './claudeCli.ts';
import { OpenAiCompatBrainClient } from './openaiCompat.ts';
import { OpenAiResponsesBrainClient } from './openaiResponses.ts';
import { buildFixLineJudgeRequest } from './fixLineJudge.ts';
import { outputFormat } from './outputFormat.ts';
import { ScenarioFrameSchema } from '../contract/schemas.ts';

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
type Client = AnthropicBrainClient | OpenAiResponsesBrainClient | OpenAiCompatBrainClient | ClaudeCliBrainClient;

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

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

/** Drives every activity on every adapter and returns each schema as it left. */
async function sentSchemas(): Promise<{ where: string; schema: unknown }[]> {
  const sent: { where: string; schema: unknown }[] = [];
  const anthropic = new AnthropicBrainClient({}, { messages: { parse: async (params: { output_config: { format: { schema: unknown } } }) => {
    sent.push({ where: 'anthropic', schema: params.output_config.format.schema });
    throw new Error('captured');
  } } } as never);
  const openAi = (turnReplyFirst: string) => new OpenAiResponsesBrainClient({ apiKey: 'test', turnReplyFirst }, (async (_url: string, init: { body: string }) => {
    sent.push({ where: `openai reply-first=${turnReplyFirst}`, schema: (JSON.parse(init.body) as { text: { format: { schema: unknown } } }).text.format.schema });
    throw new Error('captured');
  }) as never, async () => {});
  // These two carry the schema as text inside the prompt, after a fixed lead-in.
  const compat = new OpenAiCompatBrainClient({ apiKey: 'test' }, (async (_url: string, init: { body: string }) => {
    const text = (JSON.parse(init.body) as { messages: { content: string }[] }).messages[0]!.content;
    sent.push({ where: 'openai-compat', schema: JSON.parse(text.slice(text.indexOf('no prose:\n') + 'no prose:\n'.length)) });
    throw new Error('captured');
  }) as never, async () => {});
  const cli = new ClaudeCliBrainClient({ run: async (_args, prompt) => {
    const start = prompt.indexOf('no code fence:\n') + 'no code fence:\n'.length;
    sent.push({ where: 'claude-cli', schema: JSON.parse(prompt.slice(start, prompt.indexOf('\n\n', start))) });
    throw new Error('captured');
  } });

  for (const client of [anthropic, openAi('0'), openAi('1'), compat, cli]) {
    for (const send of requests) await send(client).catch(() => {});
  }
  return sent;
}

test('nullable fields reach the provider as anyOf with null, as on zod 3', async () => {
  // Founder, 2026-11-18: zod 4 writes a nullable primitive as a `type` array.
  // The wire keeps the zod 3 form, `anyOf` with `{ type: "null" }`, which both
  // providers have been taking in strict mode all along.
  const sent = await sentSchemas();
  assert.equal(sent.length, 35, 'every activity on every adapter reached the wire, once');
  for (const { where, schema } of sent) {
    assert.ok(JSON.stringify(schema).includes('"type":"null"'), `${where} still carries its nullable fields`);
    assert.deepEqual(typeArrays(schema), [], `${where} sent a type array; nullables must stay anyOf with null`);
  }
});

test('the scene frame schema the brain sends is pinned byte for byte', () => {
  // Founder, 2026-11-18: the one accepted difference from zod 3 is here. zod
  // 4.6.7 extracts the beat object into a sixth $defs entry (zod 3.25.76 sent
  // 093a3cd5…). This pin is that accepted form; any further drift fails.
  assert.equal(sha256(JSON.stringify(outputFormat(ScenarioFrameSchema).schema)),
    '4a258792709cae761c670a1f90ee5438450f82e540c4b53629ef662c1cd6ad0c');
});

test('the Anthropic turn schema is pinned byte for byte, as zod 3 sent it', async () => {
  // The same hash as the zod 3.25.76 capture, so key order, not just meaning,
  // is held: an anyOf that moved after a sibling key would fail here.
  const turn = (await sentSchemas()).find((s) => s.where === 'anthropic')!;
  assert.equal(sha256(JSON.stringify(turn.schema)), 'a7798023fb49067b298f0c1807fe2862c55d9bf5306125d4d78a68ba260de3ff');
});

test('a constrained nullable keeps zod 3\'s exact form', () => {
  // zod 4.6.7 folds only bare `{ type }` branches into a type array, so a
  // nullable with a constraint stays anyOf and never reaches the rewrite.
  // These bytes are what zod 3.25.76 produced through the same helper.
  assert.equal(JSON.stringify(outputFormat(z.object({ a: z.string().max(5).nullable() })).schema),
    '{"type":"object","properties":{"a":{"anyOf":[{"type":"string","description":"{maxLength: 5}"},{"type":"null"}]}},'
    + '"additionalProperties":false,"required":["a"],"description":"{$schema: \\"https://json-schema.org/draft/2020-12/schema\\"}"}');
});
