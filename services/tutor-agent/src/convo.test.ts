import { test, describe, type TestContext } from 'node:test';
import assert from 'node:assert/strict';

import { voice } from '@livekit/agents';
import {
  APERO_FRAME,
  BrainParseError,
  CAFE_FRAME,
  MockLlmClient,
  RECOVERY_LINE,
  assembleRecap,
  createConversation,
  createProfile,
  finishSession,
  integrateTurn,
  learnerSnapshotFrom,
  sampleCoachItem,
  sampleSupport,
  sampleTurn,
  supportViewFor,
  type LearnerProfile,
  type NewPhrase,
  type SupportView,
  type TurnView,
} from '@parle/brain';
import {
  STUCK_SILENCE_MS,
  decodeServerMessage,
  encodeMessage,
  type ClientMessage,
  type ServerMessage,
} from '@parle/core';

import {
  CONVO_LINES,
  ParleConversation,
  chooseFrame,
  parseStoredProfile,
  toConvoView,
  toRecapPayload,
  topicChips,
} from './convo.ts';

/** A fresh flow-mode café conversation, exactly as ParleConversation builds one. */
function freshState() {
  const profile = createProfile();
  return {
    profile,
    state: createConversation(CAFE_FRAME, learnerSnapshotFrom(profile), { strictness: 'flow', maxTurns: 12 }),
  };
}

/** A hand-built TurnView so a test can bend exactly the support it cares about. */
function viewWith(supportView: SupportView): TurnView {
  return {
    sceneReply: { speaker: 'Karim', fr: 'Et voilà.', frWritten: null, en: 'There you go.' },
    coachLine: null,
    coachNow: [],
    narration: null,
    newPhrases: [],
    supportView,
    rung: 2,
    recapDue: false,
    beat: { id: 'pay', goalEn: 'Pay', position: 4, total: 5 },
    advancedBeat: false,
    reachedForEnglish: false,
  };
}

/** Round-trip a message through the real wire encoding, or fail the test. */
function overTheWire(message: ServerMessage): ServerMessage {
  const decoded = decodeServerMessage(encodeMessage(message));
  assert.notEqual(decoded, null, 'the message must survive its own wire encoding');
  assert.deepEqual(decoded, message);
  return decoded!;
}

describe('toConvoView', () => {
  test('maps a real engine turn field by field and drops the internal beat id', () => {
    const { state } = freshState();
    const { view } = integrateTurn(state, { type: 'spoke', text: 'Bonjour, un café' }, sampleTurn());

    const convo = toConvoView(view);

    assert.deepEqual(convo.sceneReply, {
      speaker: view.sceneReply.speaker,
      fr: view.sceneReply.fr,
      frWritten: view.sceneReply.frWritten,
      en: view.sceneReply.en,
    });
    assert.equal(convo.coachLine, view.coachLine);
    assert.deepEqual(convo.supportView, view.supportView);
    assert.equal(convo.rung, view.rung);
    assert.equal(convo.recapDue, view.recapDue);

    assert.ok('id' in view.beat, 'the engine view carries the beat id');
    assert.ok(!('id' in convo.beat), 'the wire view must not leak the beat id');
    assert.deepEqual(convo.beat, { goalEn: view.beat.goalEn, position: view.beat.position, total: view.beat.total });
  });

  test('keeps the coach line when the engine surfaces one inline', () => {
    const { state } = freshState();
    // textbook-phrasing surfaces inline at every strictness — the product rule.
    const turn = sampleTurn({ coach: [sampleCoachItem({ kind: 'textbook-phrasing' })] });
    const { view } = integrateTurn(state, { type: 'spoke', text: 'Je ne sais pas' }, turn);

    assert.notEqual(view.coachLine, null);
    assert.equal(toConvoView(view).coachLine, view.coachLine);
  });

  test('preserves all four support shapes and each survives the wire', () => {
    const material = sampleSupport();
    for (const level of ['full-line', 'options', 'hint', 'none'] as const) {
      const supportView = supportViewFor(level, material);
      const convo = toConvoView(viewWith(supportView));
      assert.deepEqual(convo.supportView, supportView, `support kind ${level} changed in mapping`);
      overTheWire({ t: 'convo', view: convo });
    }
  });

  test('a mapped turn is a wire-valid convo message', () => {
    const { state } = freshState();
    const { view } = integrateTurn(state, { type: 'spoke', text: 'Bonjour' }, sampleTurn());
    overTheWire({ t: 'convo', view: toConvoView(view) });
  });
});

