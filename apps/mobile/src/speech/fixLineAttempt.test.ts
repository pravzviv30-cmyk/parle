import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const repair = { quote: 'Je suis vingt ans.', better: 'J’ai vingt ans.', betterEn: 'I’m twenty.', why: 'Use avoir for age.' };
function shipped(bindings: Record<string, unknown>) {
  const source = readFileSync(new URL('./fixLineAttempt.ts', import.meta.url), 'utf8').split('\n').filter(line => !line.startsWith('import ')).join('\n').replace(/^export /gm, '');
  return new Function(...Object.keys(bindings), stripTypeScriptTypes(source) + '\nreturn { judgeFixLine, readFixLineVerdict };')(...Object.values(bindings)) as {
    judgeFixLine(...args: unknown[]): Promise<unknown>; readFixLineVerdict(raw: unknown): unknown;
  };
}
function harness() {
  const state = { generation: 1, user: 'owner', active: true, headers: () => {}, reply: () => {}, sent: [] as { url: string; body: Record<string, unknown> }[] };
  const client = shipped({ scopeGeneration: () => state.generation, auth: { getSession: async () => ({ id: state.user }) },
    authHeaders: async () => { state.headers(); return { authorization: 'Bearer example' }; }, loadProfile: async () => null,
    TOKEN_SERVER: 'https://tokens.invalid', fetch: async (url: string, init: RequestInit) => {
      state.sent.push({ url, body: JSON.parse(init.body as string) }); state.reply(); return Response.json({ verdict: { fixed: true, hint: null } });
    } });
  const controller = new AbortController();
  return { state, client, controller, check: () => client.judgeFixLine('owner', repair, 'J’ai déjà vingt ans.', 1, controller.signal, () => state.active) };
}
test('Check sends the exact in-memory correction and edited retry to its distinct endpoint, with no recording or grade', async () => {
  const h = harness(); assert.deepEqual(await h.check(), { fixed: true, hint: null });
  assert.deepEqual(h.state.sent, [{ url: 'https://tokens.invalid/drill/fix-line', body: { userId: 'owner', original: repair.quote,
    better: repair.better, why: repair.why, attempt: 'J’ai déjà vingt ans.' } }]);
});
test('scope changes, sign-out, cancellation or leaving during headers send no old correction', async () => {
  for (const reason of ['scope', 'account', 'leave', 'abort']) {
    const h = harness(); h.state.headers = () => {
      if (reason === 'scope') h.state.generation++;
      else if (reason === 'account') h.state.user = 'other';
      else if (reason === 'leave') h.state.active = false;
      else h.controller.abort();
    };
    assert.equal(await h.check(), null, reason); assert.deepEqual(h.state.sent, [], reason);
  }
});
test('a response arriving after ownership or foreground changed cannot become visible success', async () => {
  for (const reason of ['scope', 'account', 'leave', 'abort']) {
    const h = harness(); h.state.reply = () => {
      if (reason === 'scope') h.state.generation++; else if (reason === 'account') h.state.user = 'other';
      else if (reason === 'leave') h.state.active = false; else h.controller.abort();
    };
    assert.equal(await h.check(), null, reason); assert.equal(h.state.sent.length, 1);
  }
});
test('an uncertain, incomplete or extraneous response stays unjudged on the phone', () => {
  const h = harness();
  for (const value of [null, [], {}, { fixed: null, hint: null }, { fixed: 'true', hint: null }, { fixed: true },
    { fixed: true, hint: null, score: 1 }, { fixed: false, hint: 'x'.repeat(121) }]) assert.equal(h.client.readFixLineVerdict(value), null);
  assert.deepEqual(h.client.readFixLineVerdict({ fixed: true, hint: 'Unused hint' }), { fixed: true, hint: null });
});
