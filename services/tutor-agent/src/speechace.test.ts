import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseSpeechace, scoreUtterance } from './speechace.ts';
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
