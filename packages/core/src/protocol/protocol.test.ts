import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { decodeClientMessage, decodeServerMessage, encodeMessage, toLearnerInput, type ClientMessage, type ConvoView, type ServerMessage } from './protocol.ts';
import { createSession, currentPrompt, submitTurn, summarise } from '../session/session.ts';
import { CAFE_LESSON } from '../lessons/cafe.ts';

/** An ordinary free-conversation turn, with one field bent per test. */
function convoView(overrides: Partial<ConvoView> = {}): ConvoView {
  return {
    sceneReply: { speaker: 'Karim', fr: 'Ça marche, un café !', frWritten: null, en: 'Right, one coffee!' },
    coachLine: null,
    coachNow: [],
    narration: null,
    supportView: { kind: 'none' },
    rung: 2,
    beat: { goalEn: 'Order a drink', position: 3, total: 3 },
    recapDue: false,
    missionDone: false,
    ...overrides,
  };
}

/**
 * Exactly the fields an app that shipped before missions knows how to read.
 * Frozen and named one by one on purpose: a field added later is not in this
 * list, which is what "an old app ignores it" means in code.
 */
const PRE_MISSION_KEYS = ['sceneReply', 'coachLine', 'coachNow', 'narration', 'supportView', 'rung', 'beat', 'recapDue'] as const;

function asAnOldAppReadsIt(view: ConvoView): Record<string, unknown> {
  return Object.fromEntries(PRE_MISSION_KEYS.map((key) => [key, view[key]]));
}

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
        missionDone: false,
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
        missionDone: false,
      },
    };
    assert.deepEqual(decodeServerMessage(encodeMessage(msg)), msg);
  });

  test('the opening question survives the wire', () => {
    const msg: ServerMessage = {
      t: 'opening',
      prompt: { fr: 'Alors, de quoi on parle aujourd’hui ?', en: 'So, what do you want to talk about today?' },
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
        topics: [
          { fr: 'Au café', en: 'Ordering at the café' },
          { fr: 'Le rugby', en: 'Rugby' },
        ],
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
      { t: 'slower' },
      { t: 'english' },
      { t: 'say', text: 'Bonjour, un café' },
      { t: 'typing' },
      { t: 'moment' },
      { t: 'hear', line: 'scene' },
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
    // Pace, translation and typed text are conversation intents; the scripted
    // session engine has no business seeing them.
    assert.equal(toLearnerInput({ t: 'slower' }), null);
    assert.equal(toLearnerInput({ t: 'english' }), null);
    assert.equal(toLearnerInput({ t: 'say', text: 'x' }), null);
    // Asking for time is a request, not an attempt at anything.
    assert.equal(toLearnerInput({ t: 'moment' }), null);
  });
});

