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

  test('selects OpenAI, case and whitespace insensitively', () => {
    assert.equal(selectedBrain({ TUTOR_LLM: 'openai' }), 'openai');
    assert.equal(selectedBrain({ TUTOR_LLM: ' OPENAI ' }), 'openai');
  });

  test('selects the subscription-for-everything brain, case and whitespace insensitively', () => {
    assert.equal(selectedBrain({ TUTOR_LLM: 'claude-cli' }), 'claude-cli');
    assert.equal(selectedBrain({ TUTOR_LLM: 'claude-cli-all' }), 'claude-cli-all');
    assert.equal(selectedBrain({ TUTOR_LLM: ' CLAUDE-CLI-ALL ' }), 'claude-cli-all', 'and is not read as the split one');
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

  test('OpenAI uses the ordinary OPENAI_API_KEY', () => {
    const env = { ...FULL, TUTOR_LLM: 'openai', ANTHROPIC_API_KEY: '' };
    assert.deepEqual(missingRequired(env), ['OPENAI_API_KEY']);
    assert.deepEqual(missingRequired({ ...env, OPENAI_API_KEY: 'openai-key' }), []);
  });

  test('claude-cli-all needs no brain key at all, because a binary on PATH is not a credential', () => {
    // claude-cli still wants GROQ_API_KEY, because Groq is still serving its
    // realtime turns. claude-cli-all takes those too, so there is nothing left
    // for a key to buy — and demanding one would refuse to start a worker that
    // was perfectly able to run.
    const env = { ...FULL, TUTOR_LLM: 'claude-cli-all', ANTHROPIC_API_KEY: '' };
    assert.deepEqual(missingRequired(env), []);
    assert.deepEqual(missingRequired({ ...env, TUTOR_LLM: 'claude-cli' }), ['GROQ_API_KEY']);
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

  test('claude-cli-all says plainly what it costs, and that it is for development', () => {
    const w = warnings({ ...FULL, TUTOR_LLM: 'claude-cli-all', ANTHROPIC_API_KEY: '' });
    assert.equal(w.length, 1);
    assert.match(w[0]!, /claude-cli-all/);
    assert.match(w[0]!, /seconds/i, 'the learner will sit through every one of them');
    assert.match(w[0]!, /development/i, 'and nobody should discover that in production');
  });

  test('OpenAI names the live and background defaults', () => {
    const w = warnings({ ...FULL, TUTOR_LLM: 'openai', OPENAI_API_KEY: 'o' });
    assert.equal(w.length, 1);
    assert.match(w[0]!, /Luna/);
    assert.match(w[0]!, /Terra/);
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
describe('the voice the tutor is configured to use', () => {
  /**
   * Answers by host, or by "host+path" when a vendor is asked two things.
   * ElevenLabs is asked two: whether the key is good, and what the account can
   * say. They are different endpoints because only one of them can refuse an
   * absent key.
   */
  function fakeFetch(byRoute: Record<string, { status: number; body?: unknown } | 'throw'>) {
    return async (url: string) => {
      const { host, pathname } = new URL(url);
      const reply = byRoute[host + pathname] ?? byRoute[host];
      if (reply === undefined) return { ok: true, status: 200, json: async () => ({}) };
      if (reply === 'throw') throw new Error('ECONNREFUSED');
      return { ok: reply.status < 400, status: reply.status, json: async () => reply.body ?? {} };
    };
  }

  const catalogue = (...ids: string[]) => ({
    status: 200,
    body: { voices: ids.map((voice_id) => ({ voice_id, name: `voice-${voice_id}` })) },
  });

  test('a voice the account does not have is fatal, not a warning', async () => {
    // What a key rotated onto a NEW account looks like: the key is fine, every
    // other check passes, and synthesis 404s the first time the tutor opens its
    // mouth — a room that opens and a tutor that never speaks, which is the one
    // failure this whole file exists to turn into a line on a terminal.
    const checks = await verifyVendors(
      FULL,
      '',
      fakeFetch({ 'api.elevenlabs.io': catalogue('someone-elses-voice') }) as never,
    );
    const eleven = checks.find((c) => c.vendor === 'ElevenLabs');

    assert.ok(eleven, 'a voice that cannot be synthesized must be reported');
    assert.equal(eleven.fatal, true);
    assert.match(eleven.detail, /has no voice "v"/);
    assert.match(eleven.detail, /someone-elses-voice/, 'and it names what the account can actually use');
  });

  test('a voice the account does have passes silently', async () => {
    const checks = await verifyVendors(FULL, '', fakeFetch({ 'api.elevenlabs.io': catalogue('v', 'other') }) as never);
    assert.equal(checks.find((c) => c.vendor === 'ElevenLabs'), undefined);
  });

  test('no voice configured is left alone — that is the default voice, and a warning already', async () => {
    const { ELEVEN_VOICE_ID: _unset, ...noVoice } = FULL;
    const checks = await verifyVendors(noVoice, '', fakeFetch({ 'api.elevenlabs.io': catalogue('anything') }) as never);
    assert.equal(checks.find((c) => c.vendor === 'ElevenLabs'), undefined);
    assert.ok(warnings(noVoice).some((w) => /ELEVEN_VOICE_ID is unset/.test(w)));
  });

  test('a key that is missing entirely is still caught', () => {
    // The regression this file exists to remember. /v1/voices answers 200 to a
    // caller with no key at all — it serves the premade catalogue anonymously —
    // so authentication cannot be checked there, however well it appears to work
    // against a fake that returns whatever the test told it to.
    assert.ok(missingRequired({ ...FULL, ELEVEN_API_KEY: '' }).some((m) => /ELEVEN_API_KEY/.test(m)));
  });

  test('an unauthenticated catalogue does not vouch for the key', async () => {
    // Exactly what the live endpoint does: /v1/user refuses, /v1/voices does not.
    const checks = await verifyVendors(
      FULL,
      '',
      fakeFetch({
        'api.elevenlabs.io/v1/user': { status: 401 },
        'api.elevenlabs.io/v1/voices': catalogue('v'),
      }) as never,
    );
    const eleven = checks.find((c) => c.vendor === 'ElevenLabs');
    assert.ok(eleven, 'the rejected key must still be reported');
    assert.equal(eleven.fatal, true);
    assert.match(eleven.detail, /rejected the key/);
  });

  test('one broken vendor produces one message, not two', async () => {
    const checks = await verifyVendors(FULL, '', fakeFetch({ 'api.elevenlabs.io': { status: 401 } }) as never);
    assert.equal(checks.filter((c) => c.vendor === 'ElevenLabs').length, 1);
  });

  test('a rejected key still reads as a rejected key, not a missing voice', async () => {
    const checks = await verifyVendors(FULL, '', fakeFetch({ 'api.elevenlabs.io': { status: 401 } }) as never);
    const eleven = checks.find((c) => c.vendor === 'ElevenLabs');
    assert.ok(eleven);
    assert.equal(eleven.fatal, true);
    assert.match(eleven.detail, /rejected the key/);
  });

  test('a list this check cannot read is not evidence the voice is missing', async () => {
    // Better to let a working setup boot than to refuse over a body we did not
    // understand. The synthesis failure would at least be visible; a worker that
    // will not start over a parsing disagreement is not.
    const checks = await verifyVendors(FULL, '', fakeFetch({ 'api.elevenlabs.io': { status: 200, body: {} } }) as never);
    assert.equal(checks.find((c) => c.vendor === 'ElevenLabs'), undefined);
  });
});

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
  const OPENAI_MODELS = { data: [{ id: 'gpt-5.6-luna' }, { id: 'gpt-5.6-terra' }] };

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

  test('claude-cli-all probes no brain vendor, because neither one is serving it', async () => {
    // The trap: the Groq probe sends whatever GROQ_API_KEY holds, which under
    // claude-cli-all is nothing. An empty key takes a 401, a 401 is fatal, and
    // the worker refuses to start over a vendor it was never going to call.
    const checks = await verifyVendors(
      { ...FULL, TUTOR_LLM: 'claude-cli-all', ANTHROPIC_API_KEY: '', GROQ_API_KEY: '' },
      '',
      fakeFetch({ 'api.groq.com': { status: 401 }, 'api.anthropic.com': { status: 401 } }),
    );
    assert.deepEqual(checks, [], 'the voice and the transcription answered, and there was no brain to ask');
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

  test('the OpenAI brain probes OpenAI instead of Anthropic or Groq', async () => {
    const checks = await verifyVendors(
      { ...FULL, TUTOR_LLM: 'openai', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: 'o' },
      '',
      fakeFetch({ 'api.openai.com': { status: 401 }, 'api.anthropic.com': { status: 200 } }),
    );
    assert.equal(checks.length, 1);
    assert.equal(checks[0]!.vendor, 'OpenAI');
    assert.equal(checks[0]!.fatal, true);
  });

  test('OpenAI startup verifies both the live and background models are available to the key', async () => {
    const env = { ...FULL, TUTOR_LLM: 'openai', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: 'o' };
    const checks = await verifyVendors(
      env,
      '',
      fakeFetch({ 'api.openai.com': { status: 200, body: OPENAI_MODELS } }),
    );
    assert.deepEqual(checks, []);
  });

  test('OpenAI refuses to register when an override names a model the key cannot use', async () => {
    const env = {
      ...FULL,
      TUTOR_LLM: 'openai',
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: 'o',
      OPENAI_ANALYST_MODEL: 'gpt-made-up',
    };
    const checks = await verifyVendors(
      env,
      '',
      fakeFetch({ 'api.openai.com': { status: 200, body: OPENAI_MODELS } }),
    );
    assert.equal(checks.length, 1);
    assert.equal(checks[0]!.vendor, 'OpenAI');
    assert.equal(checks[0]!.fatal, true);
    assert.match(checks[0]!.detail, /gpt-made-up/);
    assert.match(checks[0]!.detail, /OPENAI_ANALYST_MODEL/);
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