describe('toRecapPayload', () => {
  /** Run one coached turn and assemble the real recap the engine produces. */
  function realRecap() {
    const { state, profile } = freshState();
    const phrase: NewPhrase = {
      fr: 'Ça marche',
      frWritten: null,
      en: 'Works for me',
      enLiteral: null,
      register: 'courant',
      note: null,
    };
    // In flow mode a grammar-slip waits for the recap rather than interrupting.
    const turn = sampleTurn({
      coach: [sampleCoachItem({ kind: 'grammar-slip', weight: 'minor' })],
      newPhrases: [phrase],
      profileSignals: { errorPatterns: [{ tag: 'ne-retention', example: 'Je ne sais pas' }], usedWell: ['Ça marche'] },
    });
    const { state: after } = integrateTurn(state, { type: 'spoke', text: 'Je ne sais pas' }, turn);
    const { recap } = assembleRecap(after, { estimate: profile.cefr.estimate, confidence: profile.cefr.confidence });
    return { recap, profile };
  }

  test('maps a real assembleRecap output structurally, nothing added, nothing lost', () => {
    const { recap } = realRecap();
    const payload = toRecapPayload(recap);

    assert.deepEqual(payload, {
      headline: recap.headline,
      wins: recap.wins,
      fixes: recap.fixes,
      phrases: recap.phrases,
      nextFocus: recap.nextFocus,
      cefr: recap.cefr,
      stats: recap.stats,
    });
    assert.equal(payload.fixes.length, 1, 'the deferred grammar-slip belongs to the recap');
    assert.equal(payload.fixes[0]!.kind, 'grammar-slip');
    assert.equal(payload.phrases[0]!.fr, 'Ça marche');
    assert.equal(payload.stats.turns, 1);
  });

  test('the mapped recap plus the verbatim profile is a wire-valid recap message', () => {
    const { recap, profile } = realRecap();
    overTheWire({ t: 'recap', recap: toRecapPayload(recap), profile });
  });
});

describe('parseStoredProfile', () => {
  test('a stored profile round-trips through JSON untouched', () => {
    const profile = createProfile();
    const stored: unknown = JSON.parse(JSON.stringify(profile));
    assert.deepEqual(parseStoredProfile(stored), profile);
  });

  test('a lived-in profile round-trips too, scenarios and all', () => {
    const { state, profile } = freshState();
    const { state: recapped } = assembleRecap(state, { estimate: 'A0', confidence: 'low' });
    const lived = finishSession(profile, recapped);
    const stored: unknown = JSON.parse(JSON.stringify(lived));
    assert.deepEqual(parseStoredProfile(stored), lived);
  });

  test('junk falls back to a fresh A0 profile', () => {
    const fresh = createProfile();
    for (const junk of [undefined, null, 'not a profile', 42, [], {}, { foo: 1 }]) {
      assert.deepEqual(parseStoredProfile(junk), fresh);
    }
  });

  test('a snapshot with cefr alone is still junk — the engine dereferences more', () => {
    const partial = { cefr: { estimate: 'A1', confidence: 'low', evidence: [] } };
    assert.deepEqual(parseStoredProfile(partial), createProfile());
  });
});

