import { test, describe, type TestContext } from 'node:test';
import assert from 'node:assert/strict';

import { tokenize, voice } from '@livekit/agents';
import {
  APERO_FRAME,
  AnthropicBrainClient,
  BrainParseError,
  CAFE_FRAME,
  ClaudeCliBrainClient,
  MockLlmClient,
  OpenAiCompatBrainClient,
  OpenAiResponsesBrainClient,
  SplitBrainClient,
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
  withLearnerName,
  type BrainFrameRequest,
  type BrainTurnRequest,
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
  MOMENT_GRACE_MS,
  ParleConversation,
  brainClient,
  chooseFrame,
  frameDeadlineMs,
  missionOpening,
  openerFor,
  parseStoredProfile,
  postSessionDeadlineMs,
  seededOpening,
  spokenTurn,
  sttLanguageFor,
  toConvoView,
  toRecapPayload,
  turnIsUninterruptible,
  validMissionId,
  type SttLanguage,
} from './convo.ts';
import { forgetReportedSessions, noteSessionReported } from './tutor.ts';

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
    missionDone: false,
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
      topics: recap.topics,
      cefr: recap.cefr,
      stats: recap.stats,
    });
    assert.ok(payload.topics.length >= 1, 'the frame topic itself always rides the recap');
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

    assert.deepEqual(profile.memory, { facts: [], opener: null, name: null });
    assert.equal(profile.stats.sessions, 4, 'the learning history survives the repair');
    assert.equal(profile.stats.lastRung, 3);
    // The crash site itself: open() reads memory.opener on session open.
    const convo = new ParleConversation(profile, { client: new MockLlmClient() });
    const { session } = stubSession();
    Object.defineProperty(convo, 'session', { value: session, configurable: true });
    assert.doesNotThrow(() => convo.open(session));
  });

  test('a snapshot with a broken memory field is repaired rather than believed', () => {
    const snapshot = { ...createProfile(), memory: 'nonsense' } as unknown;
    const profile = parseStoredProfile(snapshot);
    assert.deepEqual(profile.memory, { facts: [], opener: null, name: null });
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

class MeteredBrain extends MockLlmClient {
  override async frame(request: BrainFrameRequest) {
    const result = await super.frame(request);
    return {
      ...result,
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, cacheWriteTokens: 0 },
    };
  }

  override async turn(request: BrainTurnRequest) {
    const result = await super.turn(request);
    return {
      ...result,
      usage: { inputTokens: 40, outputTokens: 10, cacheReadTokens: 80, cacheWriteTokens: 5 },
    };
  }
}

/**
 * `t` is not decoration: a text-mode conversation re-arms its silence clock
 * every time it publishes, so a test that ends without standing the rescue
 * down leaves the tutor patiently rescuing an empty room until the turn cap.
 */
function buildConvo(
  t: TestContext,
  opts: {
    voiceless?: boolean;
    client?: MockLlmClient;
    seedTopic?: unknown;
    missionId?: unknown;
    profile?: LearnerProfile;
    /** Written before `attach`, exactly as agent.ts writes it. */
    sessionId?: string;
  } = {},
) {
  const client = opts.client ?? new MockLlmClient();
  const sttLanguages: SttLanguage[] = [];
  const convo = new ParleConversation(opts.profile ?? createProfile(), {
    voiceless: opts.voiceless ?? false,
    client,
    seedTopic: opts.seedTopic,
    missionId: opts.missionId,
    setSttLanguage: (language) => sttLanguages.push(language),
  });
  const { session, said } = stubSession();
  Object.defineProperty(convo, 'session', { value: session, configurable: true });
  // agent.ts writes the signed session id before it wires the channel back to
  // the app, and the spent-credential refusal depends on that order: it is
  // decided at the setter and spoken at `attach`.
  if (opts.sessionId !== undefined) convo.sessionId = opts.sessionId;
  const published: ServerMessage[] = [];
  convo.attach((message) => published.push(message));
  t.after(() => convo.clearRescue());
  return { convo, client, session, said, published, sttLanguages };
}

/** A tap or a keystroke, as it arrives on the data channel. */
function tapped(message: ClientMessage): Uint8Array {
  return encodeMessage(message);
}

/** What the recogniser hands the agent at the end of a turn. */
function heard(text: string) {
  return { textContent: text } as never;
}

/** Open the session and get into the scene the way a learner does: by answering. */
async function inScene(
  t: TestContext,
  opts: { voiceless?: boolean; client?: MockLlmClient; profile?: LearnerProfile } = {},
) {
  const built = buildConvo(t, opts);
  built.convo.open(built.session);
  await built.convo.handleClientMessage(built.session, tapped({ t: 'say', text: 'Au café' }));
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

  test('the session meters real model usage instead of guessing a flat cost', async (t) => {
    t.mock.method(console, 'info', () => {});
    const { convo, session } = await inScene(t, { client: new MeteredBrain() });
    assert.deepEqual(convo.brainMeter, {
      calls: 1,
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, cacheWriteTokens: 0 },
    });

    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour' }));
    await convo.settled();
    assert.deepEqual(convo.brainMeter, {
      calls: 2,
      usage: { inputTokens: 140, outputTokens: 30, cacheReadTokens: 130, cacheWriteTokens: 5 },
    });
  });

  test('the session opens on the choosing moment without a single model call', (t) => {
    const { convo, session, client, published, said } = buildConvo(t);
    convo.open(session);

    const opening = published.find((m) => m.t === 'opening');
    assert.ok(opening, 'the learner has to be asked what they want to talk about');
    assert.equal(opening.prompt.en, CONVO_LINES.opener.en);
    assert.deepEqual(said, [CONVO_LINES.opener.en], 'and asked out loud, in English — a new learner has no French yet');
    assert.equal(client.turnRequests.length + client.frameRequests.length, 0, 'nothing cost a round-trip');
  });

  test('a remembered opener is spoken in its English too', (t) => {
    const profile = createProfile();
    profile.memory.opener = { fr: 'Alors, cet entretien ?', en: 'So, how did that interview go?' };
    const client = new MockLlmClient();
    const convo = new ParleConversation(profile, { client });
    const { session, said } = stubSession();
    Object.defineProperty(convo, 'session', { value: session, configurable: true });
    const published: ServerMessage[] = [];
    convo.attach((message) => published.push(message));
    t.after(() => convo.clearRescue());

    convo.open(session);

    const opening = published.find((m) => m.t === 'opening');
    assert.ok(opening);
    assert.equal(opening.prompt.fr, 'Alors, cet entretien ?', 'the French rides along for the screen');
    assert.deepEqual(said, ['So, how did that interview go?']);
  });

  test('ready during the choosing moment replays the opening question', async (t) => {
    const { convo, session, published } = buildConvo(t);
    convo.open(session);
    await convo.handleClientMessage(session, tapped({ t: 'ready' }));

    assert.equal(published.filter((m) => m.t === 'opening').length, 2, 'a reconnecting app gets the question again');
  });

  test('help before the scene gets the spoken suggestion, in English', async (t) => {
    const { convo, session, said, published } = buildConvo(t);
    convo.open(session);
    await convo.handleClientMessage(session, tapped({ t: 'help' }));

    assert.ok(said.includes(CONVO_LINES.suggest.en), 'the suggestion is said out loud');
    assert.equal(published.filter((m) => m.t === 'opening').length, 2, 'and the question lands again with it');
  });

  test('text mode never fills the topic box with an AI suggestion', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { convo, session, said, published, client } = buildConvo(t, { voiceless: true });
    convo.open(session);

    t.mock.timers.tick(60_000);
    await convo.settled();

    assert.deepEqual(said, [], 'nothing is spoken in the quiet twin');
    assert.equal(published.filter((m) => m.t === 'opening').length, 1, 'the question is not republished as a prompt');
    assert.equal(client.frameRequests.length, 0, 'the AI invents no topic on the learner’s behalf');
  });

  test('choosing a topic opens a scene the learner can see and hear', async (t) => {
    const { client, published, said } = await inScene(t);

    assert.equal(client.frameRequests.length, 1, 'the scene was designed for what they asked for');
    const opened = views(published);
    assert.equal(opened.length, 1, 'the opening view lands before anyone has spoken');
    assert.equal(opened[0]!.view.beat.position, 1);
    // The bridge line is spoken from cache before the scene is designed, so
    // nobody sits in silence while the builder thinks.
    assert.ok(said.includes(CONVO_LINES.bridge.spoken), 'the bridge line lands the moment the topic does');
    assert.ok(said.indexOf(CONVO_LINES.bridge.spoken) < said.indexOf(CAFE_FRAME.openingLine.fr), 'and lands first');
    assert.ok(said.includes(CAFE_FRAME.openingLine.fr), 'and then the character speaks, before the learner has to');
    assert.equal(client.turnRequests.length, 0, 'opening a scene is not a turn');
  });
});

