import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseSpeechace, scoreUtterance } from './speechace.ts';
import { toInventoryIpa } from '../../shared/phoneMap.ts';
import { buildReport } from '@parle/core';

/** A trimmed but structurally faithful Speechace v9 response for "sur place". */
const RESPONSE = {
  text_score: {
    text: 'Sur place',
    word_score_list: [
      {
        word: 'sur',
        phone_score_list: [
          { phone: 's', quality_score: 94 },
          { phone: 'y', quality_score: 41, sound_most_like: 'u' },
          { phone: 'ʁ', quality_score: 38, sound_most_like: 'l' },
        ],
      },
      {
        word: 'place',
        phone_score_list: [
          { phone: 'p', quality_score: 88 },
          { phone: 'l', quality_score: 91 },
          { phone: 'a', quality_score: 90 },
          { phone: 's', quality_score: 93 },
        ],
      },
    ],
  },
};

describe('parsing the assessor response', () => {
  test('flattens words and phones into observations', () => {
    const obs = parseSpeechace(RESPONSE);
    assert.equal(obs.length, 7);
    assert.deepEqual(obs[1], { ipa: 'y', score: 41, word: 'sur', substituted: 'u' });
  });

  test('keeps the word each sound came from, so feedback can quote it', () => {
    const obs = parseSpeechace(RESPONSE);
    assert.ok(obs.every((o) => o.word.length > 0));
    assert.equal(obs.find((o) => o.ipa === 'ʁ')?.word, 'sur');
  });

  test('records what the learner actually produced instead', () => {
    const obs = parseSpeechace(RESPONSE);
    assert.equal(obs.find((o) => o.ipa === 'ʁ')?.substituted, 'l');
  });

  test('does not report a substitution when the sound was correct', () => {
    const obs = parseSpeechace(RESPONSE);
    assert.equal(obs.find((o) => o.ipa === 'p')?.substituted, undefined);
  });

  test('a phone that matches itself is not treated as a substitution', () => {
    const obs = parseSpeechace({
      text_score: { word_score_list: [{ word: 'rue', phone_score_list: [{ phone: 'ʁ', quality_score: 80, sound_most_like: 'ʁ' }] }] },
    });
    assert.equal(obs[0]?.substituted, undefined);
  });

  test('malformed payloads yield nothing rather than throwing mid-conversation', () => {
    for (const bad of [null, undefined, {}, { text_score: {} }, { text_score: { word_score_list: 'nope' } }, [1, 2, 3]]) {
      assert.deepEqual(parseSpeechace(bad), []);
    }
  });

  test('entries missing a score are skipped, not defaulted to zero', () => {
    const obs = parseSpeechace({
      text_score: { word_score_list: [{ word: 'rue', phone_score_list: [{ phone: 'ʁ' }, { phone: 'y', quality_score: 70 }] }] },
    });
    assert.equal(obs.length, 1);
    assert.equal(obs[0]!.ipa, 'y');
  });
});

describe('the assessor feeds the scorer end to end', () => {
  test('a real response produces the focus point and the matching drill', () => {
    // Three utterances' worth, so the scorer clears its minimum-sample bar.
    const obs = [...parseSpeechace(RESPONSE), ...parseSpeechace(RESPONSE), ...parseSpeechace(RESPONSE)];
    const report = buildReport(obs);

    assert.ok(report.focus, 'expected a focus point from genuinely weak scores');
    assert.equal(report.focus.phoneme.ipa, 'ʁ', 'the hardest, most-wrong sound should win');
    assert.equal(report.focus.drill.id, 'r-vs-l', 'and the drill should contrast the actual substitution');
    assert.match(report.focus.reason, /sur/, 'feedback should quote the word they said it in');
  });
});

describe('degrading safely', () => {
  test('no API key means no score, not an exception', async () => {
    const saved = process.env.SPEECHACE_API_KEY;
    delete process.env.SPEECHACE_API_KEY;
    assert.deepEqual(await scoreUtterance({ reference: 'Bonjour' }), []);
    if (saved !== undefined) process.env.SPEECHACE_API_KEY = saved;
  });

  test('no audio means no score, even with a key present', async () => {
    const saved = process.env.SPEECHACE_API_KEY;
    process.env.SPEECHACE_API_KEY = 'test-key';
    assert.deepEqual(await scoreUtterance({ reference: 'Bonjour' }), []);
    if (saved === undefined) delete process.env.SPEECHACE_API_KEY;
    else process.env.SPEECHACE_API_KEY = saved;
  });
});