describe('chooseFrame', () => {
  test('a first-ever session opens at the café', () => {
    assert.equal(chooseFrame(createProfile()), CAFE_FRAME);
  });

  test('a learner fresh from the café gets the apéro', () => {
    const profile: LearnerProfile = createProfile();
    profile.preferences.lastScenarios = [CAFE_FRAME.title];
    assert.equal(chooseFrame(profile), APERO_FRAME);
  });

  test('the café returns once it has aged out of the recent scenarios', () => {
    const profile: LearnerProfile = createProfile();
    profile.preferences.lastScenarios = [APERO_FRAME.title];
    assert.equal(chooseFrame(profile), CAFE_FRAME);
  });

  test('while the café is still recent the apéro keeps leading — the rule reads the history, not just the last scene', () => {
    const profile: LearnerProfile = createProfile();
    profile.preferences.lastScenarios = [APERO_FRAME.title, CAFE_FRAME.title];
    assert.equal(chooseFrame(profile), APERO_FRAME);
  });

  test('the scenes alternate forever — history is a rotation, not a one-way door', () => {
    // Keying on membership once locked the learner out of the café for good:
    // after one visit, `includes` was true for the rest of their life.
    const profile: LearnerProfile = createProfile();
    profile.preferences.lastScenarios = [CAFE_FRAME.title, APERO_FRAME.title];
    assert.equal(chooseFrame(profile), CAFE_FRAME);
  });

  test('matches what finishSession actually records — titles, not ids', () => {
    const { state, profile } = freshState();
    const { state: recapped } = assembleRecap(state, { estimate: 'A0', confidence: 'low' });
    const after = finishSession(profile, recapped);
    assert.ok(after.preferences.lastScenarios.includes(CAFE_FRAME.title));
    assert.equal(chooseFrame(after), APERO_FRAME);
  });
});

describe('the choosing moment', () => {
  test('a fresh learner gets three curated doors and no more', () => {
    const chips = topicChips(createProfile());
    assert.equal(chips.length, 3);
    for (const chip of chips) {
      assert.ok(chip.label.length > 0 && chip.en.length > 0 && chip.value.length > 0);
    }
  });

  test('a returning learner gets their last scene back as a fourth door', () => {
    const profile = createProfile();
    profile.preferences.lastScenarios.push(CAFE_FRAME.title);
    const chips = topicChips(profile);
    assert.equal(chips.length, 4);
    assert.equal(chips.at(-1)!.value, CAFE_FRAME.title);
  });

  test('the canned lines obey the learner-copy rules', () => {
    for (const line of Object.values(CONVO_LINES)) {
      for (const text of [line.fr, line.en]) {
        assert.ok(!text.includes('—'), `em dash in "${text}"`);
        assert.ok(!/\d/.test(text), `digit in "${text}"`);
        assert.ok(!/wrong|incorrect|failed/i.test(text), `scold in "${text}"`);
      }
    }
  });
});

describe('narration and visible recasts on the wire', () => {
  test('a narrated turn maps into the view and survives the wire', () => {
    const { state } = freshState();
    const narrated = sampleTurn({
      narration: { speaker: 'narration', fr: 'Une femme se tourne vers vous.', frWritten: null, en: 'A woman turns to you.' },
    });
    const { view } = integrateTurn(state, { type: 'spoke', text: 'Bonjour' }, narrated);
    const convo = toConvoView(view);
    assert.deepEqual(convo.narration, view.narration);
    overTheWire({ t: 'convo', view: convo });
  });

  test('inline coach findings ride the view as coachNow, quote and better intact', () => {
    const { state } = freshState();
    const turn = sampleTurn({ coach: [sampleCoachItem({ kind: 'textbook-phrasing' })] });
    const { view } = integrateTurn(state, { type: 'spoke', text: 'Je ne sais pas' }, turn);
    const convo = toConvoView(view);
    assert.equal(convo.coachNow.length, 1);
    assert.equal(convo.coachNow[0]!.quote, 'Je ne sais pas');
    assert.equal(convo.coachNow[0]!.better, "J'sais pas");
    overTheWire({ t: 'convo', view: convo });
  });
});