// ─────────────────────────────────── a conversation that already has a topic

/** The topic card's own title, exactly as the learner read it before tapping. */
const SEED = { fr: 'Commander un café', en: 'Ordering coffee' };

/**
 * Let the seeded scene finish opening. The mock brain answers with no I/O, so
 * everything between open() and the first view settles inside a few turns of
 * the microtask queue; setImmediate lands after all of them.
 */
async function sceneSettled(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

/** A brain that cannot design a scene. The request-grounded fallback is what is left. */
class NoFrameBrain extends MockLlmClient {
  override async frame(): Promise<never> {
    throw new BrainParseError('the scenario came back unreadable', '{}');
  }
}

/**
 * A brain that takes its time, the way a command-line call does — eight to
 * twelve seconds against a sub-second budget. `release` is a latch rather than
 * a one-shot: a test that only releases once must not deadlock on the second
 * call, or the failure it is looking for shows up as a hang instead of a red.
 */
class SlowBrain extends MockLlmClient {
  private released = false;
  private readonly waiting: (() => void)[] = [];
  private askedNow: (() => void) | null = null;
  /** Settles once the brain has been handed something to think about. */
  readonly asked: Promise<void> = new Promise<void>((resolve) => {
    this.askedNow = resolve;
  });

  override async turn(request: BrainTurnRequest) {
    this.askedNow?.();
    if (!this.released) await new Promise<void>((resolve) => void this.waiting.push(resolve));
    return super.turn(request);
  }

  release(): void {
    this.released = true;
    for (const wake of this.waiting.splice(0)) wake();
  }
}

/** The same, for the scenario builder: the scene the learner is waiting on. */
class SlowFrameBrain extends MockLlmClient {
  private released = false;
  private readonly waiting: (() => void)[] = [];

  override async frame(request: BrainFrameRequest) {
    if (!this.released) await new Promise<void>((resolve) => void this.waiting.push(resolve));
    return super.frame(request);
  }

  release(): void {
    this.released = true;
    for (const wake of this.waiting.splice(0)) wake();
  }
}

/** Point TUTOR_LLM somewhere for one test, and put back whatever was there. */
function withBrainEnv(t: TestContext, value: string): void {
  const saved = process.env.TUTOR_LLM;
  process.env.TUTOR_LLM = value;
  t.after(() => {
    if (saved === undefined) delete process.env.TUTOR_LLM;
    else process.env.TUTOR_LLM = saved;
  });
}

/**
 * A frame whose beats never arrived. The builder answered, so buildFrame's own
 * catch never sees it: what falls over is the tail that opens the scene. That
 * is the wedge behind "I typed it and nothing happened" — the session moved to
 * `starting`, stayed there, and dropped every later press without a word.
 */
const BEATLESS_FRAME = { ...CAFE_FRAME, beats: [] };

describe('a conversation started from a topic card', () => {
  test('a session started from a topic card opens its scene on that topic without the choosing question', async (t) => {
    const { convo, session, client, published, said } = buildConvo(t, { seedTopic: SEED });

    convo.open(session);
    await sceneSettled();

    const opening = published.find((m) => m.t === 'opening');
    assert.ok(opening, 'the app opens a conversation on the opening message and would wait forever without one');
    assert.notEqual(opening.prompt.en, CONVO_LINES.opener.en, 'someone who just tapped the topic is not asked to name it again');
    assert.ok(opening.prompt.en.includes(SEED.en), `the opening names the topic they tapped: "${opening.prompt.en}"`);
    assert.ok(opening.prompt.fr.includes(SEED.fr), `and names it in French too: "${opening.prompt.fr}"`);
    assert.ok(!opening.prompt.en.includes('?'), 'and says what is about to happen rather than asking');
    assert.equal(published.filter((m) => m.t === 'opening').length, 1, 'one opening, not the seeded one on top of the question');

    assert.equal(client.frameRequests.length, 1, 'the scene was designed straight away, with nothing to wait for');
    assert.ok(client.frameRequests[0]!.request.includes(SEED.en), 'and designed around the topic, not around a guess');

    const opened = views(published);
    assert.equal(opened.length, 1, 'the scene opened');
    assert.equal(opened[0]!.view.beat.position, 1);
    assert.ok(said.includes(seededOpening(SEED).en), 'the seeded opening is spoken, in English, before anything happens');
    assert.ok(said.includes(CONVO_LINES.bridge.spoken), 'the bridge line still covers the wait for the builder');
    assert.ok(said.indexOf(seededOpening(SEED).en) < said.indexOf(CONVO_LINES.bridge.spoken), 'in that order');
    assert.ok(said.includes(CAFE_FRAME.openingLine.fr), 'and the character speaks first, before the learner has to');
    assert.equal(client.turnRequests.length, 0, 'opening a seeded scene is still not a turn');
  });

  test('a seeded session whose scenario build fails stays on the topic it was given', async (t) => {
    const { convo, session, published, said } = buildConvo(t, { seedTopic: SEED, client: new NoFrameBrain() });

    convo.open(session);
    await sceneSettled();

    const opened = views(published);
    assert.equal(opened.length, 1, 'a builder that cannot answer must not leave the learner on an empty screen');
    assert.equal(convo.conversationState.frame.titleEn, SEED.en, 'the fallback carries the requested topic instead');
    assert.ok(!convo.conversationState.frame.setting.toLowerCase().includes('café'), 'no unrelated café fixture leaked in');
    assert.ok(said.includes(convo.conversationState.frame.openingLine.fr), 'and the fallback character still speaks first');
    assert.ok(said.includes(seededOpening(SEED).en), 'the tutor still said what was about to happen');
    assert.ok(
      published.some((m) => m.t === 'error' && m.message.includes('kept your topic')),
      'the simpler scene is disclosed rather than pretending the custom build succeeded',
    );
  });

  test('a seeded conversation opens the same way for a learner who is typing', async (t) => {
    const { convo, session, published, said } = buildConvo(t, { seedTopic: SEED, voiceless: true });

    convo.open(session);
    await sceneSettled();

    const opening = published.find((m) => m.t === 'opening');
    assert.ok(opening, 'the quiet twin reads the opening it would otherwise have heard');
    assert.equal(opening.prompt.en, seededOpening(SEED).en);
    assert.equal(views(published).length, 1, 'and lands in the same scene');
    assert.deepEqual(said, [], 'with nothing spoken aloud at all');
  });

  test('a topic that arrives malformed leaves the learner with the ordinary question', async (t) => {
    // Signed is not sane: the metadata is the server's, but the shape inside it
    // came from the app, and a seed with nothing in it would put the topic's
    // name in the tutor's mouth as an empty string.
    for (const bad of [{ fr: 'Commander un café' }, { fr: 'x', en: '   ' }, { fr: 'x', en: 'y'.repeat(121) }, 'coffee', null]) {
      const { convo, session, client, published } = buildConvo(t, { seedTopic: bad });
      convo.open(session);
      await sceneSettled();

      const opening = published.find((m) => m.t === 'opening');
      assert.ok(opening, `a bad seed must still open the session: ${JSON.stringify(bad)}`);
      assert.equal(opening.prompt.en, CONVO_LINES.opener.en, 'on the ordinary question, which is what a generic session is');
      assert.equal(client.frameRequests.length, 0, 'and no scene is designed until the learner says what they want');
    }
  });

  test('a reconnecting app is given the opening again while the scene is still being built', async (t) => {
    // A seeded session spends its whole pre-scene life building, so a `ready`
    // that arrives in that window used to be answered with nothing at all —
    // and `ready` is exactly what an app sends when it fears it missed the
    // moment.
    const { convo, session, published } = buildConvo(t, { seedTopic: SEED });
    convo.open(session);
    await convo.handleClientMessage(session, tapped({ t: 'ready' }));

    assert.equal(published.filter((m) => m.t === 'opening').length, 2, 'the opening it may have missed lands again');
    await sceneSettled();
  });

  test('the seeded opening obeys the learner-copy rules', () => {
    const seeded = seededOpening({ fr: 'Commander un café', en: 'Ordering coffee' });
    for (const text of [seeded.fr, seeded.en]) {
      assert.ok(!text.includes('—'), `em dash in "${text}"`);
      assert.ok(!/\d/.test(text), `digit in "${text}"`);
      assert.ok(!/wrong|incorrect|failed|bad/i.test(text), `scold in "${text}"`);
      assert.ok(text.length < 80, `too long to be a warm opener: "${text}"`);
    }
    assert.equal(
      seededOpening({ fr: 'Commander un café.', en: 'Ordering coffee.' }).en,
      seeded.en,
      'a title that already ends in a full stop does not get a second one',
    );
  });
});

describe('a scene that fails to open hands back the choosing moment', () => {
  test('a failed scene build returns the learner to choosing instead of a dead session', async (t) => {
    const client = new MockLlmClient({ frames: [BEATLESS_FRAME] });
    const { convo, session, published } = buildConvo(t, { client });
    convo.open(session);

    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Une soirée à Lyon' }));

    assert.equal(views(published).length, 0, 'half a scene is never published');
    assert.equal(
      published.filter((m) => m.t === 'opening').length,
      2,
      'the learner is handed the question again rather than a screen that never changes',
    );
    assert.equal(convo.conversationState.finished, false, 'and the session is still theirs to use');
  });

  test('pressing send again after a failed build starts a fresh scene', async (t) => {
    // The natural answer to a screen that did not move is to press Send again.
    // That press used to be dropped, silently, for the rest of the session.
    const client = new MockLlmClient({ frames: [BEATLESS_FRAME, APERO_FRAME] });
    const { convo, session, published } = buildConvo(t, { client });
    convo.open(session);

    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Une soirée à Lyon' }));
    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Une soirée à Lyon' }));

    assert.equal(client.frameRequests.length, 2, 'the second press was heard, not swallowed');
    assert.equal(views(published).length, 1, 'and a scene opened on it');
    assert.equal(convo.conversationState.frame.title, APERO_FRAME.title);
  });

  test('a seeded session whose scene falls over is asked the ordinary question instead', async (t) => {
    // A session from a topic card opens on a statement, not a question, so
    // handing that back would promise the same scene twice over. The learner
    // needs something they can answer.
    const client = new MockLlmClient({ frames: [BEATLESS_FRAME] });
    const { convo, session, published, said } = buildConvo(t, { client, seedTopic: SEED });

    convo.open(session);
    await sceneSettled();

    const openings = published.filter((m) => m.t === 'opening');
    assert.equal(openings.length, 2, 'the seeded opening, and then the way forward');
    assert.equal(openings[1]!.prompt.en, CONVO_LINES.opener.en, 'which is a question, and answerable');
    assert.ok(said.includes(CONVO_LINES.opener.en), 'and it is asked out loud, like every other choosing moment');
    assert.equal(views(published).length, 0, 'with no half-opened scene underneath it');
  });

  test('a second press while the scene is still coming leaves a trace instead of vanishing', async (t) => {
    // A duplicate press during a healthy build stays dropped — the scene is
    // seconds away and two would open on top of each other — but a drop nobody
    // can see is how this took a week to find.
    const client = new SlowFrameBrain();
    const { convo, session, published } = buildConvo(t, { client });
    convo.open(session);

    const first = convo.handleClientMessage(session, tapped({ t: 'say', text: 'Une soirée à Lyon' }));
    await sceneSettled();

    const noted = t.mock.method(console, 'warn', () => {});
    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Une soirée à Lyon' }));
    assert.equal(noted.mock.callCount(), 1, 'the dropped press is on the terminal');

    client.release();
    await first;
    await sceneSettled();
    assert.equal(client.frameRequests.length, 1, 'the scene already coming is the one that opens');
    assert.equal(views(published).length, 1, 'exactly one scene, not two');
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

  test('a slow brain turn is not mistaken for a stuck learner', async (t) => {
    // The queue bumps its generation when work is ENQUEUED, so a clock armed
    // after the learner's turn was queued captures a generation that already
    // counts it, passes runIfCurrent, and rescues them for the tutor's own
    // thinking time. Groq's sub-second turns hid this; a brain that takes eight
    // to twelve seconds hits it on every single turn.
    const client = new SlowBrain();
    const { convo, session } = await inScene(t, { client });

    const spoken = assert.rejects(
      () => convo.onUserTurnCompleted({} as never, heard('Bonjour, un café')),
      voice.StopResponse,
    );
    await client.asked; // the brain has the question and is writing

    const generation = convo.armRescue(session);
    const rescued = convo.runRescue(generation);
    client.release();
    await Promise.all([spoken, rescued]);
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 0, 'waiting for the tutor is not being stuck');
    assert.equal(client.turnRequests.length, 1, 'and the tutor is not asked to step in over its own answer');
    assert.equal(convo.conversationState.turnCount, 1, 'one answer, one turn of the scene');
  });

  test('the clock starts again once the slow turn has been answered', async (t) => {
    // Standing down must not stand down for good. A learner who freezes after a
    // slow reply is still a learner who gets handed the line.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const client = new SlowBrain();
    const { convo, session } = await inScene(t, { client, voiceless: true });

    const typed = convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour, un café' }));
    await client.asked;
    client.release();
    await typed;
    await convo.settled();

    t.mock.timers.tick(12_001);
    await convo.settled();
    assert.equal(convo.conversationState.ladder.rescues, 1, 'the clock the slow turn stood down is running again');
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
    assert.equal(instant.supportView.kind, 'hint', 'and they get a small intent hint, never the answer on the first rescue');
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

  test('hear it never replays the scene’s own line back as the learner’s', async (t) => {
    // The live defect at the edge that speaks. The model let one line do both
    // jobs: Karim's question, handed back as the line to say. The brain empties
    // a full line it cannot vouch for, so there is nothing here to replay, and
    // saying Karim's question would put back exactly what the brain took out.
    const asked = 'Vous le voulez chaud ou froid ?';
    const collapsed = sampleTurn({
      sceneReply: { speaker: 'Karim', fr: asked, frWritten: null, en: 'Do you want it hot or cold?' },
      support: {
        fullLine: { fr: asked, frWritten: null, en: 'Do you want it hot or cold?' },
        options: [{ fr: asked, en: 'Do you want it hot or cold?' }],
        hintEn: 'Say whether you want it hot or cold.',
      },
    });
    const { convo, session, said } = await inScene(t, { client: new MockLlmClient({ turns: [collapsed] }) });

    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Un café' }));
    await convo.settled();
    assert.notEqual(convo.conversationState.lastSupport.fullLine.fr, asked, 'the brain must not keep it either');

    const before = said.length;
    await convo.handleClientMessage(session, tapped({ t: 'hear' }));
    assert.deepEqual(said.slice(before), [], 'nothing to replay is silence, never an empty utterance');
  });
});

describe('typing is presence, not silence', () => {
  test('the stuck clock stands down while the learner is typing and restarts when they stop', async (t) => {
    // Measured live: `1 turns, 4 rescues, 105s`. A learner typing one answer was
    // rescued about every twenty seconds, because typing counted as silence —
    // and being told to say it once more mid-sentence is a remark on hesitating.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { convo, session, client, published } = await inScene(t, { voiceless: true });
    const opened = views(published).length;

    for (let i = 0; i < 4; i += 1) {
      t.mock.timers.tick(8_000);
      await convo.handleClientMessage(session, tapped({ t: 'typing' }));
    }
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 0, 'somebody who is typing is not stuck');
    assert.equal(client.turnRequests.length, 0, 'the tutor never steps in over a sentence being written');
    assert.equal(views(published).length, opened, 'and nothing was pushed at them while they wrote');

    // They stop. The clock is a clock again, from the last keystroke.
    t.mock.timers.tick(12_001);
    await convo.settled();
    assert.equal(convo.conversationState.ladder.rescues, 1, 'a learner who really froze is still handed the line');
  });

  test('a keystroke never starts a clock that was not already running', async (t) => {
    // The ping is presence, not policy: armRescue owns when the clock runs, and
    // a keystroke while the tutor is still speaking must not start one.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { convo, session } = await inScene(t);

    await convo.handleClientMessage(session, tapped({ t: 'typing' }));
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 0, 'nothing was counting, so nothing fired');
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

  test('a brain turn that never answers hands back the recovery line instead of hanging', async (t) => {
    // buildFrame races a deadline and has a fixture to fall back on. A turn
    // raced nothing at all, so a call that went out and never came back was a
    // learner sitting in front of their own sentence with no reply and no clock
    // — the queue reports itself busy for as long as the turn is in flight, and
    // a busy queue is exactly when the rescue stands down.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    withBrainEnv(t, 'anthropic');
    const client = new SlowBrain();
    const { convo, session, published, said } = await inScene(t, { client, voiceless: true });

    const typed = convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour, un café' }));
    await client.asked; // the call went out, and this one is never coming back

    t.mock.timers.tick(15_001);
    await sceneSettled();

    // Asserted before the turn is awaited on purpose: with nothing racing the
    // call, awaiting it never returns, and a test that hangs says nothing.
    const notice = published.find((m) => m.t === 'error');
    assert.ok(notice, 'the learner is told the tutor could not answer, rather than left guessing');
    assert.equal(notice.message, RECOVERY_LINE, 'in the same words a throw would have produced');
    assert.equal(convo.conversationState.turnCount, 0, 'and a turn that never happened is not recorded');
    assert.deepEqual(said, [], 'still nothing aloud, for a learner in a quiet carriage');
    await typed;
    await convo.settled();

    // The queue came unbusy on its own — the settled work decrements whether it
    // resolved or threw — so the clock the hung turn stood down is running.
    // Settled by hand rather than through the queue: the rescue's own model call
    // goes to the same brain that is still not answering, and the ladder moves
    // and the support renders before it, which is the whole point of a rescue.
    t.mock.timers.tick(12_001);
    await sceneSettled();
    assert.equal(convo.conversationState.ladder.rescues, 1, 'and a learner nobody answered is handed the line');
    assert.equal(views(published).length, 2, 'with the line rendered from material already in hand');
  });

  test('a hung turn leaves the conversation usable rather than wedged', async (t) => {
    // Never strand them mid-scene: the turn that hung is lost, and the next
    // thing they type has to be served like any other.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    withBrainEnv(t, 'anthropic');
    const client = new SlowBrain();
    const { convo, session } = await inScene(t, { client, voiceless: true });

    const hung = convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour, un café' }));
    await client.asked;
    t.mock.timers.tick(15_001);
    await sceneSettled();

    client.release(); // whatever was wrong with the brain has passed
    const next = convo.handleClientMessage(session, tapped({ t: 'say', text: 'Un café, s’il vous plaît' }));
    await sceneSettled();

    assert.equal(convo.conversationState.turnCount, 1, 'their next sentence was answered');
    assert.equal(convo.conversationState.finished, false, 'and one hung call is not a dead session');
    await Promise.all([hung, next]);
  });

  test('the subscription gets longer to answer a turn before it is called hung', async (t) => {
    // Eight to twelve seconds is what a command-line call costs when it is
    // working perfectly. A deadline that fires at fifteen would end every single
    // turn of a claude-cli-all session on the recovery line.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    withBrainEnv(t, 'claude-cli-all');
    const client = new SlowBrain();
    const { convo, session, published } = await inScene(t, { client, voiceless: true });

    const typed = convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour, un café' }));
    await client.asked;

    t.mock.timers.tick(15_001);
    await sceneSettled();
    assert.equal(published.filter((m) => m.t === 'error').length, 0, 'a slow subscription is still answering');

    t.mock.timers.tick(30_000);
    await sceneSettled();
    assert.equal(published.filter((m) => m.t === 'error').length, 1, 'but a call that long has hung, and is treated as one');
    await typed;
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
    // Asserted as a view that ARRIVED after the failure, not merely the opening.
    assert.equal(views(published).length, 2, 'the opening view, then the rescue that answered the silence');
    const rescued = views(published)[1]!.view;
    assert.deepEqual(rescued.sceneReply, views(published)[0]!.view.sceneReply, 'and it holds the moment they froze on');
    assert.equal(rescued.supportView.kind, 'hint', 'with an instant hint, but no answer handed over');
  });
});

describe('a client message that fails does not take the worker with it', () => {
  test('a client message whose handling fails is contained and logged instead of rejecting unhandled', async (t) => {
    const { convo, session } = await inScene(t);

    // The worker fires these off with `void`, so one throw here is an unhandled
    // rejection on a process serving every learner on it. A room that closed
    // under a replay is enough to cause one.
    const logged = t.mock.method(console, 'error', () => {});
    Object.defineProperty(convo, 'session', {
      value: {
        say() {
          throw new Error('the room closed under the reply');
        },
      },
      configurable: true,
    });

    await assert.doesNotReject(() => convo.handleClientMessage(session, tapped({ t: 'english' })));
    assert.equal(logged.mock.callCount(), 1, 'and the failure reaches the terminal rather than nowhere');

    Object.defineProperty(convo, 'session', { value: stubSession().session, configurable: true });
    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour' }));
    await convo.settled();
    assert.equal(convo.conversationState.turnCount, 1, 'and the learner is still in their conversation');
  });
});

describe('what a finished session leaves behind', () => {
  const keepable = (fr: string, en: string): NewPhrase => ({
    fr,
    frWritten: null,
    en,
    enLiteral: null,
    register: 'familier',
    note: null,
  });

  /** One spoken turn whose reply closes the scene, then room for the post-session pipeline. */
  async function finishSessionWith(t: TestContext, client: MockLlmClient) {
    const built = await inScene(t, { client });
    await assert.rejects(() => built.convo.onUserTurnCompleted({} as never, heard('Bonjour, un café')), voice.StopResponse);
    await built.convo.settled();
    // The post-session pipeline is fire-and-forget; let its promise chain drain.
    for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
    return built;
  }

  const closingTurn = () =>
    sampleTurn({
      newPhrases: [keepable('Ça marche', 'coming up'), keepable('Autre chose', 'something else')],
      scene: { beat: 'greet', beatDone: true, sceneDone: true },
    });

  test('exactly one practice message ships, after the recap, grouped as curated', async (t) => {
    const client = new MockLlmClient({
      turns: [closingTurn()],
      curations: [
        { topics: [{ titleEn: 'Ordering at the café', titleFr: 'Au café', phraseFr: ['Ça marche'], extensions: [] }] },
      ],
    });
    const { published } = await finishSessionWith(t, client);

    const practice = published.filter((m) => m.t === 'practice');
    assert.equal(practice.length, 1, 'exactly one practice message per session');
    assert.ok(
      published.findIndex((m) => m.t === 'recap') < published.indexOf(practice[0]!),
      'the recap ships before the practice',
    );
    assert.equal(practice[0]!.topics.length, 1);
    assert.equal(practice[0]!.topics[0]!.titleEn, 'Ordering at the café');
    assert.deepEqual(
      practice[0]!.topics[0]!.phrases.map((p) => p.fr),
      ['Ça marche'],
      'only the kept phrase becomes practice',
    );
  });

  test('drills are authored from the curated keep-list, not everything said', async (t) => {
    const client = new MockLlmClient({
      turns: [closingTurn()],
      curations: [
        { topics: [{ titleEn: 'Ordering at the café', titleFr: 'Au café', phraseFr: ['Ça marche'], extensions: [] }] },
      ],
    });
    await finishSessionWith(t, client);

    assert.equal(client.curateRequests.length, 1, 'the practice editor was asked once');
    assert.equal(client.drillsRequests.length, 1, 'then the drill author, once');
    const request = client.drillsRequests[0]!.request;
    // The dropped phrase may still ride the "unmastered from before" section —
    // the turn already folded it into the profile, and that list is the
    // profile's business. The session keep-list is what curation governs.
    const todayStart = request.indexOf("Today's phrases:");
    assert.ok(todayStart >= 0, 'the briefing carries a session section');
    const profileStart = request.indexOf('Still unmastered from before:');
    const today = profileStart >= 0 ? request.slice(todayStart, profileStart) : request.slice(todayStart);
    assert.ok(today.includes('Ça marche'), 'the kept phrase rides the keep-list');
    assert.ok(!today.includes('Autre chose'), 'the dropped phrase does not');
  });

  test('a curation failure still ships practice: the code fallback, frame-titled', async (t) => {
    class NoCuration extends MockLlmClient {
      override async curate(): Promise<never> {
        throw new Error('curation outage');
      }
    }
    const client = new NoCuration({ turns: [closingTurn()] });
    const { published } = await finishSessionWith(t, client);

    const practice = published.find((m) => m.t === 'practice');
    assert.ok(practice, 'the fallback shipped anyway');
    assert.equal(practice.topics[0]!.titleEn, CAFE_FRAME.titleEn, 'titled by the scene itself');
    assert.deepEqual(
      practice.topics[0]!.phrases.map((p) => p.fr),
      ['Ça marche', 'Autre chose'],
      'the first phrases met, in order',
    );
  });

  test('a post-session brain failure costs quality, not the session', async (t) => {
    // This became load-bearing when the brain gained a subscription path. An
    // API key either works or is absent; a CLI login quietly expires, and it
    // expires on exactly the three calls that run after the learner has stopped
    // watching. The session they just had must survive all three going down.
    class DeadBrain extends MockLlmClient {
      override async extract(): Promise<never> {
        throw new Error('claude: Invalid API key · Please run /login');
      }
      override async curate(): Promise<never> {
        throw new Error('claude: Invalid API key · Please run /login');
      }
      override async drills(): Promise<never> {
        throw new Error('claude: Invalid API key · Please run /login');
      }
    }
    const { published } = await finishSessionWith(t, new DeadBrain({ turns: [closingTurn()] }));

    const recap = published.find((m) => m.t === 'recap');
    assert.ok(recap, 'the recap shipped, because it is assembled in code and does not need the model at all');
    assert.ok(recap.recap.stats.turns > 0, 'and it carries the session that actually happened');
    assert.deepEqual(
      recap.recap.phrases.map((p) => p.fr),
      ['Ça marche', 'Autre chose'],
      'with every phrase the learner met',
    );

    const practice = published.find((m) => m.t === 'practice');
    assert.ok(practice, 'practice still ships, on the deterministic fallback');
    assert.equal(practice.topics[0]!.titleEn, CAFE_FRAME.titleEn, 'titled by the scene, since nothing curated it');
  });
});

describe('which brain the env selects', () => {
  test('switching to the anthropic key needs no code change', () => {
    // The promise made to anyone testing on a subscription first: when you are
    // ready to buy a key, you change one line of .env. If this ever needs a
    // second edit somewhere, that promise was wrong and this test is where it
    // should break.
    const onSubscription = brainClient({ TUTOR_LLM: 'claude-cli', GROQ_API_KEY: 'gq' });
    assert.ok(onSubscription instanceof SplitBrainClient, 'a subscription splits fast and considered work');

    const onApiKey = brainClient({ TUTOR_LLM: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' });
    assert.ok(onApiKey instanceof AnthropicBrainClient, 'and TUTOR_LLM alone moves the whole brain onto the API');
  });

  test('claude-cli-all sends every call, turns included, to the subscription', () => {
    // The founder's ask, in their words: "Can you not use Claude Subscription
    // for now for development stage". claude-cli keeps realtime turns on Groq,
    // which is the free tier that rate-limited them eight times in one session.
    const whole = brainClient({ TUTOR_LLM: 'claude-cli-all' });
    assert.ok(whole instanceof ClaudeCliBrainClient, 'every call goes to the command line');
    assert.ok(!(whole instanceof SplitBrainClient), 'with nothing at all left on the fast tier');
  });

  test('an unset TUTOR_LLM still means anthropic, and an empty one is not a third thing', () => {
    assert.ok(brainClient({ ANTHROPIC_API_KEY: 'k' }) instanceof AnthropicBrainClient);
    assert.ok(brainClient({ TUTOR_LLM: '  ', ANTHROPIC_API_KEY: 'k' }) instanceof AnthropicBrainClient);
  });

  test('groq stays exactly what it was', () => {
    assert.ok(brainClient({ TUTOR_LLM: 'groq', GROQ_API_KEY: 'gq' }) instanceof OpenAiCompatBrainClient);
  });

  test('OpenAI uses the Responses client with the normal OpenAI key', () => {
    assert.ok(
      brainClient({ TUTOR_LLM: 'openai', OPENAI_API_KEY: 'sk-test' }) instanceof OpenAiResponsesBrainClient,
    );
  });
});

describe('latency marks', () => {
  test('a spoken turn marks brainSent, brainParsed, then sayCalled, in that order', async (t) => {
    const built = await inScene(t);
    const stages: string[] = [];
    built.convo.attachTiming((stage) => stages.push(stage));

    await assert.rejects(() => built.convo.onUserTurnCompleted({} as never, heard('Bonjour, un café')), voice.StopResponse);
    await built.convo.settled();

    assert.deepEqual(stages, ['brainSent', 'brainParsed', 'sayCalled']);
  });
});


describe('what language the recogniser is listening for', () => {
  test('the choosing moment listens in multilingual mode and the scene listens in French', () => {
    // The opener is asked in English, so the answer arrives in English. Pinned
    // to French, Deepgram returned nonsense for the one turn that decides what
    // the whole session will be about.
    assert.equal(sttLanguageFor('convo', 'choosing'), 'multi');
    assert.equal(sttLanguageFor('convo', 'starting'), 'multi', 'still English while the scene is being built');
    assert.equal(sttLanguageFor('convo', 'scene'), 'fr', 'and French from the scene onward');
  });

  test('the scripted lesson listens in French from its first word', () => {
    // It never opens in English, so there is no window to widen and widening it
    // would only cost accuracy on the mangled French it exists to hear.
    for (const phase of ['choosing', 'starting', 'scene'] as const) {
      assert.equal(sttLanguageFor('lesson', phase), 'fr');
    }
  });

  test('opening the scene returns the recogniser to French', async (t) => {
    const { sttLanguages } = await inScene(t);
    assert.deepEqual(sttLanguages, ['fr'], 'retuned exactly once, when the scene opened');
  });

  test('a learner still choosing has not been retuned yet', (t) => {
    const built = buildConvo(t);
    built.convo.open(built.session);
    assert.deepEqual(built.sttLanguages, [], 'the opening question is still English, so nothing has moved');
  });
});

describe('how long the scene builder gets before a request-grounded scene opens instead', () => {
  test('an ordinary brain that goes quiet still opens on the learner request at ten seconds', async (t) => {
    withBrainEnv(t, 'anthropic');
    const client = new SlowFrameBrain();
    const built = buildConvo(t, { client });
    t.mock.timers.enable({ apis: ['setTimeout'] });

    built.convo.open(built.session);
    const started = built.convo.handleClientMessage(built.session, tapped({ t: 'say', text: 'Une soirée à Lyon' }));
    await sceneSettled();
    t.mock.timers.tick(10_001);
    await started;

    assert.equal(views(built.published).length, 1, 'a learner is never left watching a builder think');
    assert.equal(
      built.convo.conversationState.frame.titleEn,
      'Une soirée à Lyon',
      'the fallback keeps the request instead of opening the café fixture',
    );
    assert.ok(!built.convo.conversationState.frame.setting.toLowerCase().includes('café'));
    client.release();
  });

  test('the scene builder gets a longer deadline when the subscription is the whole brain', async (t) => {
    assert.equal(frameDeadlineMs({}), 10_000, 'an API brain answers in seconds, and the learner is listening');
    assert.equal(
      frameDeadlineMs({ TUTOR_LLM: 'openai' }),
      25_000,
      'measured Luna scenes get enough room to finish instead of losing to the ten-second fallback',
    );
    assert.equal(frameDeadlineMs({ TUTOR_LLM: 'claude-cli-all' }), 30_000, 'a command-line call takes eight to twelve');

    // And it is the deadline the builder actually races. At ten seconds a
    // recovery scene used to open over the top of the healthy custom scene;
    // the wider deadline lets the requested rich scene win instead.
    withBrainEnv(t, 'claude-cli-all');
    const client = new SlowFrameBrain({ frames: [APERO_FRAME] });
    const built = buildConvo(t, { client });
    t.mock.timers.enable({ apis: ['setTimeout'] });

    built.convo.open(built.session);
    const started = built.convo.handleClientMessage(built.session, tapped({ t: 'say', text: 'Une soirée à Lyon' }));
    await sceneSettled();
    t.mock.timers.tick(10_001);
    await sceneSettled();

    assert.equal(views(built.published).length, 0, 'the recovery scene does not open over what they asked for');

    client.release();
    await started;
    assert.equal(
      built.convo.conversationState.frame.title,
      APERO_FRAME.title,
      'the scene the builder designed is the one that opens',
    );
  });
});

describe('background enrichment deadlines', () => {
  test('OpenAI gets the measured window without changing other providers', () => {
    assert.equal(postSessionDeadlineMs('extract', {}), 8_000);
    assert.equal(postSessionDeadlineMs('curate', {}), 10_000);
    assert.equal(postSessionDeadlineMs('drills', {}), 25_000);
    assert.equal(postSessionDeadlineMs('extract', { TUTOR_LLM: 'openai' }), 30_000);
    assert.equal(postSessionDeadlineMs('curate', { TUTOR_LLM: 'openai' }), 30_000);
    assert.equal(postSessionDeadlineMs('drills', { TUTOR_LLM: 'openai' }), 90_000);
  });
});

/** A brain whose scenario call hangs until the test lets it finish. */
class HeldFrameBrain extends MockLlmClient {
  release!: () => void;
  private readonly gate: Promise<void>;
  constructor() {
    super();
    this.gate = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }
  override async frame(request: BrainFrameRequest) {
    await this.gate;
    return super.frame(request);
  }
}

describe('the tutor knows who it is talking to — G1', () => {
  test('the tutor greets the learner by name', (t) => {
    // Onboarding asks what they want to be called and the answer was dropped
    // at the first hop, so the tutor could not use a name it never had.
    const { convo, session, said, published } = buildConvo(t, { profile: withLearnerName(createProfile(), 'Sam') });
    convo.open(session);

    assert.equal(said.length, 1, 'the greeting is one utterance, not two speech handles');
    assert.match(said[0]!, /Sam/, `the learner was not greeted by name: "${said[0]}"`);
    assert.ok(
      said[0]!.includes(CONVO_LINES.opener.en),
      `the name replaced the question instead of leading it: "${said[0]}"`,
    );
    const opening = published.find((m) => m.t === 'opening');
    assert.ok(opening);
    assert.match(opening.prompt.en, /Sam/, 'the screen and the voice must agree');
  });

  test('a learner with no name still gets the ordinary opener', (t) => {
    const { convo, session, said } = buildConvo(t);
    convo.open(session);
    assert.deepEqual(said, [CONVO_LINES.opener.en]);
  });

  test('a remembered opener carries the name without being rewritten around it', (t) => {
    // Sessions two and up are greeted by a line the analyst wrote after the
    // last session, where nobody was waiting on it. Code must not staple a
    // second greeting onto the front of one that already greets.
    const profile = withLearnerName(createProfile(), 'Sam');
    profile.memory.opener = { fr: 'Alors Sam, cet entretien ?', en: 'So Sam, how did that interview go?' };
    const { convo, session, said } = buildConvo(t, { profile });
    convo.open(session);
    assert.deepEqual(said, ['So Sam, how did that interview go?']);
  });

  test('the name reaches the scene designer, who writes the first line the learner hears', async (t) => {
    const { client } = await inScene(t, { profile: withLearnerName(createProfile(), 'Sam') });
    assert.equal(client.frameRequests.length, 1);
    assert.match(client.frameRequests[0]!.request, /Sam/);
  });
});

describe('the wait for a scene — G3 and G4', () => {
  test('the bridge tells the learner in English that a scene is coming', async (t) => {
    // The scenario call runs ten to twenty five seconds and the only thing the
    // learner heard across it was "Ah, très bien. Alors…". The French stays; it
    // is lesson-zero vocabulary doing its job. What was missing was the line
    // saying what is happening.
    const { said } = await inScene(t);
    const bridge = said.find((line) => line.includes('très bien'));
    assert.ok(bridge, `the bridge line is gone: ${JSON.stringify(said)}`);
    assert.match(bridge, /setting the scene|moment/i, `the bridge still explains nothing: "${bridge}"`);
  });

  test('a topic that arrives during the scene build is still shown as heard', async (t) => {
    // The drop is right: answering would talk over the opening narration. The
    // silence was not. "I said it and nothing happened" is the natural reading
    // of a screen that does not change, so the learner says it again.
    const client = new HeldFrameBrain();
    const built = buildConvo(t, { client });
    built.convo.open(built.session);
    await built.convo.handleClientMessage(built.session, tapped({ t: 'say', text: 'Au café' }));

    await assert.rejects(
      () => built.convo.onUserTurnCompleted({} as never, heard('actually about the trees')),
      voice.StopResponse,
    );
    const transcripts = built.published.filter((m) => m.t === 'transcript');
    assert.ok(
      transcripts.some((m) => m.text === 'actually about the trees'),
      'the learner watched their own words vanish',
    );

    client.release();
    await new Promise((resolve) => setImmediate(resolve));
  });
});

describe('one turn, one utterance — H1', () => {
  function view(overrides: Partial<TurnView> = {}): TurnView {
    return {
      sceneReply: { speaker: 'Karim', fr: 'Ça marche, un café !', frWritten: null, en: 'Right, one coffee!' },
      coachLine: null,
      coachNow: [],
      narration: null,
      newPhrases: [],
      supportView: { kind: 'none' },
      rung: 4,
      rescued: false,
      advancedBeat: false,
      reachedForEnglish: false,
      beat: { goalEn: 'Order a drink', position: 1, total: 3 },
      recapDue: false,
      ...overrides,
    } as TurnView;
  }

  test('the spoken turn keeps narration, coaching and the scene reply in that order', () => {
    const text = spokenTurn(
      view({
        narration: { speaker: 'narration', fr: 'Le serveur part.', frWritten: null, en: 'The waiter leaves.' },
        coachLine: 'Got it, Sam. In French: "un café".',
      }),
    );
    assert.equal(text, 'The waiter leaves. Got it, Sam. In French: "un café". Ça marche, un café !');
  });

  test('a turn with nothing but a scene reply is spoken exactly as it was', () => {
    assert.equal(spokenTurn(view()), 'Ça marche, un café !');
  });

  test('every part is closed off, so a sentence already on disk keeps its cache key', () => {
    // The framework splits sentences inside one handle. A part that ran into
    // the next would make a new sentence, and a new key for warmed audio.
    const text = spokenTurn(view({ coachLine: 'Small fix: "à la boulangerie"' }));
    assert.ok(text.includes('"à la boulangerie". Ça marche'), text);
  });

  test('a blank coach line adds nothing, not a stray full stop', () => {
    assert.equal(spokenTurn(view({ coachLine: '   ' })), 'Ça marche, un café !');
  });

  test('a scene shift is uninterruptible even at a high rung', () => {
    const shift = view({
      rung: 4,
      narration: { speaker: 'narration', fr: 'Le serveur part.', frWritten: null, en: 'The waiter leaves.' },
    });
    assert.equal(turnIsUninterruptible(shift), true);
    assert.equal(turnIsUninterruptible(view({ rung: 4 })), false);
    assert.equal(turnIsUninterruptible(view({ rung: 2 })), true, 'a beginner still hears the line out');
  });

  test('one turn is spoken as a single utterance', async (t) => {
    // Three say() handles were three speaking/listening cycles, which split the
    // latency record, armed the rescue mid-answer and flickered the orb green
    // between the tutor's own sentences.
    const built = await inScene(t);
    const before = built.said.length;
    await assert.rejects(
      () => built.convo.onUserTurnCompleted({} as never, heard('Bonjour, un café')),
      voice.StopResponse,
    );
    assert.equal(built.said.length - before, 1, `the turn was spoken in pieces: ${JSON.stringify(built.said)}`);
  });
});

describe('the opener the learner actually hears is the one that was warmed', () => {
  /**
   * The trap this pins. `spokenTurn` and `openerFor` both rely on the framework
   * splitting one say() into sentences, and the splitter has a minimum sentence
   * length of twenty characters (@livekit/agents tokenize/basic). A greeting
   * shorter than that does not become its own sentence, it GLUES to the line
   * after it, and the pair takes a cache key the warm run has never seen.
   *
   * "Hi Sam." is eight characters. So the first thing every named learner heard,
   * every session, was a full cold vendor round trip, at the exact moment
   * someone is deciding whether this thing works, while the comment above
   * openerFor said the warm half streamed from disk. The code was wrong and the
   * record was worse.
   *
   * This walks the real tokenizer rather than counting characters, because the
   * floor is the framework's to move, not ours.
   */
  const tokenizer = new tokenize.basic.SentenceTokenizer();

  test('the greeting is its own sentence, so the question keeps its warmed key', () => {
    // One letter to nine: the fixed part of the greeting has to carry the
    // length, or a learner called Al pays for a learner called Alexandra.
    for (const name of ['A', 'Al', 'Sam', 'Alexandra']) {
      const chunks = tokenizer.tokenize(openerFor(name).en);
      assert.ok(
        chunks.includes(CONVO_LINES.opener.en),
        `for "${name}" the question lost its own cache key, so the warm run cannot reach it: ${JSON.stringify(chunks)}`,
      );
    }
  });

  test('an unnamed learner still gets exactly the warmed line', () => {
    assert.equal(openerFor(null).en, CONVO_LINES.opener.en);
    assert.deepEqual(tokenizer.tokenize(openerFor(null).en), [CONVO_LINES.opener.en]);
  });

  test('every sentence the warm script stores is a sentence the runtime asks for', () => {
    // The two splitters have to agree or the cache fills with entries nothing
    // requests. warmCache.ts uses this same tokenizer for exactly this reason.
    const spoken = openerFor('Sam').en;
    for (const chunk of tokenizer.tokenize(spoken)) {
      assert.deepEqual(tokenizer.tokenize(chunk), [chunk], `"${chunk}" splits further at synthesis time`);
    }
  });
});

// ─────────────────────────────────── missions: the scene that was already written

describe('a conversation started from a mission', () => {
  test('a mission session opens its scene with zero model calls', async (t) => {
    // The mechanism under the one-minute promise. A mission's frame is authored,
    // so there is nothing to design: no scenario call, no ten to twenty five
    // second wait, and no silent fall back to a café nobody asked for.
    const { convo, session, client, published, said, sttLanguages } = buildConvo(t, { missionId: 'mission:cafe' });

    convo.open(session);
    await sceneSettled();

    assert.equal(client.frameRequests.length, 0, 'the scene was written in advance, so nothing was designed on the fly');
    assert.equal(client.turnRequests.length, 0, 'and opening a scene is still not a turn');

    const opening = published.find((m) => m.t === 'opening');
    assert.ok(opening, 'the app opens a conversation on the opening message and would wait forever without one');
    assert.notEqual(opening.prompt.en, CONVO_LINES.opener.en, 'somebody who chose a mission is not asked to choose again');
    assert.equal(published.filter((m) => m.t === 'opening').length, 1, 'one opening, not the mission on top of the question');

    const opened = views(published);
    assert.equal(opened.length, 1, 'the scene is there already');
    assert.equal(opened[0]!.view.beat.position, 1, 'on the first beat of the mission');
    assert.equal(opened[0]!.view.missionDone, false, 'and nothing is won before the learner has said a word');

    assert.equal(convo.conversationState.frame.title, CAFE_FRAME.title, 'the scene is the authored mission, not a guess');
    assert.equal(convo.conversationState.mission, true, 'and the engine knows this session has something to finish');

    assert.ok(!said.includes(CONVO_LINES.bridge.spoken), 'nobody is asked to wait for a scene that is already written');
    assert.ok(said.includes(missionOpening(CAFE_FRAME).en), 'one short bridge line says what is about to happen');
    assert.ok(said.includes(CAFE_FRAME.openingLine.fr), 'and the character speaks first, before the learner has to');
    assert.deepEqual(sttLanguages, ['fr'], 'the recogniser is listening for French from the first word of the scene');
  });

  test('an unknown mission id opens the ordinary choosing question', async (t) => {
    // An app and an agent ship on different days, so an id this worker has never
    // heard of is normal. It degrades to exactly today's session — never a
    // throw, and never a café quietly substituted for the mission they picked.
    for (const bad of ['mission:nope', '__proto__', 'constructor', 'toString', '', '   ', 42, null, undefined]) {
      const { convo, session, client, published, said } = buildConvo(t, { missionId: bad });
      convo.open(session);
      await sceneSettled();

      const opening = published.find((m) => m.t === 'opening');
      assert.ok(opening, `an id this build does not know must still open the session: ${JSON.stringify(bad)}`);
      assert.equal(opening.prompt.en, CONVO_LINES.opener.en, 'on the ordinary question, which is what a generic session is');
      assert.equal(views(published).length, 0, 'no scene is substituted for the one that could not be found');
      assert.equal(client.frameRequests.length, 0, 'and nothing is designed until the learner says what they want');
      assert.deepEqual(said, [CONVO_LINES.opener.en], 'the question is asked out loud, in English, exactly as ever');
    }

    // The control: the degradation is a real branch, not a feature that is missing.
    const known = buildConvo(t, { missionId: 'mission:amis' });
    known.convo.open(known.session);
    await sceneSettled();
    assert.equal(views(known.published).length, 1, 'an id this build does know opens its scene instead');
    assert.equal(known.convo.conversationState.frame.title, APERO_FRAME.title);
  });

  test('a mission id that means nothing here is dropped rather than believed', () => {
    assert.equal(validMissionId('mission:cafe'), 'mission:cafe');
    assert.equal(validMissionId(' mission:cafe '), 'mission:cafe', 'a signed value is still trimmed on arrival');
    assert.equal(validMissionId('__proto__'), undefined, 'the prototype chain is not a mission');
    assert.equal(validMissionId('mission:nope'), undefined);
    assert.equal(validMissionId(7), undefined);
    assert.equal(validMissionId(null), undefined);
  });

  test('the mission opening obeys the learner-copy rules', () => {
    for (const frame of [CAFE_FRAME, APERO_FRAME]) {
      const opening = missionOpening(frame);
      for (const text of [opening.fr, opening.en]) {
        assert.ok(!text.includes('—'), `em dash in "${text}"`);
        assert.ok(!/\d/.test(text), `digit in "${text}"`);
        assert.ok(!/wrong|incorrect|failed|bad/i.test(text), `scold in "${text}"`);
        assert.ok(text.length < 80, `too long to be a warm opener: "${text}"`);
        assert.ok(!/\?\./.test(text), `a title that asks something must not gain a full stop: "${text}"`);
      }
    }
  });

  test('the win rides the turn that earned it, all the way to the wire', async (t) => {
    // missionDone is a field on the view, not a tag of its own, so it arrives in
    // the same message as the line it belongs to. Unmapped, it read as `false`
    // forever and the win could never be shown.
    const { convo, session, published } = buildConvo(t, { missionId: 'mission:cafe' });
    convo.open(session);
    await sceneSettled();
    await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Bonjour, un café' }));
    await convo.settled();

    for (const message of views(published)) {
      assert.equal(typeof message.view.missionDone, 'boolean', 'every published view says whether this turn was the win');
      overTheWire(message);
    }
  });
});

// ─────────────────────────────────── "give me a moment": presence, not failure

describe('give me a moment', () => {
  test('give me a moment defers the rescue clock and counts nothing against the learner', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { convo, session, client, published } = await inScene(t);
    const rung = convo.conversationState.ladder.rung;
    const opened = views(published).length;

    convo.armRescue(session); // the tutor has finished speaking; the clock is running
    await convo.handleClientMessage(session, tapped({ t: 'moment' }));

    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 0, 'a learner who asked for time has got nothing wrong');
    assert.equal(convo.conversationState.ladder.rung, rung, 'the ladder does not move because somebody tapped a button');
    assert.equal(convo.conversationState.turnCount, 0, 'and no turn of the scene was spent on it');
    assert.equal(client.turnRequests.length, 0, 'the tutor does not step in over somebody who asked to think');
    assert.equal(views(published).length, opened, 'nothing new was pushed at them');
  });

  test('a stray sound does not spend the time the learner asked for', async (t) => {
    // The defect this pins: the grace shares the one silence-clock handle, and
    // `agent.ts:250` re-arms that clock on every transition to `listening` while
    // `setLearnerSpeaking(true)` clears it. So a learner who tapped the control
    // and then shifted in their chair, or started a word and stopped, lost all
    // twenty seconds and was rescued four seconds later anyway — the control
    // doing nothing in the exact situation it exists for, with every test green,
    // because they all drove the conversation and never the pipeline.
    //
    // Driven here as the pipeline actually drives it, in order.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { convo, session, client, published } = await inScene(t);
    const opened = views(published).length;

    convo.armRescue(session);
    await convo.handleClientMessage(session, tapped({ t: 'moment' }));

    // A noise, not an answer: the floor is taken and handed straight back.
    convo.setLearnerSpeaking(true);
    convo.setLearnerSpeaking(false);
    convo.armRescue(session);

    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 0, 'a sound is not an answer, and it must not cost the learner their time');
    assert.equal(client.turnRequests.length, 0, 'the tutor still does not step in over somebody who asked to think');
    assert.equal(views(published).length, opened, 'and nothing was pushed at them');

    // The grace is still bounded. It ends on its own, and the ordinary clock
    // comes back, because a grace nobody could end would strand them instead.
    t.mock.timers.tick(MOMENT_GRACE_MS);
    await convo.settled();
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();
    assert.equal(convo.conversationState.ladder.rescues, 1, 'the time runs out eventually, and then help arrives');
  });

  test('after the grace the ordinary rescue policy resumes, so nobody is stranded', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { convo, session, published } = await inScene(t);

    convo.armRescue(session);
    await convo.handleClientMessage(session, tapped({ t: 'moment' }));

    t.mock.timers.tick(MOMENT_GRACE_MS);
    await convo.settled();
    assert.equal(convo.conversationState.ladder.rescues, 0, 'the grace is real for as long as it lasts');

    // And then it is over. The clock the tap deferred is a clock again.
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();

    assert.equal(convo.conversationState.ladder.rescues, 1, 'nobody is left in front of a scene with nothing coming');
    const last = views(published).at(-1)!.view;
    assert.equal(last.supportView.kind, 'hint', 'and what comes is the ordinary first rescue, an English intent hint');

    // Re-tappable, for the same reason typing is: asking for time is presence.
    convo.armRescue(session);
    await convo.handleClientMessage(session, tapped({ t: 'moment' }));
    const rescues = convo.conversationState.ladder.rescues;
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();
    assert.equal(convo.conversationState.ladder.rescues, rescues, 'a second ask is granted, not overruled');
  });

  test('a moment while the scene is being built changes nothing', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const client = new SlowFrameBrain();
    const { convo, session, published, said } = buildConvo(t, { seedTopic: SEED, client });

    convo.open(session);
    await sceneSettled(); // the builder has the request; the clock is already dark

    const spokenBefore = said.length;
    const seenBefore = published.length;
    await convo.handleClientMessage(session, tapped({ t: 'moment' }));

    assert.equal(said.length, spokenBefore, 'there is nothing to say about a pause while a scene is being built');
    assert.equal(published.length, seenBefore, 'and nothing to show either');

    client.release();
    await sceneSettled();

    t.mock.timers.tick(MOMENT_GRACE_MS + STUCK_SILENCE_MS + 1);
    await convo.settled();
    assert.equal(convo.conversationState.ladder.rescues, 0, 'the tap left no clock of its own behind to fire into the scene');

    // The same tap, once the scene exists, is the one that defers.
    convo.armRescue(session);
    await convo.handleClientMessage(session, tapped({ t: 'moment' }));
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();
    assert.equal(convo.conversationState.ladder.rescues, 0, 'in the scene the grace is granted');
  });

  test('the moment is answered on screen, never with a spoken remark', async (t) => {
    // The tutor is instructed at every rung never to remark on hesitation, and a
    // spoken acknowledgement of a pause is a remark on the pause. The app says
    // "Take your time." on screen; the room stays quiet.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { convo, session, said, published } = await inScene(t);

    convo.armRescue(session);
    const spokenBefore = said.length;
    const seenBefore = published.length;

    await convo.handleClientMessage(session, tapped({ t: 'moment' }));
    t.mock.timers.tick(STUCK_SILENCE_MS + 1);
    await convo.settled();

    assert.deepEqual(said.slice(spokenBefore), [], 'not one word about the pause, then or four seconds later');
    assert.equal(published.length, seenBefore, 'and nothing pushed at them either; the answer is the app’s to give');
  });

  test('a moment on the choosing screen restarts a clock, and never starts one', async (t) => {
    // Exactly what `typing` settled: armRescue owns when the tutor may wait on a
    // learner, and a tap must not be a second opinion about that.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { convo, session, said } = buildConvo(t, { voiceless: true });
    convo.open(session);

    await convo.handleClientMessage(session, tapped({ t: 'moment' }));
    t.mock.timers.tick(60_000);
    await convo.settled();

    assert.deepEqual(said, [], 'the quiet twin stays quiet');
    assert.equal(convo.conversationState.turnCount, 0, 'and a tap before the scene exists starts nothing');
  });
});

// ─────────────────────────────────── replaying the tutor's own line

describe('replaying a line', () => {
  test("tapping the tutor's line plays it again", async (t) => {
    const { convo, session, said, published } = await inScene(t);
    const scene = views(published).at(-1)!.view.sceneReply.fr;

    const before = said.length;
    await convo.handleClientMessage(session, tapped({ t: 'hear', line: 'scene' }));

    assert.deepEqual(said.slice(before), [scene], 'the tutor says its own last line again, and only that');
  });

  test('the say this card still plays the learner’s line, never the character’s', async (t) => {
    // The K-era rule, unchanged: handing back the scene's own line from the SAY
    // THIS card undoes exactly what learnerSideSupport took out.
    const { convo, session, said } = await inScene(t);
    const support = convo.conversationState.lastSupport.fullLine.fr;

    const before = said.length;
    await convo.handleClientMessage(session, tapped({ t: 'hear' }));

    assert.deepEqual(said.slice(before), [support], 'a plain hear is the support line, as it has always been');
  });
});

/**
 * The same money question as `tutor.test.ts`, against the other agent, because
 * the defect was the same shape in both. `recap.stats.turns` is
 * `state.turnCount`, and a silence rescue runs a real brain turn through
 * `integrateTurn`, which advances it — so a conversation nobody could be heard
 * in billed for its whole wall clock (F76).
 */
describe('what a conversation is allowed to bill', () => {
  /** Catch the debit the conversation sends, with no token server in the room. */
  function captureDebits() {
    const debits: { sessionId: string; seconds: number }[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
      debits.push(JSON.parse(String(init?.body)));
      return { ok: true, json: async () => ({ secondsRemaining: 600 }) };
    }) as unknown as typeof fetch;
    return { debits, restore: () => { globalThis.fetch = real; } };
  }

  /** Backdate the room's start, or every assertion below reads zero for free. */
  function ranFor(convo: ParleConversation, seconds: number): void {
    (convo as unknown as { startedAt: number }).startedAt = Date.now() - seconds * 1_000;
  }

  /**
   * A mission scene, which is the one way into a live scene that needs no
   * learner turn to get there: they tapped the mission before the room existed.
   * That makes it the honest shape of "the room opened and then reached nobody".
   */
  async function missionScene(t: TestContext, sessionId: string) {
    const built = buildConvo(t, { voiceless: true, missionId: 'mission:cafe', sessionId });
    built.convo.open(built.session);
    await sceneSettled();
    return built;
  }

  test('a conversation with no learner turn bills nothing even after a silence rescue', async (t) => {
    const { debits, restore } = captureDebits();
    try {
      const { convo, session, client } = await missionScene(t, '66666666-6666-4666-8666-666666666666');
      ranFor(convo, 60);

      // Four silent seconds. The rescue steps in, in character, through a real
      // brain turn — which is exactly what used to advance `turnCount` and make
      // the bill for a learner who never said anything.
      const generation = convo.armRescue(session);
      await convo.runRescue(generation);
      await convo.settled();
      convo.clearRescue();
      assert.equal(client.turnRequests.length, 1, 'the rescue really did spend a turn');
      assert.ok(convo.conversationState.turnCount > 0, 'and really did advance the turn count');

      await convo.finish();
      assert.equal(debits.length, 1, 'the session is still reported, which is what releases the lease');
      assert.equal(debits[0]!.seconds, 0, 'a conversation nobody could be heard in is not a product');
    } finally {
      restore();
    }
  });

  test('a conversation the learner did speak in is billed for its wall clock', async (t) => {
    const { debits, restore } = captureDebits();
    try {
      const { convo, session } = await missionScene(t, '77777777-7777-4777-8777-777777777777');
      ranFor(convo, 60);

      await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Je voudrais un café' }));
      await convo.settled();
      convo.clearRescue();

      await convo.finish();
      assert.equal(debits.length, 1);
      assert.equal(debits[0]!.seconds, 60, 'a conversation with a learner turn in it is a conversation');
    } finally {
      restore();
    }
  });
});

