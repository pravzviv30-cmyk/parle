import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { decodeClientMessage, decodeServerMessage, encodeMessage, toLearnerInput, type ServerMessage } from './protocol.ts';
import { createSession, currentPrompt, submitTurn, summarise } from '../session/session.ts';
import { CAFE_LESSON } from '../lessons/cafe.ts';

describe('round-tripping real session objects', () => {
  test('a prompt survives the wire intact', () => {
    const state = createSession(CAFE_LESSON);
    const prompt = currentPrompt(CAFE_LESSON, state);
    const decoded = decodeServerMessage(encodeMessage({ t: 'prompt', prompt }));

    assert.ok(decoded && decoded.t === 'prompt');
    assert.deepEqual(decoded.prompt, JSON.parse(JSON.stringify(prompt)));
    assert.equal(decoded.prompt.support.kind, 'full-line');
    assert.equal(decoded.prompt.directive.rung, 1);
  });

  test('every rung’s support shape survives, including the option list', () => {
    let state = createSession(CAFE_LESSON);
    for (let i = 0; i < 2; i++) {
      state = submitTurn(CAFE_LESSON, state, {
        type: 'spoke',
        transcript: currentPrompt(CAFE_LESSON, state).turn.target,
        phonemes: [],
        durationSec: 2,
      }).state;
    }
    const prompt = currentPrompt(CAFE_LESSON, state);
    assert.equal(prompt.support.kind, 'options');

    const decoded = decodeServerMessage(encodeMessage({ t: 'prompt', prompt }));
    assert.ok(decoded && decoded.t === 'prompt' && decoded.prompt.support.kind === 'options');
    if (decoded.t === 'prompt' && decoded.prompt.support.kind === 'options') {
      assert.ok(decoded.prompt.support.options.length >= 2);
      assert.ok(decoded.prompt.support.options.every((o) => o.text && o.en));
    }
  });

  test('a summary survives, focus point and drill included', () => {
    let state = createSession(CAFE_LESSON);
    for (const word of ['bonjour', 'merci', 'très']) {
      state = submitTurn(CAFE_LESSON, state, {
        type: 'spoke',
        transcript: currentPrompt(CAFE_LESSON, state).turn.target,
        phonemes: [{ ipa: 'ʁ', score: 36, word, substituted: 'l' }],
        durationSec: 2,
      }).state;
    }
    const summary = summarise(state);
    assert.ok(summary.pronunciation.focus, 'test needs a focus point to be meaningful');

    const decoded = decodeServerMessage(encodeMessage({ t: 'summary', summary }));
    assert.ok(decoded && decoded.t === 'summary');
    if (decoded.t !== 'summary') return;
    assert.equal(decoded.summary.pronunciation.focus?.phoneme.ipa, 'ʁ');
    assert.equal(decoded.summary.pronunciation.focus?.drill.id, 'r-vs-l');
    assert.deepEqual(decoded.summary.wordsProduced, summary.wordsProduced);
  });

  test('accented French survives encoding', () => {
    const msg: ServerMessage = { t: 'transcript', text: "Un café, s'il vous plaît — où sont les toilettes ?", final: true };
    const decoded = decodeServerMessage(encodeMessage(msg));
    assert.deepEqual(decoded, msg);
  });

  test('a free-conversation turn survives the wire', () => {
    const msg: ServerMessage = {
      t: 'convo',
      view: {
        sceneReply: { speaker: 'Karim', fr: "Et voilà, un café. Autre chose ?", frWritten: null, en: 'Here you go, a coffee. Anything else?' },
        coachLine: 'On dit plutôt «un café, s’il vous plaît».',
        coachNow: [
          {
            kind: 'textbook-phrasing',
            quote: 'je voudrais un café',
            better: 'un café, s’il vous plaît',
            betterWritten: null,
            betterEn: 'a coffee, please',
            why: 'That is how a local orders at a counter.',
            weight: 'matters-now',
          },
        ],
        narration: null,
        supportView: { kind: 'options', options: [{ text: 'Non, merci', en: 'No, thanks' }] },
        rung: 2,
        beat: { goalEn: 'Order a drink', position: 1, total: 4 },
        recapDue: false,
      },
    };
    assert.deepEqual(decodeServerMessage(encodeMessage(msg)), msg);
  });

  test('an opening view carries its narration; the narrator is not a character', () => {
    const msg: ServerMessage = {
      t: 'convo',
      view: {
        sceneReply: { speaker: 'L’inconnu', fr: 'Excusez-moi ! Vous faites quoi, là ?', frWritten: null, en: 'Excuse me! What are you doing there?' },
        coachLine: null,
        coachNow: [],
        narration: {
          speaker: 'narration',
          fr: 'Imagine la scène : tu marches dans la rue, et tu bouscules un grand monsieur.',
          frWritten: null,
          en: 'Imagine the scene: you are walking down the street, and you bump into a tall man.',
        },
        supportView: { kind: 'full-line', line: 'Pardon, je regardais les plaques.', written: null, gloss: 'Sorry, I was looking at the signs.' },
        rung: 1,
        beat: { goalEn: 'Recover from the bump', position: 1, total: 4 },
        recapDue: false,
      },
    };
    assert.deepEqual(decodeServerMessage(encodeMessage(msg)), msg);
  });

  test('the topic-choosing message survives the wire', () => {
    const msg: ServerMessage = {
      t: 'topics',
      prompt: { fr: 'Alors, de quoi on parle aujourd’hui ?', en: 'So, what do you want to talk about today?' },
      chips: [
        { label: 'Dans la rue', en: 'People you meet in the street', value: 'a chance conversation with a stranger in the street' },
        { label: 'Au café', en: 'Ordering at the counter', value: 'ordering at a Paris café' },
      ],
    };
    assert.deepEqual(decodeServerMessage(encodeMessage(msg)), msg);
  });

  test('a recap survives the wire, opaque profile included', () => {
    const msg: ServerMessage = {
      t: 'recap',
      recap: {
        headline: 'You ordered a coffee in French.',
        wins: ['Un café, s’il vous plaît'],
        fixes: [
          {
            kind: 'textbook-phrasing',
            quote: 'je voudrais un café',
            better: 'un café, s’il vous plaît',
            betterWritten: null,
            betterEn: 'a coffee, please',
            why: 'That is how a local orders at a counter.',
            weight: 'minor',
          },
        ],
        phrases: [{ fr: 'sur place', frWritten: null, en: 'for here', enLiteral: 'on the spot', register: 'neutral', note: null }],
        nextFocus: 'The sound in "un" needs your nose, not the letter n.',
        cefr: { estimate: 'A1', confidence: 'low' },
        stats: { turns: 9, rescues: 1, unassistedRate: 0.6 },
      },
      profile: { anything: ['the', 'agent', 'sends'] },
    };
    assert.deepEqual(decodeServerMessage(encodeMessage(msg)), msg);
  });
});