describe('a profile that predates memory', () => {
  test('a v2 snapshot with no memory is repaired, not discarded', () => {
    // `memory` arrived after version 2 was already on devices. migrateProfile
    // only fills it in for version 1, so this shape used to sail through the
    // guard and take the worker down on the first read of memory.facts.
    const aged = createProfile();
    const snapshot = { ...aged } as Record<string, unknown>;
    delete snapshot.memory;
    snapshot.stats = { sessions: 4, totalTurns: 40, rescues: 2, lastRung: 3 };

    const profile = parseStoredProfile(snapshot);

    assert.deepEqual(profile.memory, { facts: [], opener: null });
    assert.equal(profile.stats.sessions, 4, 'the learning history survives the repair');
    assert.equal(profile.stats.lastRung, 3);
    // The crash site itself: topicChips reads memory.facts on session open.
    assert.doesNotThrow(() => topicChips(profile));
    assert.equal(topicChips(profile).length, 3);
  });

  test('a snapshot with a broken memory field is repaired rather than believed', () => {
    const snapshot = { ...createProfile(), memory: 'nonsense' } as unknown;
    const profile = parseStoredProfile(snapshot);
    assert.deepEqual(profile.memory, { facts: [], opener: null });
  });

  test('a snapshot missing a field the engine needs still falls back to a fresh profile', () => {
    assert.equal(parseStoredProfile({ cefr: {} }).stats.sessions, 0);
    assert.equal(parseStoredProfile(null).stats.sessions, 0);
    assert.equal(parseStoredProfile('nope').stats.sessions, 0);
  });
});

// ─────────────────────────────────── the agent itself, driven off the worker

/**
 * A stand-in for the LiveKit session.
 *
 * The conversation agent never asks the pipeline to generate — the brain writes
 * the reply out of band — so `say` is the whole surface. `this.session` on
 * voice.Agent throws unless the agent is attached to a live activity, hence the
 * instance property shadowing the prototype getter.
 */
function stubSession() {
  const said: string[] = [];
  const session = {
    say(text: string) {
      said.push(text);
    },
  };
  return { session: session as never, said };
}

/** A brain that cannot answer. Everything else about the session is real. */
class FailingBrain extends MockLlmClient {
  readonly failure: Error;
  constructor(failure: Error) {
    super();
    this.failure = failure;
  }
  override async turn(): Promise<never> {
    throw this.failure;
  }
}

/**
 * `t` is not decoration: a text-mode conversation re-arms its silence clock
 * every time it publishes, so a test that ends without standing the rescue
 * down leaves the tutor patiently rescuing an empty room until the turn cap.
 */
function buildConvo(t: TestContext, opts: { voiceless?: boolean; client?: MockLlmClient } = {}) {
  const client = opts.client ?? new MockLlmClient();
  const convo = new ParleConversation(createProfile(), { voiceless: opts.voiceless ?? false, client });
  const { session, said } = stubSession();
  Object.defineProperty(convo, 'session', { value: session, configurable: true });
  const published: ServerMessage[] = [];
  convo.attach((message) => published.push(message));
  t.after(() => convo.clearRescue());
  return { convo, client, session, said, published };
}

/** A tap or a keystroke, as it arrives on the data channel. */
function tapped(message: ClientMessage): Uint8Array {
  return encodeMessage(message);
}

/** What the recogniser hands the agent at the end of a turn. */
function heard(text: string) {
  return { textContent: text } as never;
}

/** Open the session and get into the scene the way a learner does: by choosing. */
async function inScene(t: TestContext, opts: { voiceless?: boolean; client?: MockLlmClient } = {}) {
  const built = buildConvo(t, opts);
  built.convo.open(built.session);
  await built.convo.handleClientMessage(built.session, tapped({ t: 'topic', value: 'Au café' }));
  return built;
}

/** Every convo view the app was sent, in order. */
function views(published: readonly ServerMessage[]) {
  return published.filter((m): m is Extract<ServerMessage, { t: 'convo' }> => m.t === 'convo');
}