/**
 * F77, on the conversation side. A spent credential re-opens the room; what it
 * must not re-open is the session, because a conversation is the expensive one:
 * a scene build and a model call per turn.
 */
describe('a conversation credential that has already been spent', () => {
  test('a spent credential opens no scene, so a replayed room costs no model call', async (t) => {
    const sessionId = '88888888-8888-4888-8888-888888888888';
    noteSessionReported(sessionId);
    try {
      const { convo, session, published, client, said } = buildConvo(t, { voiceless: true, sessionId });
      convo.open(session);
      await sceneSettled();
      await convo.handleClientMessage(session, tapped({ t: 'say', text: 'Au café' }));
      await sceneSettled();
      await convo.settled();

      assert.deepEqual(published.filter((m) => m.t === 'opening'), [], 'no opening question');
      assert.deepEqual(views(published), [], 'no scene');
      assert.equal(client.frameRequests.length, 0, 'nothing designed');
      assert.equal(client.turnRequests.length, 0, 'and not one model call against a room that is not a session');
      assert.deepEqual(said, [], 'nor a word of synthesis');
      const errors = published.filter((m) => m.t === 'error');
      assert.equal(errors.length, 1, 'the learner is told, once, in plain words');
      assert.match(errors[0]!.message, /already finished/i);
    } finally {
      forgetReportedSessions();
    }
  });

  test('an unreported session id opens the conversation normally', async (t) => {
    forgetReportedSessions();
    const { convo, session, published } = buildConvo(t, {
      voiceless: true,
      sessionId: '99999999-9999-4999-8999-999999999999',
    });
    convo.open(session);
    await sceneSettled();
    assert.ok(published.some((m) => m.t === 'opening'), 'a fresh credential gets its conversation');
    assert.deepEqual(published.filter((m) => m.t === 'error'), []);
  });
});