describe('typing is presence, not content — a composing learner is not a silent one', () => {
  test('a learner half-way through writing can be heard as present', () => {
    assert.deepEqual(
      decodeClientMessage(encodeMessage({ t: 'typing' })),
      { t: 'typing' },
      'an unknown tag decodes to null, so without this the agent hears nothing and the stuck clock keeps counting a learner who is right there',
    );
  });

  test('nothing the learner is part-way through writing goes over the wire', () => {
    const frame = new TextDecoder().decode(encodeMessage({ t: 'typing' }));
    assert.equal(
      frame,
      '{"t":"typing"}',
      'the ping is presence, not content: half a sentence is the learner’s draft, and it has no business on a data channel or in a log',
    );

    const decoded = decodeClientMessage(encodeMessage({ t: 'typing' }));
    assert.ok(decoded, 'the ping has to decode at all for the shape assertion above to mean anything');
    assert.deepEqual(Object.keys(decoded), ['t'], 'the tag carries no payload, so there is no field a draft could leak through');
  });

  test('composing is never mistaken for an answer', () => {
    assert.equal(
      toLearnerInput({ t: 'typing' }),
      null,
      'presence is not a turn: a keystroke must never move the ladder or spend one of the learner’s attempts',
    );
  });

  test('a typing frame cut off mid-flight is dropped, never thrown', () => {
    const truncated = new TextEncoder().encode('{"t":"typing"');
    assert.doesNotThrow(
      () => decodeClientMessage(truncated),
      'a torn frame from a phone on a train must not take down a live conversation',
    );
    assert.equal(decodeClientMessage(truncated), null, 'an unparseable frame is dropped, not guessed at');
  });

  test('the tutor cannot claim to be typing — the tag belongs to the learner’s side alone', () => {
    assert.equal(
      decodeServerMessage(encodeMessage({ t: 'typing' })),
      null,
      'typing is a client intent; accepting it on the server channel would let the agent’s own chatter reset the clock it owns',
    );
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

describe('the mission win rides the turn that earned it', () => {
  test('an old app ignores the mission field and behaves exactly as today', () => {
    const ordinary = decodeServerMessage(encodeMessage({ t: 'convo', view: convoView() }));
    const win = decodeServerMessage(encodeMessage({ t: 'convo', view: convoView({ missionDone: true }) }));

    assert.ok(ordinary && ordinary.t === 'convo');
    assert.ok(win && win.t === 'convo', 'the win arrives on the ordinary convo tag, so an app that never heard of missions still renders the turn');

    assert.deepEqual(
      asAnOldAppReadsIt(win.view),
      asAnOldAppReadsIt(ordinary.view),
      'finishing a mission changes nothing an older app draws: same line, same support, same rung, and no early end to the conversation',
    );

    // The other half of the mismatched pair, built as the literal frame an
    // agent that shipped before missions puts on the wire: no such key at all.
    const { missionDone: _omitted, ...viewFromAnOldAgent } = convoView();
    assert.ok(
      !('missionDone' in viewFromAnOldAgent),
      'the frame under test has to genuinely be missing the key, or none of what follows means anything',
    );

    const fromAnOldAgent = decodeServerMessage(
      new TextEncoder().encode(JSON.stringify({ t: 'convo', view: viewFromAnOldAgent })),
    );
    assert.ok(
      fromAnOldAgent && fromAnOldAgent.t === 'convo',
      'a turn from an agent that predates missions must still decode, or the learner is stranded mid-scene by a field they never asked for',
    );

    assert.deepEqual(
      asAnOldAppReadsIt(fromAnOldAgent.view),
      asAnOldAppReadsIt(ordinary.view),
      'an old agent’s turn draws exactly as today’s: field by field, the missing key changes nothing on the screen',
    );

    assert.deepEqual(
      Object.keys(fromAnOldAgent.view).sort(),
      [...PRE_MISSION_KEYS, 'missionDone'].sort(),
      'the app is promised a field that is always there, and reading the frame is where that promise gets kept — every field it already drew, plus the mission one',
    );

    assert.equal(
      fromAnOldAgent.view.missionDone,
      false,
      'that session had no mission, so it has no win: absent has to arrive as false and never as undefined, or the card is one loose check away from congratulating a learner who was never on a mission',
    );

    const garbled = decodeServerMessage(
      new TextEncoder().encode(JSON.stringify({ t: 'convo', view: { ...viewFromAnOldAgent, missionDone: 'oui' } })),
    );
    assert.ok(garbled && garbled.t === 'convo', 'a view with an odd value in one field is still a turn, and the learner still gets to see it');
    assert.equal(
      garbled.view.missionDone,
      false,
      'only a plain true is a win, so nothing a future build puts in that field can raise a card the learner did not earn',
    );
  });

  test('a finished mission is still a turn, and still carries no number', () => {
    const msg: ServerMessage = { t: 'convo', view: convoView({ missionDone: true }) };
    const decoded = decodeServerMessage(encodeMessage(msg));

    assert.deepEqual(decoded, msg, 'the win survives its own wire encoding, sticky flag and all');
    assert.ok(decoded && decoded.t === 'convo');
    assert.equal(
      decoded.view.recapDue,
      false,
      'the win is not the end: the beats being done raises a card, and only recapDue ever closes a session',
    );
  });
});

describe('replaying a line — the tutor says it again for whoever is listening', () => {
  test('an old agent reads a replay request as a plain hear and still speaks', () => {
    const decoded = decodeClientMessage(encodeMessage({ t: 'hear', line: 'scene' }));
    assert.deepEqual(
      decoded,
      { t: 'hear', line: 'scene' },
      'the replay keeps the tag an old agent already handles, so the new field is the only new thing on the wire, and it reaches an agent that knows it intact',
    );
    assert.ok(decoded && decoded.t === 'hear');

    // An agent that switches on the tag and reads no further says the line it
    // has always said.
    const whatAnOldAgentSpeaks = (msg: ClientMessage): string | null => (msg.t === 'hear' ? 'the support line' : null);
    assert.equal(
      whatAnOldAgentSpeaks(decoded),
      'the support line',
      'a learner who asks to hear a line again gets a line rather than silence: degraded, never dead, and never a control that does nothing',
    );

    // The same request naming a line this build has never heard of — the shape
    // an app one version ahead would send. It is read back down to the plain
    // hear an older agent understands, rather than handing the voice a name
    // nothing on this side can speak.
    const fromANewerApp = decodeClientMessage(new TextEncoder().encode('{"t":"hear","line":"narration"}'));
    assert.deepEqual(
      fromANewerApp,
      { t: 'hear' },
      'an unknown line name never reaches the voice: the request is read as the plain hear it has always been, because the tap has to produce a line either way',
    );
    assert.ok(fromANewerApp && fromANewerApp.t === 'hear');
    assert.equal(
      whatAnOldAgentSpeaks(fromANewerApp),
      'the support line',
      'the learner tapped a control and something must come back: a replay the agent cannot serve exactly still comes back as the line it can',
    );

    assert.equal(
      toLearnerInput(decoded),
      null,
      'hearing a line again is support, so it must never spend an attempt or move the ladder',
    );
  });

  test('a plain hear still asks for the line the learner is being offered', () => {
    const decoded = decodeClientMessage(encodeMessage({ t: 'hear' }));
    assert.deepEqual(decoded, { t: 'hear' }, 'the field is optional, so an app that never sends it is not a malformed app');
    assert.ok(decoded && decoded.t === 'hear');
    assert.equal(
      decoded.line,
      undefined,
      'absent means support: every app already out there keeps asking for exactly what it always asked for',
    );
  });
});

describe('a learner asking for time is present, not stuck', () => {
  test('a learner who asks for a moment can be heard asking', () => {
    assert.deepEqual(
      decodeClientMessage(encodeMessage({ t: 'moment' })),
      { t: 'moment' },
      'an unknown tag decodes to null, so without this the agent never hears the request and the stuck clock keeps counting a learner who just asked it to wait',
    );
  });

  test('why the learner needs a moment stays with the learner', () => {
    const frame = new TextDecoder().decode(encodeMessage({ t: 'moment' }));
    assert.equal(
      frame,
      '{"t":"moment"}',
      'the request is presence, not an explanation: the clock only needs to know the learner is there',
    );

    const decoded = decodeClientMessage(encodeMessage({ t: 'moment' }));
    assert.ok(decoded, 'the request has to decode at all for the shape assertion above to mean anything');
    assert.deepEqual(
      Object.keys(decoded),
      ['t'],
      'no field to carry a reason means no reason can be logged or counted, and asking for time is never evidence of anything',
    );
  });

  test('asking for time is never an answer', () => {
    assert.equal(
      toLearnerInput({ t: 'moment' }),
      null,
      'a moment is a request, not a turn: it must never spend an attempt, move the ladder or read as a rescue',
    );
  });

  test('the tutor cannot ask the learner for a moment', () => {
    assert.equal(
      decodeServerMessage(encodeMessage({ t: 'moment' })),
      null,
      'the tag is the learner’s alone, and a decoder whose allow-list lacks it drops the frame — which is also how an agent that predates the tag safely ignores it',
    );
  });

  test('a tag that merely looks like a moment is not one', () => {
    assert.equal(
      decodeClientMessage(new TextEncoder().encode('{"t":"momentary"}')),
      null,
      'the allow-list is exact, never a prefix match, so a tag from some future round cannot smuggle itself in as this one',
    );
  });

  test('a moment frame torn in flight is dropped, never thrown', () => {
    const truncated = new TextEncoder().encode('{"t":"mom');
    assert.doesNotThrow(
      () => decodeClientMessage(truncated),
      'a torn frame from a phone on a train must not take down a live conversation',
    );
    assert.equal(decodeClientMessage(truncated), null, 'an unparseable frame is dropped, not guessed at');
  });
});
