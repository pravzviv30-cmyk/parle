import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { selectedBrain, missingRequired, warnings, preflight, verifyVendors, reportVendors } from './preflight.ts';

const FULL = {
  LIVEKIT_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'k',
  LIVEKIT_API_SECRET: 's',
  DEEPGRAM_API_KEY: 'd',
  ELEVEN_API_KEY: 'e',
  ELEVEN_VOICE_ID: 'v',
  ANTHROPIC_API_KEY: 'a',
};

describe('selectedBrain', () => {
  test('defaults to anthropic when unset', () => {
    assert.equal(selectedBrain({}), 'anthropic');
  });

  test('treats an empty TUTOR_LLM as unset, not as anthropic-by-accident', () => {
    // The regression this whole module exists for: `?? 'anthropic'` accepted
    // the empty string shipped in .env.example, so the agent silently required
    // a key nobody had set.
    assert.equal(selectedBrain({ TUTOR_LLM: '' }), 'anthropic');
    assert.equal(selectedBrain({ TUTOR_LLM: '   ' }), 'anthropic');
  });

  test('selects groq, case and whitespace insensitively', () => {
    assert.equal(selectedBrain({ TUTOR_LLM: 'groq' }), 'groq');
    assert.equal(selectedBrain({ TUTOR_LLM: ' GROQ ' }), 'groq');
  });

  test('an unrecognised value falls back to the default rather than throwing', () => {
    assert.equal(selectedBrain({ TUTOR_LLM: 'llama' }), 'anthropic');
  });
});

describe('missingRequired', () => {
  test('a complete env is missing nothing', () => {
    assert.deepEqual(missingRequired(FULL), []);
  });

  test('reports every missing key at once, not just the first', () => {
    assert.deepEqual(missingRequired({}).sort(), [
      'ANTHROPIC_API_KEY',
      'DEEPGRAM_API_KEY',
      'ELEVEN_API_KEY',
      'LIVEKIT_API_KEY',
      'LIVEKIT_API_SECRET',
      'LIVEKIT_URL',
    ]);
  });

  test('an empty value counts as missing', () => {
    assert.deepEqual(missingRequired({ ...FULL, DEEPGRAM_API_KEY: '  ' }), ['DEEPGRAM_API_KEY']);
  });

  test('the required brain key follows TUTOR_LLM', () => {
    const groq = { ...FULL, TUTOR_LLM: 'groq', ANTHROPIC_API_KEY: '' };
    assert.deepEqual(missingRequired(groq), ['GROQ_API_KEY']);
    assert.deepEqual(missingRequired({ ...groq, GROQ_API_KEY: 'g' }), []);
  });

  test('ELEVEN_VOICE_ID is not required, because voice.ts has a fallback', () => {
    assert.deepEqual(missingRequired({ ...FULL, ELEVEN_VOICE_ID: '' }), []);
  });
});

describe('warnings', () => {
  test('a fully configured Claude setup warns about nothing', () => {
    assert.deepEqual(warnings(FULL), []);
  });

  test('names the default voice and the weaker brain', () => {
    const w = warnings({ ...FULL, ELEVEN_VOICE_ID: '', TUTOR_LLM: 'groq' });
    assert.equal(w.length, 2);
    assert.match(w[0]!, /ELEVEN_VOICE_ID/);
    assert.match(w[1]!, /groq/i);
  });
});

describe('preflight', () => {
  test('exits with a failure code when a key is missing', () => {
    const codes: number[] = [];
    preflight({}, ((c: number) => {
      codes.push(c);
      return undefined as never;
    }));
    assert.deepEqual(codes, [1]);
  });

  test('does not exit when the env is complete', () => {
    let exited = false;
    preflight(FULL, (() => {
      exited = true;
      return undefined as never;
    }));
    assert.equal(exited, false);
  });
});

/**
 * The regression these cover: every key present, preflight cheerful, and the
 * learner still gets a room that opens and stays silent — because Groq retired
 * the model and ElevenLabs stopped honouring the key.
 */