describe('the conversation agent, off the worker', () => {
  test('a conversation can be built without booting the worker', (t) => {
    // The constructor used to reach for a vendor SDK and an API key, so none of
    // the behaviour below could be built, let alone driven.
    const { convo } = buildConvo(t);
    assert.equal(convo.conversationState.turnCount, 0);
    assert.equal(convo.conversationState.finished, false);
  });

  test('the session opens on the choosing moment without a single model call', (t) => {
    const { convo, session, client, published, said } = buildConvo(t);
    convo.open(session);

    const topics = published.find((m) => m.t === 'topics');
    assert.ok(topics, 'the learner has to be asked what they want to talk about');
    assert.equal(topics.chips.length, 3);
    assert.deepEqual(said, [CONVO_LINES.opener.fr], 'and asked out loud, first');
    assert.equal(client.turnRequests.length + client.frameRequests.length, 0, 'nothing cost a round-trip');
  });

  test('choosing a topic opens a scene the learner can see and hear', async (t) => {
    const { client, published, said } = await inScene(t);

    assert.equal(client.frameRequests.length, 1, 'the scene was designed for what they asked for');
    const opened = views(published);
    assert.equal(opened.length, 1, 'the opening view lands before anyone has spoken');
    assert.equal(opened[0]!.view.beat.position, 1);
    // The bridge line is spoken from cache before the scene is designed, so
    // nobody sits in silence while the builder thinks.
    assert.ok(said.includes(CONVO_LINES.bridge.fr), 'the bridge line lands the moment the topic does');
    assert.ok(said.indexOf(CONVO_LINES.bridge.fr) < said.indexOf(CAFE_FRAME.openingLine.fr), 'and lands first');
    assert.ok(said.includes(CAFE_FRAME.openingLine.fr), 'and then the character speaks, before the learner has to');
    assert.equal(client.turnRequests.length, 0, 'opening a scene is not a turn');
  });
});

describe('a spoken conversation turn that came back with no words', () => {
  test('an empty conversation transcript stops the pipeline reply', async (t) => {
    const { convo, client } = await inScene(t);

    await assert.rejects(
      () => convo.onUserTurnCompleted({} as never, heard('   ')),
      (err: unknown) => err instanceof voice.StopResponse,
      'the unused pipeline LLM must be told to stay quiet',
    );

    assert.equal(client.turnRequests.length, 0, 'and the brain was not asked about nothing');
    assert.equal(convo.conversationState.turnCount, 0, 'the scene did not move');
    assert.equal(convo.conversationState.ladder.rescues, 0, 'nor was it counted against them');
  });

  test('a spoken turn is integrated and answered, then the pipeline is stopped', async (t) => {
    const { convo, client, published, said } = await inScene(t);

    await assert.rejects(() => convo.onUserTurnCompleted({} as never, heard('Bonjour, un café')), voice.StopResponse);
    await convo.settled();

    assert.equal(client.turnRequests.length, 1, 'the brain answered once');
    assert.equal(convo.conversationState.turnCount, 1);
    const transcript = published.find((m) => m.t === 'transcript');
    assert.ok(transcript, 'the learner is shown that they were heard');
    const reply = views(published).at(-1)!.view;
    assert.ok(said.includes(reply.sceneReply.fr), 'and the scene reply is what gets spoken');
  });
});