describe('the request that carries the audio', () => {
  /** A capturing stand-in for fetch: records the call, answers with RESPONSE. */
  function recorder(reply: { ok?: boolean; status?: number; body?: unknown } = {}) {
    const calls: { url: string; init: { method?: string; body?: FormData } }[] = [];
    const fetchFn = async (url: string, init: { method?: string; body?: FormData }) => {
      calls.push({ url, init });
      return {
        ok: reply.ok ?? true,
        status: reply.status ?? 200,
        json: async () => reply.body ?? RESPONSE,
      };
    };
    return { calls, fetchFn };
  }

  /** Recognisable bytes, so "the audio arrived" is a claim and not a shrug. */
  const AUDIO = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03, 0x04]);

  async function withKey<T>(run: () => Promise<T>): Promise<T> {
    const saved = process.env.SPEECHACE_API_KEY;
    process.env.SPEECHACE_API_KEY = 'test-key';
    try {
      return await run();
    } finally {
      if (saved === undefined) delete process.env.SPEECHACE_API_KEY;
      else process.env.SPEECHACE_API_KEY = saved;
    }
  }

  test('an utterance with audio is sent to the vendor with its reference text', async () => {
    const { calls, fetchFn } = recorder();
    await withKey(() => scoreUtterance({ reference: 'Sur place', audio: AUDIO }, fetchFn));

    assert.equal(calls.length, 1, 'exactly one request should carry the utterance');
    const call = calls[0]!;
    assert.equal(call.init.method, 'POST');
    assert.ok(call.url.startsWith('https://api.speechace.co/api/scoring/text/v9/json'));

    const form = call.init.body!;
    assert.equal(form.get('text'), 'Sur place', 'accuracy scoring is meaningless without the line');

    const sent = form.get('user_audio_file') as Blob | null;
    assert.ok(sent, 'the audio part is the whole point of the request');
    assert.deepEqual(new Uint8Array(await sent.arrayBuffer()), AUDIO, 'the bytes the learner spoke');
  });

  test('the utterance is scored against the dialect the learner is learning', async () => {
    const { calls, fetchFn } = recorder();
    await withKey(() => scoreUtterance({ reference: 'Bonjour', audio: AUDIO }, fetchFn));
    assert.equal(calls[0]!.init.body!.get('dialect'), 'fr-fr', 'French by default, never English');
    assert.match(calls[0]!.url, /dialect=fr-fr/);

    const quebec = recorder();
    await withKey(() => scoreUtterance({ reference: 'Bonjour', audio: AUDIO, dialect: 'fr-ca' }, quebec.fetchFn));
    assert.equal(quebec.calls[0]!.init.body!.get('dialect'), 'fr-ca');
    assert.match(quebec.calls[0]!.url, /dialect=fr-ca/);
  });

  test('what the vendor heard comes back as the learner’s observations', async () => {
    const { fetchFn } = recorder();
    const observations = await withKey(() => scoreUtterance({ reference: 'Sur place', audio: AUDIO }, fetchFn));

    assert.equal(observations.length, 7, 'a scored utterance must produce scores');
    assert.deepEqual(observations[1], { ipa: 'y', score: 41, word: 'sur', substituted: 'u' });
  });

  test('a vendor that refuses the utterance leaves the session unscored, not broken', async () => {
    const refused = recorder({ ok: false, status: 429 });
    assert.deepEqual(await withKey(() => scoreUtterance({ reference: 'Bonjour', audio: AUDIO }, refused.fetchFn)), []);

    const thrown = async () => {
      throw new Error('socket hang up');
    };
    assert.deepEqual(
      await withKey(() => scoreUtterance({ reference: 'Bonjour', audio: AUDIO }, thrown as never)),
      [],
      'a scorer outage degrades to text-only grading rather than ending the session',
    );
  });

  test('no request is made at all when there is nothing to score', async () => {
    const noAudio = recorder();
    await withKey(() => scoreUtterance({ reference: 'Bonjour' }, noAudio.fetchFn));
    assert.equal(noAudio.calls.length, 0, 'silence is not worth a vendor round trip');

    const noKey = recorder();
    const saved = process.env.SPEECHACE_API_KEY;
    delete process.env.SPEECHACE_API_KEY;
    await scoreUtterance({ reference: 'Bonjour', audio: AUDIO }, noKey.fetchFn);
    if (saved !== undefined) process.env.SPEECHACE_API_KEY = saved;
    assert.equal(noKey.calls.length, 0, 'an unconfigured scorer must not send the learner’s voice anywhere');
  });
});

describe('the vendor does not have to speak our alphabet', () => {
  /** The same utterance, scored in X-SAMPA instead of IPA. */
  const xsampa = {
    text_score: {
      word_score_list: [
        {
          word: 'rue',
          phone_score_list: [
            { phone: 'R', quality_score: 41, sound_most_like: 'l' },
            { phone: 'y', quality_score: 52, sound_most_like: 'u' },
          ],
        },
        {
          word: 'bonjour',
          phone_score_list: [
            { phone: 'b', quality_score: 95 },
            { phone: 'o~', quality_score: 48 },
            { phone: 'Z', quality_score: 71, sound_most_like: 'S' },
          ],
        },
      ],
    },
  };

  test('vendor phone symbols map onto the inventory', () => {
    const observations = parseSpeechace(xsampa);

    // Every one of these used to be dropped by the exact-match lookup in
    // buildReport, which is silent by design — so the whole session produced no
    // focus and looked exactly like a session that went well.
    assert.deepEqual(
      observations.map((o) => o.ipa),
      ['ʁ', 'y', 'b', 'ɔ̃', 'ʒ'],
    );
    assert.equal(observations[1]?.substituted, 'u');
    assert.equal(observations[4]?.substituted, 'ʃ', 'what they said instead is translated too');
  });

  test('the mapped observations reach a focus point, which is the whole purpose', () => {
    const report = buildReport([
      ...parseSpeechace(xsampa),
      ...parseSpeechace(xsampa),
      ...parseSpeechace(xsampa),
    ]);
    assert.ok(report.focus, 'three samples of a badly-produced /ʁ/ must be actionable');
    assert.equal(report.focus.phoneme.ipa, 'ʁ');
  });

  test('a symbol nobody can place is dropped rather than guessed at', () => {
    const observations = parseSpeechace({
      text_score: { word_score_list: [{ word: 'x', phone_score_list: [{ phone: 'ʘ', quality_score: 10 }] }] },
    });
    assert.deepEqual(observations, [], 'naming the wrong sound is worse than naming none');
  });

  test('symbols already in IPA are passed through untouched', () => {
    assert.equal(toInventoryIpa('ʁ'), 'ʁ');
    assert.equal(toInventoryIpa('ɔ̃'), 'ɔ̃');
    assert.equal(toInventoryIpa('y'), 'y');
    assert.equal(toInventoryIpa('nonsense'), null);
  });
});