describe('verifyVendors', () => {
  const GROQ = { ...FULL, TUTOR_LLM: 'groq', GROQ_API_KEY: 'g' };

  /** Answers each vendor by hostname, so one fake serves a whole pipeline. */
  function fakeFetch(byHost: Record<string, { status: number; body?: unknown } | 'throw'>) {
    return async (url: string) => {
      const host = new URL(url).host;
      const reply = byHost[host];
      if (reply === undefined) return { ok: true, status: 200, json: async () => ({}) };
      if (reply === 'throw') throw new Error('ECONNREFUSED');
      return { ok: reply.status < 400, status: reply.status, json: async () => reply.body ?? {} };
    };
  }

  const LIVE_MODELS = { data: [{ id: 'openai/gpt-oss-120b' }, { id: 'openai/gpt-oss-20b' }] };

  test('a healthy pipeline reports nothing', async () => {
    const checks = await verifyVendors(
      GROQ,
      'openai/gpt-oss-120b',
      fakeFetch({ 'api.groq.com': { status: 200, body: LIVE_MODELS } }),
    );
    assert.deepEqual(checks, []);
  });

  test('a retired model is fatal, and names what is still served', async () => {
    const checks = await verifyVendors(
      GROQ,
      'llama-3.3-70b-versatile',
      fakeFetch({ 'api.groq.com': { status: 200, body: LIVE_MODELS } }),
    );
    assert.equal(checks.length, 1);
    assert.equal(checks[0]!.fatal, true);
    assert.match(checks[0]!.detail, /llama-3\.3-70b-versatile/);
    assert.match(checks[0]!.detail, /openai\/gpt-oss-120b/);
    assert.match(checks[0]!.detail, /GROQ_MODEL/);
  });

  test('a rejected key is fatal, and says the key is the problem', async () => {
    const checks = await verifyVendors(
      GROQ,
      'openai/gpt-oss-120b',
      fakeFetch({ 'api.groq.com': { status: 200, body: LIVE_MODELS }, 'api.elevenlabs.io': { status: 401 } }),
    );
    assert.equal(checks.length, 1);
    assert.equal(checks[0]!.vendor, 'ElevenLabs');
    assert.equal(checks[0]!.fatal, true);
    assert.match(checks[0]!.detail, /expired, or revoked/);
  });

  test('an unreachable vendor is a warning — that is the network, not the config', async () => {
    const checks = await verifyVendors(
      GROQ,
      'openai/gpt-oss-120b',
      fakeFetch({ 'api.groq.com': { status: 200, body: LIVE_MODELS }, 'api.deepgram.com': 'throw' }),
    );
    assert.equal(checks.length, 1);
    assert.equal(checks[0]!.fatal, false);
    assert.match(checks[0]!.detail, /network/);
  });

  test('the anthropic brain is checked instead when it is the one selected', async () => {
    const checks = await verifyVendors(
      { ...FULL, TUTOR_LLM: 'anthropic' },
      '',
      fakeFetch({ 'api.anthropic.com': { status: 401 } }),
    );
    assert.equal(checks.length, 1);
    assert.equal(checks[0]!.vendor, 'Anthropic');
    assert.equal(checks[0]!.fatal, true);
  });
});

describe('reportVendors', () => {
  test('refuses to start on anything fatal', () => {
    const codes: number[] = [];
    reportVendors([{ vendor: 'Groq', fatal: true, detail: 'retired the model.' }], ((c: number) => {
      codes.push(c);
      return undefined as never;
    }));
    assert.deepEqual(codes, [1]);
  });

  test('a warning alone still lets the worker boot', () => {
    let exited = false;
    reportVendors([{ vendor: 'Deepgram', fatal: false, detail: 'could not be reached.' }], (() => {
      exited = true;
      return undefined as never;
    }));
    assert.equal(exited, false);
  });
});