describe('a conversation rescue and a learner answering at the same moment', () => {
  test('a conversation rescue that loses the race is discarded', async (t) => {
    const { convo, session, client } = await inScene(t);

    // The clock runs out and the learner reaches for aide-moi in the same
    // breath. By then the timer callback is already scheduled, and clearTimeout
    // cannot unschedule what has fired — so this is the callback arriving late.
    // The help tap went straight to the engine rather than through the queue,
    // so nothing marked the moment as taken and both rescues applied: one
    // moment of being stuck counted twice, and the tutor stepping in twice.
    const generation = convo.armRescue(session);
    await convo.handleClientMessage(session, tapped({ t: 'help' }));
    await convo.settled();

    await convo.runRescue(generation);
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 1, 'one moment of being stuck, counted once');
    assert.equal(client.turnRequests.length, 1, 'and the tutor stepped in once');
    assert.equal(convo.conversationState.turnCount, 1, 'one turn of the scene spent on it, not two');
  });

  test('a conversation rescue in flight is dropped the moment the learner takes the floor', async (t) => {
    const { convo, session, client } = await inScene(t);

    const generation = convo.armRescue(session);
    convo.setLearnerSpeaking(true); // the VAD heard them; the transcript is still coming
    await convo.runRescue(generation);
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 0, 'somebody who is talking is not stuck');
    assert.equal(client.turnRequests.length, 0, 'and nothing was said over them');
  });

  test('a conversation rescue still fires when the learner really does say nothing', async (t) => {
    const { convo, session, client, published } = await inScene(t);
    t.mock.timers.enable({ apis: ['setTimeout'] });

    convo.armRescue(session);
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 1, 'four silent seconds is being stuck, not thinking');
    assert.equal(client.turnRequests.length, 1, 'and the tutor steps in, in character');
    assert.ok(views(published).length >= 2, 'the support renders before the model is back');
  });

  test('a rescue hands over support without moving the scene on', async (t) => {
    const { convo, session, published } = await inScene(t);
    const opening = views(published)[0]!.view;

    const generation = convo.armRescue(session);
    await convo.runRescue(generation);
    await convo.settled();

    // The instant merge: the scene has not moved, so the last reply stands and
    // only the support changes. Stale narration clears — a rescue is not a
    // scene shift — and the coach stays silent over a learner who froze.
    const instant = views(published)[1]!.view;
    assert.deepEqual(instant.sceneReply, opening.sceneReply, 'the learner is not moved on from what they froze on');
    assert.equal(instant.narration, null);
    assert.equal(instant.coachLine, null);
    assert.deepEqual(instant.coachNow, []);
    assert.equal(instant.supportView.kind, 'full-line', 'and they are handed the line, whatever rung they were on');
  });
});

describe('a conversation for someone who cannot speak aloud', () => {
  test('a typed conversation turn is integrated once, not twice', async (t) => {
    const { convo, session, client, published } = await inScene(t, { voiceless: true });

    // Same collision, from the other side: the silence callback has already
    // fired when the learner finishes typing. The typed path went straight to
    // the engine instead of through the queue, so the moment never counted as
    // taken and the stale rescue folded a second turn into the same scene.
    const generation = convo.armRescue(session);
    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour, un café' }));
    await convo.settled();

    await convo.runRescue(generation);
    await convo.settled();

    assert.equal(convo.conversationState.turnCount, 1, 'one typed answer is one turn in the scene');
    assert.equal(client.turnRequests.length, 1, 'and one brain call');
    assert.equal(convo.conversationState.ladder.rescues, 0, 'somebody who answered was not stuck');
    assert.equal(views(published).length, 2, 'the opening view and the reply, and nothing else');
  });

  test('two typed answers are taken in order, never against the same moment', async (t) => {
    const { convo, session, client } = await inScene(t, { voiceless: true });

    // Two arriving together is the ordinary case on a busy connection. Without
    // the queue both were prepared from the same state, so the tutor answered
    // the second sentence as though the first had never been said.
    await Promise.all([
      convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour' })),
      convo.handleClientMessage(session, tapped({ t: 'say', text: "Un café, s'il vous plaît" })),
    ]);
    await convo.settled();

    assert.equal(convo.conversationState.turnCount, 2, 'both answers landed, neither was lost');
    assert.equal(client.turnRequests.length, 2);
    assert.ok(
      client.turnRequests[1]!.messages.length > client.turnRequests[0]!.messages.length,
      'the second question was asked with the first exchange in hand',
    );
  });

  test('a typed conversation rescues a learner who goes quiet, on a reader’s clock', async (t) => {
    // Enabled before the scene opens: the clock a typed session runs on is
    // armed by the render itself, so it has to be the mocked one from the start.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { convo, client } = await inScene(t, { voiceless: true });

    // Nothing speaks, so no AgentStateChanged ever fires to start the clock.
    // Rendering the turn is the moment the learner has the floor — and a reader
    // pauses differently from a speaker, so four seconds would be a hover.
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();
    assert.equal(convo.conversationState.ladder.rescues, 0, 'a reader gets longer than a speaker');

    t.mock.timers.tick(12_000);
    await convo.settled();
    assert.equal(convo.conversationState.ladder.rescues, 1, 'a quiet learner is still a stuck learner');
    assert.equal(client.turnRequests.length, 1);
  });

  test('a typed conversation says nothing aloud, from the opener to the answer', async (t) => {
    const { convo, session, said, published } = await inScene(t, { voiceless: true });

    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour' }));
    await convo.settled();
    await convo.handleClientMessage(session, tapped({ t: 'hear' }));

    assert.deepEqual(said, [], 'a learner in a quiet carriage is never made to listen');
    assert.ok(views(published).length >= 2, 'and the whole scene still reaches them on screen');
  });
});