describe('client messages', () => {
  test('each client tag round-trips', () => {
    for (const msg of [
      { t: 'ready' },
      { t: 'help' },
      { t: 'skip' },
      { t: 'hear' },
      { t: 'leave' },
      { t: 'choice', text: 'Sur place' },
      { t: 'topic', value: 'a chance conversation in the street' },
      { t: 'slower' },
      { t: 'english' },
      { t: 'say', text: 'Bonjour, un café' },
    ] as const) {
      assert.deepEqual(decodeClientMessage(encodeMessage(msg)), msg);
    }
  });

  test('help and skip map onto session inputs; the rest do not', () => {
    assert.deepEqual(toLearnerInput({ t: 'help' }), { type: 'help' });
    assert.deepEqual(toLearnerInput({ t: 'skip' }), { type: 'skip' });
    assert.equal(toLearnerInput({ t: 'ready' }), null);
    assert.equal(toLearnerInput({ t: 'choice', text: 'x' }), null);
    // Hearing the line again is support, not an answer — it must never move the
    // ladder or count as a turn.
    assert.equal(toLearnerInput({ t: 'hear' }), null);
    // Topic choice, pace, translation and typed text are conversation intents;
    // the scripted session engine has no business seeing them.
    assert.equal(toLearnerInput({ t: 'topic', value: 'x' }), null);
    assert.equal(toLearnerInput({ t: 'slower' }), null);
    assert.equal(toLearnerInput({ t: 'english' }), null);
    assert.equal(toLearnerInput({ t: 'say', text: 'x' }), null);
  });
});

describe('a malformed frame never kills a live conversation', () => {
  const junk = [
    new TextEncoder().encode('not json at all'),
    new TextEncoder().encode('{"t":'),
    new TextEncoder().encode('null'),
    new TextEncoder().encode('[1,2,3]'),
    new TextEncoder().encode('"a string"'),
    new TextEncoder().encode('{"t":"unknown-tag"}'),
    new TextEncoder().encode('{"no_tag":true}'),
    new TextEncoder().encode('{"t":42}'),
    new Uint8Array([0xff, 0xfe, 0xfd]),
    new Uint8Array(0),
  ];

  test('server decoding returns null rather than throwing', () => {
    for (const payload of junk) {
      assert.doesNotThrow(() => decodeServerMessage(payload));
      assert.equal(decodeServerMessage(payload), null);
    }
  });

  test('client decoding returns null rather than throwing', () => {
    for (const payload of junk) {
      assert.doesNotThrow(() => decodeClientMessage(payload));
      assert.equal(decodeClientMessage(payload), null);
    }
  });

  test('a client message is not accepted on the server channel, or vice versa', () => {
    assert.equal(decodeServerMessage(encodeMessage({ t: 'help' })), null);
    assert.equal(decodeClientMessage(encodeMessage({ t: 'speaking', speaking: true })), null);
  });
});
