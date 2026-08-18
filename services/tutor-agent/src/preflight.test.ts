import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { selectedBrain, missingRequired, warnings, preflight } from './preflight.ts';

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
