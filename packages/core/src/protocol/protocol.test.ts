import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { decodeClientMessage, decodeServerMessage, encodeMessage, toLearnerInput, ERROR_KINDS, SAFETY_CATEGORIES, type ClientMessage, type ConvoView, type ServerMessage } from './protocol.ts';
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

  test('a recap with the one sound heard survives the wire', () => {
    const msg: ServerMessage = {
      t: 'recap',
      recap: {
        headline: 'You ordered a coffee in French.',
        wins: [],
        fixes: [],
        phrases: [],
        nextFocus: 'Keep going.',
        topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
        cefr: { estimate: 'A1', confidence: 'low' },
        stats: { turns: 4, rescues: 2, unassistedRate: 0.5 },
        focusSound: { ipa: 'ʁ', word: 'croissant' },
      },
      profile: {},
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
      { t: 'mode', voiceless: true },
      { t: 'mode', voiceless: false },
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
    // Choosing to type instead of speak is not an answer either, and it must
    // never cost a learner a rung for having gone quiet.
    assert.equal(toLearnerInput({ t: 'mode', voiceless: true }), null);
    assert.equal(toLearnerInput({ t: 'mode', voiceless: false }), null);
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

describe('a safety decision has its own frame on the wire', () => {
  /** A self-harm stop, the frame this whole tag exists for. */
  function safetyFrame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      t: 'safety',
      category: 'self-harm',
      action: 'stop',
      message: 'I am not the right help for this, but people who are can be reached any time.',
      ...overrides,
    };
  }

  /** Put an arbitrary object on the wire, the way a peer of any version would. */
  function overTheWire(frame: unknown): ServerMessage | null {
    return decodeServerMessage(new TextEncoder().encode(JSON.stringify(frame)));
  }

  test('the safety frame decodes with category, action and message', () => {
    const decoded = overTheWire(safetyFrame());

    assert.ok(
      decoded && decoded.t === 'safety',
      'the crisis line rides its own tag now, so the app can tell it from a TTS blip before it renders a single word',
    );
    if (!decoded || decoded.t !== 'safety') return;

    assert.equal(decoded.category, 'self-harm', 'the why survives, because it is what picks the copy and the resources beside the message');
    assert.equal(decoded.action, 'stop', 'the app has to know the session is already over, not merely troubled');
    assert.equal(
      decoded.message,
      'I am not the right help for this, but people who are can be reached any time.',
      'the words the learner is owed arrive whole and unedited',
    );

    // The same words on the old channel are still a notice, and that is the
    // whole point of splitting them: severity now comes from the tag.
    const asAnError = decodeServerMessage(encodeMessage({ t: 'error', message: 'The voice dropped out for a second.' }));
    assert.ok(asAnError && asAnError.t === 'error', 'the pipeline-hiccup channel is untouched');
    assert.notEqual(decoded.t, asAnError.t, 'a crisis and a hiccup are no longer the same shape on the wire');
  });

  test('every category and both actions survive the wire', () => {
    for (const category of SAFETY_CATEGORIES) {
      for (const action of ['stop', 'redirect'] as const) {
        const msg: ServerMessage = { t: 'safety', category, action, message: `why: ${category}` };
        assert.deepEqual(
          decodeServerMessage(encodeMessage(msg)),
          msg,
          `${category}/${action} has to round-trip, or a decision the agent made is not the one the app renders`,
        );
      }
    }
  });

  test('an unknown category is dropped rather than shown', () => {
    assert.equal(
      overTheWire(safetyFrame({ category: 'something-this-build-has-never-heard-of' })),
      null,
      'the category chooses the copy and the resources, so one this build cannot read has no rendering it could safely be given',
    );
    assert.equal(
      overTheWire(safetyFrame({ category: 'SELF-HARM' })),
      null,
      'the list is matched exactly, never case-folded, so nothing arrives as a near miss of a real category',
    );
    assert.equal(overTheWire(safetyFrame({ category: 42 })), null, 'a category that is not even a string is not a category');
    assert.equal(overTheWire(safetyFrame({ category: undefined })), null, 'a frame with no category at all is not readable either');
  });

  test('an unknown action is never guessed at', () => {
    assert.equal(
      overTheWire(safetyFrame({ action: 'pause' })),
      null,
      'there is no honest default here: reading it as redirect would soften a stop, and reading it as stop would end a lesson over a typo',
    );
    assert.equal(overTheWire(safetyFrame({ action: 'Stop' })), null, 'the two actions are matched exactly, so a near miss is not quietly promoted');
    assert.equal(overTheWire(safetyFrame({ action: undefined })), null, 'a decision that does not say what it did is not a decision the app can act on');
  });

  test('a safety decision with nothing to say is dropped', () => {
    assert.equal(overTheWire(safetyFrame({ message: undefined })), null, 'the message is the entire point of the frame');
    assert.equal(
      overTheWire(safetyFrame({ message: '   ' })),
      null,
      'an empty notice that will not clear itself is a dead-end screen, and a learner is never stranded on one',
    );
    assert.equal(overTheWire(safetyFrame({ message: 12 })), null, 'a message that is not a string has no words in it');
  });

  test('a malformed safety frame cannot throw on a screen', () => {
    const torn = [
      new TextEncoder().encode('{"t":"safety"'),
      new TextEncoder().encode('{"t":"safety"}'),
      new TextEncoder().encode('{"t":"safety","category":null,"action":null,"message":null}'),
      new TextEncoder().encode('{"t":"safety","category":["self-harm"],"action":["stop"],"message":["hi"]}'),
      new TextEncoder().encode('{"t":"safetyish","category":"self-harm","action":"stop","message":"hi"}'),
    ];
    for (const payload of torn) {
      assert.doesNotThrow(() => decodeServerMessage(payload), 'a torn frame must not take down a live conversation');
      assert.equal(decodeServerMessage(payload), null, 'an unreadable safety frame is dropped, not guessed at');
    }
  });

  test('a field from a newer agent does not cost the learner the message', () => {
    const decoded = overTheWire(safetyFrame({ resourceUrl: 'https://example.invalid/help' }));
    assert.ok(
      decoded && decoded.t === 'safety',
      'a field added in some later round must not drop the frame carrying it, or a newer agent silently stops reaching an older app',
    );
    if (!decoded || decoded.t !== 'safety') return;
    assert.equal(decoded.message, safetyFrame().message, 'the words still arrive whole');
    assert.equal(decoded.action, 'stop', 'and the decision is still the one the agent made');
  });

  test('the app cannot send itself a safety decision', () => {
    assert.equal(
      decodeClientMessage(encodeMessage(safetyFrame() as unknown as ClientMessage)),
      null,
      'the tag is the agent’s alone: a safety decision is a server judgement, and a client channel that accepted one would let the phone declare its own crisis',
    );
  });

  test('core and the agent name the same safety categories', () => {
    // The same trick evidence.test.ts uses on brain: core cannot import the
    // agent, so the pin reads source rather than exports. This is what makes
    // the restated union in protocol.ts a copy that cannot drift, instead of a
    // second opinion about what counts as a safety category.
    const declaredIn = (file: URL, whose: string): string[] => {
      const union = readFileSync(file, 'utf8').match(/export type SafetyCategory =([\s\S]*?);/);
      assert.ok(
        union,
        `${whose} no longer declares a SafetyCategory union. If it now imports the type from core, that is the tidier shape and this pin has done its job: delete it.`,
      );
      return [...union![1]!.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!);
    };

    // Core's own union against core's own list first. The union is erased
    // before any of this runs, so without reading it back off disk a category
    // could exist in the type and in nothing the decoder ever checks.
    assert.deepEqual(
      declaredIn(new URL('./protocol.ts', import.meta.url), 'protocol.ts'),
      [...SAFETY_CATEGORIES],
      'core’s category union and the list the decoder actually checks have drifted apart',
    );

    assert.deepEqual(
      [...SAFETY_CATEGORIES],
      declaredIn(new URL('../../../../services/tutor-agent/src/safety.ts', import.meta.url), 'the agent'),
      'core and the agent have drifted apart on what a safety category is, so a decision the agent can make is one the wire would drop',
    );
  });
});

describe('going quiet is a switch, not a new session', () => {
  /** Put an arbitrary object on the client channel, the way a peer of any version would. */
  function fromTheApp(frame: unknown): ClientMessage | null {
    return decodeClientMessage(new TextEncoder().encode(JSON.stringify(frame)));
  }

  test('the mode frame decodes and an unknown mode value is refused', () => {
    // Both directions, because coming back to voice is the half that is easy to
    // forget and the half a learner needs when the train empties out.
    for (const voiceless of [true, false]) {
      assert.deepEqual(
        decodeClientMessage(encodeMessage({ t: 'mode', voiceless })),
        { t: 'mode', voiceless },
        'without this tag the quiet twin costs a whole new session, which is the strand it exists to remove',
      );
    }

    // Read strictly, unlike the rest of this side of the wire. Neither default
    // is honest: true takes the voice off a learner who wanted to speak, and
    // false keeps talking at one who asked for quiet.
    for (const voiceless of ['true', 'false', 1, 0, null, 'yes', {}, [], 'voiceless']) {
      assert.equal(
        fromTheApp({ t: 'mode', voiceless }),
        null,
        `a mode frame carrying ${JSON.stringify(voiceless)} says nothing about which mode, and guessing decides the learner's voice for them`,
      );
    }
    assert.equal(fromTheApp({ t: 'mode' }), null, 'a switch that does not say which way it is switching is not a switch');

    // A dropped frame costs the tap, never the session: the mode the learner
    // already has still works, both paths are still open, and the control can be
    // tapped again.
    assert.deepEqual(
      decodeClientMessage(encodeMessage({ t: 'mode', voiceless: true })),
      { t: 'mode', voiceless: true },
      'the refusals above must not be the decoder having lost the tag altogether',
    );

    // The mirror of the safety rule, one channel over. The agent decides what is
    // said aloud; it does not get to decide that the learner has gone quiet.
    assert.equal(
      decodeServerMessage(encodeMessage({ t: 'mode', voiceless: true } as unknown as ServerMessage)),
      null,
      'the tag is the learner’s alone: an agent that could send it could silence somebody who never asked to be silenced',
    );
  });

  test('switching mode says nothing about the ladder, the scene or the minutes', () => {
    // The frame carries one field and nothing else can ride along on it. A rung,
    // a transcript or a seconds count arriving here would be the client telling
    // the agent something the agent is authoritative about.
    const decoded = decodeClientMessage(encodeMessage({ t: 'mode', voiceless: true }));
    assert.ok(decoded, 'the frame has to decode at all for the shape assertion to mean anything');
    assert.deepEqual(Object.keys(decoded), ['t', 'voiceless'], 'mode is a switch, not a place to smuggle session state');
    assert.equal(new TextDecoder().decode(encodeMessage({ t: 'mode', voiceless: false })), '{"t":"mode","voiceless":false}');
  });
});

describe('an error says what failed, and an old one still says something', () => {
  /** Put an arbitrary object on the server channel, the way a peer of any version would. */
  function overTheWire(frame: unknown): ServerMessage | null {
    return decodeServerMessage(new TextEncoder().encode(JSON.stringify(frame)));
  }

  test('an error frame carries its kind and recoverability and old frames still decode', () => {
    for (const kind of ERROR_KINDS) {
      for (const recoverable of [true, false]) {
        const msg: ServerMessage = { t: 'error', message: 'The tutor lost its voice for a moment.', kind, recoverable };
        assert.deepEqual(
          decodeServerMessage(encodeMessage(msg)),
          msg,
          `${kind}/${recoverable} has to round-trip, or the app is back to reading severity out of a sentence`,
        );
      }
    }

    // The whole reason these are optional. An agent that shipped before this
    // round sends a bare error, and it arrives exactly as it always did.
    const old = overTheWire({ t: 'error', message: 'The voice cut out for a second. Carry on.' });
    assert.ok(old && old.t === 'error', 'an agent one version behind must keep reaching the learner');
    if (!old || old.t !== 'error') return;
    assert.equal(old.message, 'The voice cut out for a second. Carry on.');
    assert.deepEqual(
      Object.keys(old),
      ['t', 'message'],
      'nothing is invented for a frame that did not say: a made-up kind or recoverability is a claim the agent never made',
    );

    // And the direction after that. A kind this build has never heard of costs
    // the label, never the notice, because the frame carries no authority for
    // unread input to inherit and the learner still needs telling.
    const ahead = overTheWire({ t: 'error', message: 'Something went wrong.', kind: 'quantum_flux_error', recoverable: true });
    assert.ok(ahead && ahead.t === 'error', 'a newer agent’s classification must not cost an older app the message');
    if (!ahead || ahead.t !== 'error') return;
    assert.equal(ahead.message, 'Something went wrong.', 'the words still arrive whole');
    assert.equal(ahead.kind, undefined, 'a kind outside the closed set is dropped, so the app can switch on it exhaustively');
    assert.equal(ahead.recoverable, true, 'the field it could read is still read');

    // Recoverability is never coerced. "no" and 0 are both truthy or falsy in
    // some reading, and both readings are a guess about whether to tell the
    // learner this will pass.
    for (const recoverable of ['true', 'no', 0, 1, null, {}]) {
      const fuzzy = overTheWire({ t: 'error', message: 'Something went wrong.', kind: 'tts_error', recoverable });
      assert.ok(fuzzy && fuzzy.t === 'error');
      if (!fuzzy || fuzzy.t !== 'error') return;
      assert.equal(fuzzy.recoverable, undefined, `${JSON.stringify(recoverable)} is not a yes or a no, and neither is a safe reading of it`);
      assert.equal(fuzzy.kind, 'tts_error', 'the field it could read survives the one it could not');
    }

    // Still not a safety decision. A classified error is a notice that clears
    // itself, and no amount of kind or recoverability promotes it.
    const classified = decodeServerMessage(encodeMessage({ t: 'error', message: 'Transcription dropped.', kind: 'stt_error', recoverable: false }));
    assert.ok(classified && classified.t === 'error', 'the kinds describe the pipeline, never a judgement about the learner');
    assert.ok(!ERROR_KINDS.some((kind) => (SAFETY_CATEGORIES as readonly string[]).includes(kind)), 'the two vocabularies must not overlap');
  });

  test('core’s error kinds and the list the decoder checks cannot drift', () => {
    // The same trick the safety pin uses, for the same reason: the union is
    // erased before any of this runs, so without reading it back off disk a kind
    // could exist in the type, be sent by an agent that compiled against it, and
    // be silently dropped by a decoder that only ever checks the list.
    const source = readFileSync(new URL('./protocol.ts', import.meta.url), 'utf8');
    const union = source.match(/export type ErrorKind =([\s\S]*?);/);
    assert.ok(union, 'protocol.ts no longer declares an ErrorKind union');
    assert.deepEqual(
      [...union![1]!.matchAll(/'([a-z0-9_-]+)'/g)].map((m) => m[1]!),
      [...ERROR_KINDS],
      'the kind union and the list the decoder actually checks have drifted apart',
    );

    // Named from the pipeline's own discriminants so the agent's mapping is the
    // field itself. Every one ends in _error because every one of them is the
    // `type` of an error the vendor adapter raised.
    for (const kind of ERROR_KINDS) {
      assert.match(kind, /^[a-z_]+_error$/, `${kind} is not a name the pipeline actually uses`);
    }
  });
});
