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
