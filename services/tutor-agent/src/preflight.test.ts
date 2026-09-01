import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  NEAR_MISS_KEYS,
  REAL_KEY_NAMES,
  missingRequired,
  preflight,
  reportVendors,
  selectedBrain,
  verifyVendors,
  warnings,
} from './preflight.ts';
import { MODEL, PROBE_LINE } from './voice.ts';

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

  test('preflight names OPEN_AI_KEY as a near-miss of OPENAI_API_KEY', () => {
    // The live .env carries both. A real-looking value under a name no code
    // reads is worse than an empty one: everything looks configured, and the
    // failure it produces is a room that opens and a tutor that never speaks.
    const w = warnings({ ...FULL, OPEN_AI_KEY: 'sk-looks-real' });
    assert.equal(w.length, 1);
    assert.match(w[0]!, /OPEN_AI_KEY/, 'the variable that is set');
    assert.match(w[0]!, /OPENAI_API_KEY/, 'and the one the worker actually reads');
    assert.ok(!w[0]!.includes('sk-looks-real'), 'and never the value, which is a credential');
  });

  test('a near-miss is reported even when the real name is set too', () => {
    // Both set is the exact shape of the live file, and the tempting reading is
    // that a working key makes the typo harmless. It does not: the next person
    // to rotate the key rotates the one nothing reads.
    const w = warnings({ ...FULL, TUTOR_LLM: 'openai', OPENAI_API_KEY: 'o', OPEN_AI_KEY: 'sk-looks-real' });
    assert.equal(w.filter((line) => line.includes('OPEN_AI_KEY')).length, 1);
  });

  test('an empty near-miss is nothing at all, and neither is a name nobody mistypes', () => {
    assert.deepEqual(warnings({ ...FULL, OPEN_AI_KEY: '   ' }), []);
    assert.deepEqual(warnings({ ...FULL, SOME_UNRELATED_KEY: 'x' }), []);
  });

  test('every near-miss points at a name the worker really reads', () => {
    // A typo table that names a credential nothing looks up would send someone
    // to rename a variable into another dead end.
    for (const [typo, real] of Object.entries(NEAR_MISS_KEYS)) {
      assert.notEqual(typo, real);
      assert.ok(REAL_KEY_NAMES.includes(real), `${real} must be a name the worker reads`);
    }
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

  /**
   * F273. ElevenLabs issues scoped keys, and a key granted only synthesis does
   * not carry `user_read`. The vendor answers 401 with `missing_permissions`,
   * which is proof the key authenticated and was then refused a scope — the
   * opposite of a dead key. Reading it as "wrong, expired, or revoked" stopped
   * the worker booting and pushed a real rotation off least privilege.
   */
  const scopeGap = (permission: string) => ({
    status: 401,
    body: {
      detail: {
        type: 'authentication_error',
        status: 'missing_permissions',
        message: `The API key you used is missing the permission ${permission} to execute this operation.`,
      },
    },
  });

  test('a scoped key that can synthesise is not called revoked', async () => {
    // Both read endpoints are outside this key's scope; synthesis is inside it.
    // fakeFetch answers 200 to any route it was not told about, which is the
    // text-to-speech POST the tutor actually depends on.
    const checks = await verifyVendors(
      FULL,
      '',
      fakeFetch({
        'api.elevenlabs.io/v1/user': scopeGap('user_read'),
        'api.elevenlabs.io/v1/voices': scopeGap('voices_read'),
      }) as never,
    );

    assert.equal(
      checks.find((c) => c.vendor === 'ElevenLabs'),
      undefined,
      'a key that can speak must not be reported as revoked because it cannot read the account',
    );
  });

  test('a bare 401 is still a dead key', async () => {
    // The sibling rule this must not weaken: no `missing_permissions`, so the
    // key really was refused. Fatal, exactly as before.
    const checks = await verifyVendors(
      FULL,
      '',
      fakeFetch({ 'api.elevenlabs.io/v1/user': { status: 401 } }) as never,
    );
    const eleven = checks.find((c) => c.vendor === 'ElevenLabs');
    assert.ok(eleven, 'a genuinely refused key must still stop the worker');
    assert.equal(eleven.fatal, true);
    assert.match(eleven.detail, /wrong, expired, or revoked/);
  });

  test('a scoped key whose synthesis is refused is still fatal', async () => {
    // Falling through must not become a way to pass. The scope gap only buys a
    // chance to prove the thing that matters, and this key fails it.
    const checks = await verifyVendors(
      FULL,
      '',
      fakeFetch({
        'api.elevenlabs.io/v1/user': scopeGap('user_read'),
        'api.elevenlabs.io/v1/voices': scopeGap('voices_read'),
        'api.elevenlabs.io/v1/text-to-speech/v': { status: 401, body: { detail: 'no' } },
      }) as never,
    );
    const eleven = checks.find((c) => c.vendor === 'ElevenLabs');
    assert.ok(eleven, 'a key that cannot speak must still stop the worker');
    assert.equal(eleven.fatal, true);
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

describe('being allowed to actually speak, not just to list the voice', () => {
  /**
   * The gap this closes. The catalogue check answers "does this account have
   * this voice"; it does not answer "is this account allowed to say anything
   * with it", and a free plan refuses library voices at synthesis while listing
   * them happily. Found by running it: the voice was in the list and the vendor
   * answered 402 the moment anyone asked it to speak.
   */
  const SYNTH = 'api.elevenlabs.io/v1/text-to-speech/v';

  function routedFetch(byRoute: Record<string, { status: number; body?: unknown }>, seen?: { url?: string; init?: unknown }) {
    return async (url: string, init?: unknown) => {
      const { host, pathname } = new URL(url);
      if (pathname.startsWith('/v1/text-to-speech') && seen) {
        seen.url = url;
        seen.init = init;
      }
      const reply = byRoute[host + pathname] ?? byRoute[host];
      if (reply === undefined) return { ok: true, status: 200, json: async () => ({}) };
      return { ok: reply.status < 400, status: reply.status, json: async () => reply.body ?? {} };
    };
  }

  const listed = { status: 200, body: { voices: [{ voice_id: 'v', name: 'voice-v' }] } };

  test('a voice the account may list but may not speak with is fatal', async () => {
    const checks = await verifyVendors(
      FULL,
      '',
      routedFetch({
        'api.elevenlabs.io': listed,
        [SYNTH]: {
          status: 402,
          body: { detail: { message: 'Free users cannot use library voices via the API.' } },
        },
      }) as never,
    );
    const eleven = checks.find((c) => c.vendor === 'ElevenLabs');
    assert.ok(eleven, 'a voice that cannot be synthesized must stop the worker');
    assert.equal(eleven.fatal, true);
    assert.match(eleven.detail, /refused to speak with it/);
    assert.match(eleven.detail, /Free users cannot use library voices/, 'the vendor explains itself better than we can');
  });

  test('the refusal names the model, because it is the combination that is refused', async () => {
    const checks = await verifyVendors(
      FULL,
      '',
      routedFetch({ 'api.elevenlabs.io': listed, [SYNTH]: { status: 400 } }) as never,
    );
    const eleven = checks.find((c) => c.vendor === 'ElevenLabs');
    assert.ok(eleven);
    assert.match(eleven.detail, new RegExp(MODEL), 'a voice is only usable on the models it is verified for');
  });

  test('the probe asks for exactly what the tutor will ask for', async () => {
    // A probe that guessed the model, the voice or the language would vouch for
    // a configuration nobody is going to run.
    const seen: { url?: string; init?: unknown } = {};
    await verifyVendors(FULL, '', routedFetch({ 'api.elevenlabs.io': listed }, seen) as never);

    assert.ok(seen.url?.includes('/v1/text-to-speech/v'), 'the configured voice id must be the one probed');
    const init = seen.init as { method?: string; body?: string };
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body ?? '{}');
    assert.equal(body.model_id, MODEL);
    assert.equal(body.text, PROBE_LINE);
    assert.ok(body.voice_settings, 'the delivery settings ride along, because they are part of the request');
  });

  test('the test line stays tiny, because this runs on every worker boot', () => {
    assert.ok(PROBE_LINE.length <= 8, `PROBE_LINE is ${PROBE_LINE.length} characters and is billed every boot`);
  });

  test('a vendor blip at synthesis does not refuse to start the worker', async () => {
    // Same rule the rest of this file follows: a deterministic no about the
    // configuration stops the worker, weather does not.
    for (const status of [500, 429]) {
      const checks = await verifyVendors(
        FULL,
        '',
        routedFetch({ 'api.elevenlabs.io': listed, [SYNTH]: { status } }) as never,
      );
      const eleven = checks.find((c) => c.vendor === 'ElevenLabs');
      assert.equal(eleven?.fatal, false, `HTTP ${status} should be a blip, not a refusal`);
    }
  });

  test('a refused voice still produces one message, not two', async () => {
    const checks = await verifyVendors(
      FULL,
      '',
      routedFetch({ 'api.elevenlabs.io': listed, [SYNTH]: { status: 402 } }) as never,
    );
    assert.equal(checks.filter((c) => c.vendor === 'ElevenLabs').length, 1);
  });

  test('no configured voice means nothing of ours to prove', async () => {
    // The vendor default is the vendor's problem, and an unset id is already a
    // warning. Spending quota to probe it would be spending it on nothing.
    const { ELEVEN_VOICE_ID: _unset, ...noVoice } = FULL;
    const seen: { url?: string } = {};
    const checks = await verifyVendors(noVoice, '', routedFetch({ 'api.elevenlabs.io': listed }, seen) as never);
    assert.equal(checks.find((c) => c.vendor === 'ElevenLabs'), undefined);
    assert.equal(seen.url, undefined, 'no synthesis request should have been made at all');
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

/**
 * The second voice vendor. Everything here is conditional on LUVANI_TTS_VENDOR,
 * because the failure mode of getting that wrong is not a wrong sound — it is a
 * worker that refuses to boot over a credential it was never going to send.
 */
describe('the voice vendor the env selected', () => {
  const FISH = {
    ...FULL,
    LUVANI_TTS_VENDOR: 'fish',
    // Deliberately empty. Under fish these two are not merely unused, they must
    // not be able to produce a demand or a warning.
    ELEVEN_API_KEY: '',
    ELEVEN_VOICE_ID: '',
    FISH_API_KEY: 'f',
    FISH_VOICE_ID: 'voix-fr',
  };

  const CREDIT = 'api.fish.audio/wallet/self/api-credit';
  const SYNTH = 'api.fish.audio/v1/tts';

  /** Answers by host+path, and records every host asked and the synthesis call. */
  function fishFetch(
    byRoute: Record<string, { status: number; body?: unknown }>,
    seen?: { hosts: string[]; url?: string; init?: unknown },
  ) {
    return async (url: string, init?: unknown) => {
      const { host, pathname } = new URL(url);
      if (seen) {
        seen.hosts.push(host);
        if (pathname === '/v1/tts' || pathname.startsWith('/v1/text-to-speech')) {
          seen.url = url;
          seen.init = init;
        }
      }
      const reply = byRoute[host + pathname] ?? byRoute[host];
      if (reply === undefined) return { ok: true, status: 200, json: async () => ({}) };
      return { ok: reply.status < 400, status: reply.status, json: async () => reply.body ?? {} };
    };
  }

  test('missingRequired demands FISH_API_KEY and not ELEVEN_API_KEY when fish is selected, and the reverse by default', () => {
    const fish = { ...FULL, LUVANI_TTS_VENDOR: 'fish', ELEVEN_API_KEY: '' };
    assert.deepEqual(missingRequired(fish), ['FISH_API_KEY'], 'an empty ElevenLabs key is irrelevant under fish');
    assert.deepEqual(missingRequired({ ...fish, FISH_API_KEY: 'f' }), []);

    const eleven = { ...FULL, ELEVEN_API_KEY: '', FISH_API_KEY: 'f' };
    assert.deepEqual(missingRequired(eleven), ['ELEVEN_API_KEY'], 'and a fish key buys nothing on the default vendor');

    // An unrecognised value is the default vendor, so it must demand the
    // default vendor's key rather than nothing at all.
    assert.deepEqual(missingRequired({ ...FULL, LUVANI_TTS_VENDOR: 'nonsense', ELEVEN_API_KEY: '' }), ['ELEVEN_API_KEY']);
  });

  test('FISH_AUDIO_API_KEY is named as a near-miss of FISH_API_KEY, and never its value', () => {
    // The founder's live .env carries the key under this name. The plugin reads
    // FISH_API_KEY and only that, so the worker would refuse to start standing
    // next to a perfectly good credential.
    const w = warnings({ ...FULL, FISH_AUDIO_API_KEY: 'fk-looks-real' });
    assert.equal(w.length, 1);
    assert.match(w[0]!, /FISH_AUDIO_API_KEY/, 'the variable that is set');
    assert.match(w[0]!, /FISH_API_KEY/, 'and the one the plugin actually reads');
    assert.ok(!w[0]!.includes('fk-looks-real'), 'and never the value, which is a credential');
  });

  test('FISH_VOICE_ID unset under fish warns that the default voice is the one this migration replaces', () => {
    const w = warnings({ ...FISH, FISH_VOICE_ID: '' });
    assert.equal(w.length, 1, 'and the ElevenLabs voice warning must not fire under fish');
    assert.match(w[0]!, /FISH_VOICE_ID/);
    assert.match(w[0]!, /Sarah/, 'naming the voice is the point: it is the bug this vendor was added to escape');
    assert.ok(!w[0]!.includes('ELEVEN_VOICE_ID'));

    // A configured fish voice, and nothing to say.
    assert.deepEqual(warnings(FISH), []);
  });

  test('an unrecognised LUVANI_TTS_VENDOR says plainly that ElevenLabs will be used', () => {
    const w = warnings({ ...FULL, LUVANI_TTS_VENDOR: 'fishaudio' });
    assert.equal(w.length, 1);
    assert.match(w[0]!, /fishaudio/, 'quote what was actually written, or nobody finds the typo');
    assert.match(w[0]!, /ElevenLabs/);

    // And a value it does know is not worth a word.
    assert.deepEqual(warnings({ ...FULL, LUVANI_TTS_VENDOR: ' ELEVENLABS ' }), []);
  });

  test("a fish 402 is fatal and quotes the vendor's own message", async () => {
    // What the end of fish's free window looks like: every key present, the
    // account fine, and the pinned model refusing to speak. It reaches a learner
    // as a room that opens and a tutor that never says a word.
    const checks = await verifyVendors(
      FISH,
      '',
      fishFetch({ [SYNTH]: { status: 402, body: { detail: 'Insufficient credit' } } }) as never,
    );
    const fish = checks.find((c) => c.vendor === 'fish.audio');
    assert.ok(fish, 'a model that cannot be spoken with must stop the worker');
    assert.equal(fish.fatal, true);
    assert.match(fish.detail, /Insufficient credit/, 'the vendor explains itself better than we can');
    assert.match(fish.detail, /s2\.1-pro-free/, 'and the refusal names the model, because that is what is refused');
    assert.match(fish.detail, /FISH_MODEL/, 'and says where to change it');
  });

  test('a fish 401 stays fatal even when the body claims missing_permissions', async () => {
    // F273's scope-gap parse is ElevenLabs' wire shape and ElevenLabs' scoped
    // keys. Applying it to a vendor whose refusals have never been read would
    // turn a dead key into a silent pass on a guess about somebody else's API.
    const checks = await verifyVendors(
      FISH,
      '',
      fishFetch({
        [CREDIT]: {
          status: 401,
          body: { detail: { status: 'missing_permissions', message: 'The API key you used is missing the permission' } },
        },
      }) as never,
    );
    const fish = checks.find((c) => c.vendor === 'fish.audio');
    assert.ok(fish);
    assert.equal(fish.fatal, true);
    assert.match(fish.detail, /rejected the key/);
    assert.equal(checks.filter((c) => c.vendor === 'fish.audio').length, 1, 'one broken vendor, one message');
  });

  test('fish selected probes fish and never ElevenLabs; the default probes ElevenLabs and never fish', async () => {
    const underFish: { hosts: string[]; url?: string; init?: unknown } = { hosts: [] };
    const fishChecks = await verifyVendors(FISH, '', fishFetch({}, underFish) as never);
    assert.deepEqual(fishChecks, [], 'a healthy fish pipeline reports nothing');
    assert.ok(underFish.hosts.includes('api.fish.audio'));
    assert.ok(!underFish.hosts.includes('api.elevenlabs.io'), 'an empty ElevenLabs key must never be sent anywhere');

    // The probe asks for exactly what the tutor will ask for. The model header
    // is the billed one, so a probe that omitted it would vouch for the paid
    // model rather than the pinned free one.
    const init = underFish.init as { method?: string; headers?: Record<string, string>; body?: string };
    assert.equal(init.method, 'POST');
    assert.equal(init.headers?.model, 's2.1-pro-free');
    assert.equal(init.headers?.Authorization, 'Bearer f');
    assert.equal(init.headers?.['Content-Type'], 'application/json');
    const body = JSON.parse(init.body ?? '{}');
    assert.equal(body.text, PROBE_LINE);
    assert.equal(body.reference_id, 'voix-fr', 'the configured voice, because it is the combination that is refused');

    const underEleven: { hosts: string[] } = { hosts: [] };
    await verifyVendors(
      { ...FULL, FISH_API_KEY: 'f' },
      '',
      fishFetch({ 'api.elevenlabs.io/v1/voices': { status: 200, body: { voices: [{ voice_id: 'v' }] } } }, underEleven) as never,
    );
    assert.ok(underEleven.hosts.includes('api.elevenlabs.io'));
    assert.ok(!underEleven.hosts.includes('api.fish.audio'), 'the default vendor must not spend a fish request');
  });

  test('the fish synthesis probe runs on every boot, even with no voice configured', async () => {
    // Unlike ElevenLabs, where an unset voice means there is nothing of ours to
    // prove. Here the thing most likely to refuse is the MODEL, and the model is
    // pinned whether or not a voice is.
    const seen: { hosts: string[]; url?: string } = { hosts: [] };
    await verifyVendors({ ...FISH, FISH_VOICE_ID: '' }, '', fishFetch({}, seen) as never);
    assert.equal(seen.url, 'https://api.fish.audio/v1/tts');
  });

  test('a fish blip does not refuse to start the worker', async () => {
    for (const status of [500, 429]) {
      const checks = await verifyVendors(FISH, '', fishFetch({ [SYNTH]: { status } }) as never);
      assert.equal(checks.find((c) => c.vendor === 'fish.audio')?.fatal, false, `HTTP ${status} is weather, not config`);
    }
    const unreachable = await verifyVendors(FISH, '', (async () => {
      throw new Error('ECONNREFUSED');
    }) as never);
    assert.equal(unreachable.find((c) => c.vendor === 'fish.audio')?.fatal, false);
  });
});