describe('a brain turn that fails mid-scene', () => {
  test('a refused brain turn hands back the recovery line and records nothing', async (t) => {
    const client = new FailingBrain(new BrainParseError('not a turn', '{'));
    const { convo, session, said, published } = await inScene(t, { client });

    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour' }));
    await convo.settled();

    assert.equal(said.at(-1), RECOVERY_LINE, 'the learner is never left in silence');
    assert.equal(convo.conversationState.turnCount, 0, 'and a turn that never happened is not recorded');
    assert.equal(views(published).length, 1, 'nor is a reply invented to publish');
  });

  test('a brain outage mid-scene is survived the same way', async (t) => {
    const client = new FailingBrain(new Error('socket hang up'));
    const { convo, session, said } = await inScene(t, { client });

    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour' }));
    await convo.settled();

    assert.equal(said.at(-1), RECOVERY_LINE);
    assert.equal(convo.conversationState.finished, false, 'a bad turn is not a dead session');
  });

  test('a failed brain turn in text mode still says something to the learner', async (t) => {
    const client = new FailingBrain(new BrainParseError('not a turn', '{'));
    const { convo, session, said, published } = await inScene(t, { client, voiceless: true });
    const before = published.length;

    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour' }));
    await convo.settled();

    // In text mode `say` is a no-op and a failed turn publishes no view, so the
    // learner used to sit looking at their own sentence: no reply, no reason,
    // and no way to tell a broken tutor from a slow one.
    assert.deepEqual(said, [], 'a learner in a quiet carriage is still never made to listen');
    const notice = published.slice(before).find((m) => m.t === 'error');
    assert.ok(notice, 'the learner has to be told the tutor could not answer');
    assert.equal(notice.message, RECOVERY_LINE, 'in the same words a spoken session hears');
    assert.equal(convo.conversationState.turnCount, 0, 'and a turn that never happened is not recorded');
    assert.equal(views(published).length, 1, 'nor is a reply invented to publish');
    assert.equal(convo.conversationState.finished, false, 'a bad turn is not a dead session');
  });

  test('a text learner whose turn failed is still on the silence clock', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const client = new FailingBrain(new Error('socket hang up'));
    const { convo, session, published } = await inScene(t, { client, voiceless: true });

    // A spoken session re-arms when the recovery line finishes playing. Nothing
    // plays here, so the failed turn itself has to re-arm — otherwise the one
    // thing that could still help a learner whose tutor is down never fires.
    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour' }));
    await convo.settled();

    t.mock.timers.tick(12_001);
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 1, 'a learner nobody answered is a stuck learner');
    // The support is rendered from material already in hand, so it lands even
    // with the model still down: the last thing between them and a dead screen.
    // Asserted as a view that ARRIVED after the failure — an A0 scene already
    // opens on full-line support, so the support kind alone proves nothing.
    assert.equal(views(published).length, 2, 'the opening view, then the rescue that answered the silence');
    const rescued = views(published)[1]!.view;
    assert.deepEqual(rescued.sceneReply, views(published)[0]!.view.sceneReply, 'and it holds the moment they froze on');
    assert.equal(rescued.supportView.kind, 'full-line', 'with the line handed over, no model needed');
  });
});
