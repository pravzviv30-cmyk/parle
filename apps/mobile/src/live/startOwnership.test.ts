import { ownLeaseRetry } from './ownLease.ts';
import { tapToSendFrames } from './heldTurn.ts';
import { unjoinedLease, disconnectLease, type UnjoinedLease } from './unjoinedLease.ts';
import { tokenFailureCode, TokenServerError, classifyFailure } from './failure.ts';
/**
 * Leaving while the session is still connecting.
 *
 * The rules in startOwnership.ts are tested here directly. The hook that uses
 * them cannot be: apps/mobile has no renderer (docs/TESTING.md) and this hook
 * reaches expo-modules-core through globals.ts, which node's type stripping
 * refuses to load. So the second half of this file does what
 * useLiveSession.test.ts does — it LIFTS the production text of `start`, of
 * `leave` and of the unmount cleanup out of the file exactly as the file writes
 * them, and runs them against a fake room, a fake token server and a real
 * generation counter shared between all three. Every free name is supplied by
 * hand, so a fragment that reaches for something this harness has not thought
 * about throws a ReferenceError rather than quietly passing.
 *
 * What it is holding is a bill. `start` is a chain of awaits — auth, the token,
 * the audio session, the room, the microphone — and a cold start can spend
 * twenty five seconds in it. Nothing used to stop that chain: the learner left,
 * the token arrived anyway, and the code after it built a room, connected it,
 * and published a microphone for a screen that was gone. A connected room is a
 * room the tutor is dispatched into, and the tutor waits for a participant,
 * finds the ghost connection, teaches nobody for up to fifteen minutes, and
 * debits those minutes from the learner. Every test below that names a room is
 * about that.
 */

import assert from 'node:assert/strict';
import { createReplyLatencyClock } from './replyLatency.ts';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { RoomEvent, Track } from 'livekit-client';
import { ConversationTextRecorder, DEFAULT_TUTOR_VOICE, TOPIC_SERVER } from '@luvani/core';

import { NO_START, nextStart, standDown, startStillOwns } from './startOwnership.ts';
import { modeCarriesAudio, publishesMicAtConnect } from '../tutor/choosingView.ts';

/* ------------------------------------------------------------------------- *
 * The rules themselves.
 * ------------------------------------------------------------------------- */

describe('which attempt at starting a session owns the screen', () => {
  test('the only start there is, is the one the screen is waiting for', () => {
    const mine = nextStart(NO_START);
    assert.equal(startStillOwns(mine, mine), true);
    assert.equal(standDown(mine, mine, { room: true, audioSession: true }), null, 'a start that still owns the session has nothing to give back');
  });

  test('leaving, unmounting and starting again all take the session away the same way', () => {
    const mine = nextStart(NO_START);
    // Whichever of the three it was, it moved the counter, and that is the
    // whole signal. The start still waiting on a token finds out here.
    const afterTheLearnerLeft = nextStart(mine);
    assert.equal(startStillOwns(mine, afterTheLearnerLeft), false);
    assert.notEqual(standDown(mine, afterTheLearnerLeft, { room: false, audioSession: false }), null);
  });

  test('a start abandoned before it built anything has nothing to undo', () => {
    // The common case, and the cheap one: the learner leaves while the token is
    // still on its way, so there is no room and no audio session yet.
    const plan = standDown(1, 2, { room: false, audioSession: false });
    assert.deepEqual(plan, { disconnectRoom: false, releaseAudioSession: false });
  });

  test('a start abandoned after its room opened disconnects it, because that is what stops the meter', () => {
    const plan = standDown(1, 2, { room: true, audioSession: true });
    assert.deepEqual(plan, { disconnectRoom: true, releaseAudioSession: true });
  });

  test('an abandoned start gives back the audio session only if it took one', () => {
    // A typed lesson never takes one. Releasing a session somebody else is
    // holding would cut the audio out from under the session on screen.
    assert.deepEqual(standDown(1, 2, { room: true, audioSession: false }), {
      disconnectRoom: true,
      releaseAudioSession: false,
    });
  });

  test('the newest start keeps ownership no matter how many were abandoned behind it', () => {
    let current = NO_START;
    const first = (current = nextStart(current));
    const second = (current = nextStart(current));
    const third = (current = nextStart(current));
    assert.equal(startStillOwns(first, current), false);
    assert.equal(startStillOwns(second, current), false);
    assert.equal(startStillOwns(third, current), true);
  });
});

/* ------------------------------------------------------------------------- *
 * The harness: production text, lifted and run. Same shape as
 * useLiveSession.test.ts, which explains why it exists.
 * ------------------------------------------------------------------------- */

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const hook = read('./useLiveSession.ts');

/**
 * From `header` — which must end in its own opening bracket — to the bracket
 * that closes it.
 */
function fragmentAt(source: string, start: number, header: string): string {
  const open = header.trimEnd().slice(-1);
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start + header.lastIndexOf(open); i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    else if (source[i] === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`"${header}" is never closed`);
}

function fragment(source: string, header: string): string {
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `this test reads the hook for "${header}" and the hook no longer writes it`);
  return fragmentAt(source, start, header);
}

/** The inside of a block, without its header or its closing brace. */
function insideOf(source: string, header: string): string {
  return fragment(source, header).slice(header.length, -1);
}

/** A fragment as plain JavaScript, through node's own stripper. */
function asJs(source: string): string {
  const wrapped = stripTypeScriptTypes(`async function lifted() {\n${source}\n}`);
  return wrapped.slice(wrapped.indexOf('{') + 1, wrapped.lastIndexOf('}'));
}

const AsyncFunction = Object.getPrototypeOf(async (): Promise<void> => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;

/** Run a lifted fragment with every free name it may use supplied by hand. */
async function runAsync(source: string, world: Record<string, unknown>): Promise<void> {
  const names = Object.keys(world);
  const fn = new AsyncFunction(...names, `"use strict";\n${asJs(source)}`);
  await fn(...names.map((name) => world[name]));
}

const START = insideOf(hook, 'const start = useCallback(async () => {');
const LEAVE = insideOf(hook, 'const leave = useCallback(async () => {');
const TEARDOWN = insideOf(hook, 'const teardownRoom = useCallback(async () => {');
const UNMOUNT = insideOf(hook, 'return () => {');

/* ------------------------------------------------------------------------- *
 * The world the lifted text runs in.
 * ------------------------------------------------------------------------- */

type Handler = (...args: unknown[]) => void;

/** Everything the hook does to a room, counted. */
class FakeRoom {
  connects = 0;
  disconnects = 0;
  mics: boolean[] = [];
  played = 0;
  canPlaybackAudio = true;
  readonly handlers = new Map<string, Handler>();
  readonly remoteParticipants = new Map<string, unknown>();
  /** What happens to the learner while this room is connecting. */
  duringConnect: () => Promise<void> = async () => {};
  localParticipant = {
    setMicrophoneEnabled: async (on: boolean): Promise<void> => {
      this.mics.push(on);
    },
  };

  on(event: string, handler: Handler): this {
    this.handlers.set(String(event), handler);
    return this;
  }

  async connect(): Promise<void> {
    this.connects += 1;
    await this.duringConnect();
  }

  async disconnect(): Promise<void> {
    this.disconnects += 1;
  }

  async startAudio(): Promise<void> {
    this.played += 1;
  }
}

interface Hook {
  rooms: FakeRoom[];
  roomRef: { current: FakeRoom | null };
  startGenRef: { current: number };
  statuses: string[];
  failures: string[];
  sent: string[];
  /** Every session id the lifted `start` published, in order. */
  sessionIds: (string | null)[];
  timers: (() => void)[];
  journalled: number;
  audioSessionHeld: () => boolean;
  /** What the learner or the navigator does part way through starting. */
  duringAudioSession: (what: () => Promise<void>) => void;
  duringConnect: (what: () => Promise<void>) => void;
  world: (overrides?: Record<string, unknown>) => Record<string, unknown>;
  leave: () => Promise<void>;
  unmount: () => Promise<void>;
}

/** One mounted hook, as far as the lifted fragments can tell. */
function liveHook(token: { status?: number; body?: unknown; fetch?: () => Promise<unknown> } = {}): Hook {
  const rooms: FakeRoom[] = [];
  const roomRef: { current: FakeRoom | null } = { current: null };
  const leaseRef: { current: UnjoinedLease | null } = { current: null };
  const startGenRef = { current: NO_START };
  const watchdogRef: { current: number[] } = { current: [] };
  const diagRef: { current: Record<string, unknown> } = { current: {} };
  const noticeTimer: { current: number | null } = { current: null };
  const conversationTextRef = { current: new ConversationTextRecorder() };
  const statuses: string[] = [];
  const failures: string[] = [];
  const sent: string[] = [];
  // Every value the lifted `start` published as the session id, in order.
  const sessionIds: (string | null)[] = [];
  const timers: (() => void)[] = [];
  let journalled = 0;
  // Modelled on globals.native.ts, which refuses to release a session it has
  // not started yet. That refusal is how the audio session used to leak.
  let held = false;
  let connecting: () => Promise<void> = async () => {};
  let takingAudio: () => Promise<void> = async () => {};

  const grant = { token: 'signed', livekitUrl: 'wss://livekit.example' };
  const response = {
    status: token.status ?? 200,
    ok: (token.status ?? 200) < 400,
    headers: { get: (): string | null => null },
    json: async (): Promise<unknown> => token.body ?? grant,
  };

  const RoomCtor = class extends FakeRoom {
    constructor() {
      super();
      this.duringConnect = (): Promise<void> => connecting();
      rooms.push(this);
    }
  };

  const shared: Record<string, unknown> = {
    // The guard under test, imported rather than restated.
    NO_START,
    nextStart,
    startStillOwns,
    standDown,
    // The refs the hook keeps its session in.
    guestToken: undefined,
    setPartialTranscript: () => {},
    confirmedIds: {current: new Set()},
    startGenRef,
    roomRef,
    leaseRef,
    unjoinedLease,
    disconnectLease,
    noTypedRecovery: false,
    watchdogRef,
    diagRef,
    // The reply-latency clock `start` resets (replyLatency.ts), imported rather than restated.
    replyClock: { current: createReplyLatencyClock() },
    createReplyLatencyClock,
    noticeTimer,
    audioElsRef: { current: [] },
    heardAgentRef: { current: false },
    sessionOpenedRef: { current: false },
    safetyRef: { current: null },
    conversationTextRef,
    typingPingAt: { current: null },
    // The session's own shape.
    userId: 'learner-1',
    lessonId: 'cafe-01',
    startRung: undefined,
    mode: 'lesson',
    snapshot: undefined,
    seedTopic: undefined,
    continuationPackId: undefined,
    missionId: undefined,
    // F291 puts the chosen voice on every start body, resolved rather than
    // conditional, so both names the expression reaches for have to exist here
    // or the lifted fragment throws before it ever builds a room.
    tutorVoice: undefined,
    DEFAULT_TUTOR_VOICE,
    TOKEN_SERVER: 'https://token.example',
    TOPIC_SERVER,
    CONNECT_TIMEOUTS: {},
    READY_RETRIES_MS: [1500, 3500, 6500],
    AGENT_JOIN_TIMEOUT_MS: 12000,
    SESSION_OPEN_TIMEOUT_MS: 25000,
    // The edges.
    Room: RoomCtor,
    RoomEvent,
    Track,
    modeCarriesAudio,
    publishesMicAtConnect,
    listenOnly: false,
    // The real one asks navigator, which node has and browsers on http do not.
    // Its own rule is held by useLiveSession.test.ts, per mode.
    micApiUnavailable: () => false,
    ensureLiveKitGlobals: () => {},
    authHeaders: async (): Promise<Record<string, string>> => ({}),
    loadConsent: async () => null,
    analyticsAllowed: (value: unknown) => typeof value === 'object' && value !== null && 'allowed' in value && value.allowed === true,
    fetch: token.fetch ?? (async (): Promise<unknown> => response),
    ensureAudioSession: async (): Promise<void> => {
      // The OS hands the session over whatever the learner does in the middle
      // of it, and only then is the flag set. That order is globals.native.ts's
      // own, and it is why an early release finds nothing to release.
      await takingAudio();
      held = true;
    },
    releaseAudioSession: async (): Promise<void> => {
      if (!held) return;
      held = false;
    },
    // The state the screen reads.
    setStatus: (next: unknown) => {
      const value = typeof next === 'function' ? (next as (s: unknown) => { phase: string })({ phase: 'live' }) : next;
      statuses.push((value as { phase: string }).phase);
    },
    terminalFailureRef: { current: false },
    setSettlement: () => {},
    setCanDoEvidence: () => {},
    evidenceSessionRef: { current: null },
    setWaitingForTutor: () => {},
    setDiagnostics: () => {},
    // The grant's id, for source-linked history. Recorded so an abandoned
    // attempt can be shown never to publish one.
    setSessionId: (id: string | null) => {
      sessionIds.push(id);
    },
    setSafety: () => {},
    setTurns: () => {},
    setThinking: () => {},
    setMicOpen: () => {},
    setAudioBlocked: () => {},
    setNotice: () => {},
    // Added to `start` by the Phase 5 reconnect and quiet-door work. The lifted
    // fragment names them, so the world has to hand them over or the run dies
    // with a ReferenceError rather than a failed assertion.
    // The grant site keeps the plan catalogue for the subscription wall (F514),
    // so the fragment names both of these. Same bargain as the setters above.
    noteCatalogue: () => {},
    plansIn: (): null => null,
    setReconnecting: () => {},
    setVoiceless: () => {},
    voicelessRef: { current: false },
    // Added by tap to send and the wrap-up note (heldTurn.ts): a new start
    // forgets both, and connect tells the agent when the preference is on.
    setWrappingUp: () => {},
    setHeldTurn: () => {},
    tapToSendRef: { current: false },
    tapToSendFrames,
    // Added to `start` by the F763 recap close and the orb's audio tracks: a new
    // start forgets the last session's tracks and its closed microphone. Same
    // bargain as the setters above.
    setAudioTracks: () => {},
    NO_TRACKS: { mic: null, tutor: null },
    setMicClosedAtRecap: () => {},
    setPrompt: () => {},
    setFeedback: () => {},
    setTutorSpeaking: () => {},
    setLastTranscript: () => {},
    setSummary: () => {},
    setConvo: () => {},
    setOpening: () => {},
    setRecap: () => {},
    setPractice: () => {},
    setDrills: () => {},
    setSceneReplies: () => {}, ownLeaseRetry, ownLeaseRetryRef: { current: false },
    emptyDiagnostics: (): Record<string, unknown> => ({}),
    addTurn: () => 't1',
    removeAudioEls: () => {},
    clearWatchdog: () => {
      watchdogRef.current = [];
    },
    send: (message: { t: string }) => sent.push(message.t),
    fail: (failure: string) => failures.push(failure),
    // The taxonomy is failure.ts's own business and has its own tests. What
    // matters here is only whether the hook reports a failure at all.
    classifyFailure: () => 'unknown',
    TokenServerError: class extends Error {},
    tokenFailureCode,
    trace: () => {},
    leave: async (): Promise<void> => {},
    teardownRoom: () => runAsync(TEARDOWN, shared),
    // Added to `start` by the F165 lease-release work: the abandon path now hands
    // the account's session lease back when a grant never reached a tutor, so the
    // lifted fragment reaches for the release call and the world must supply it.
    abandonSession: async (): Promise<void> => {},
    // Slower voice: read from the device at each start; unchosen here.
    loadVoiceSpeedPreference: async () => null,
    setTimeout: (fire: () => void): number => {
      timers.push(fire);
      return timers.length;
    },
    clearTimeout: () => {},
    // Only reached by the data handler, and only when it is not deaf.
    decodeServerMessage: () => ({ t: 'recap', recap: {}, profile: {} }),
    opensSession: () => true,
    thinkingAfter: (was: boolean) => was,
    stoppedBySafety: () => false,
    journalRecap: () => {
      journalled += 1;
    },
  };

  return {
    rooms,
    roomRef,
    startGenRef,
    statuses,
    failures,
    sent,
    sessionIds,
    timers,
    get journalled(): number {
      return journalled;
    },
    audioSessionHeld: () => held,
    duringAudioSession: (what: () => Promise<void>) => {
      takingAudio = what;
    },
    duringConnect: (what: () => Promise<void>) => {
      connecting = what;
    },
    // The hook's own readConsent, bound to whichever loadConsent this start was handed.
    world: (overrides: Record<string, unknown> = {}) => {
      const merged: Record<string, unknown> = { ...shared, ...overrides };
      return { readConsent: (guest: boolean) => guest ? Promise.resolve(null)
        : Promise.resolve().then(() => (merged.loadConsent as () => unknown)()).catch(() => null), ...merged };
    },
    leave: () => runAsync(LEAVE, shared),
    unmount: () => runAsync(UNMOUNT, shared),
  };
}

const start = (session: Hook, overrides: Record<string, unknown> = {}): Promise<void> =>
  runAsync(START, session.world(overrides));

/* ------------------------------------------------------------------------- *
 * The hook, held to its own source.
 * ------------------------------------------------------------------------- */

describe('the learner leaves while the session is still connecting — F151', () => {
  test('a token that arrives after the learner has gone never becomes a room', async () => {
    const session = liveHook();
    // Twenty five seconds of cold start, and the learner taps Leave in the
    // middle of it. This is the production `leave`, not a stand-in for it.
    await start(session, {
      fetch: async () => {
        await session.leave();
        return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ token: 't', livekitUrl: 'wss://x' }) };
      },
    });

    assert.deepEqual(session.rooms, [], 'a room was opened for a screen the learner had already left');
    assert.deepEqual(session.sessionIds, [null], 'an abandoned attempt published a session id for a room that never opened');
    assert.equal(session.roomRef.current, null, 'the abandoned attempt left its room where the screen reads one');
    assert.ok(!session.statuses.includes('live'), 'the session went live after the learner left it');
    assert.deepEqual(session.timers, [], 'watchdogs were armed for a session nobody is in');
    assert.ok(!session.sent.includes('ready'), 'the app said hello to a tutor on the learner’s behalf after they left');
  });

  test('the screen being popped mid-connect abandons the session the same way', async () => {
    const session = liveHook();
    // Navigation, not the door: the learner swiped back, or something else
    // pushed over the top. The cleanup is the only thing that runs.
    await start(session, {
      fetch: async () => {
        await session.unmount();
        return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ token: 't', livekitUrl: 'wss://x' }) };
      },
    });

    assert.deepEqual(session.rooms, [], 'a room was opened for a screen that no longer exists');
    assert.ok(!session.statuses.includes('live'), 'a session went live on an unmounted screen');
  });

  test('a room that did open for a learner who had gone is disconnected, not left metering', async () => {
    const session = liveHook();
    // Later than the first test: the room object exists and the OS audio
    // session is being taken when the learner walks out.
    session.duringAudioSession(async () => {
      await session.leave();
    });
    await start(session);

    assert.equal(session.rooms.length, 1, 'the attempt got as far as building a room');
    assert.equal(session.rooms[0]!.connects, 0, 'the room connected after the learner had left, and the tutor is dispatched into a connected room');
    assert.ok(session.rooms[0]!.disconnects > 0, 'the room was left open with nobody in it');
    assert.deepEqual(session.rooms[0]!.mics, [], 'a microphone was published on a screen the learner had left');
    assert.ok(!session.statuses.includes('live'), 'the session went live after the learner left it');
    assert.deepEqual(session.timers, [], 'watchdogs were armed for a session nobody is in');
  });

  test('the audio session goes back even when the learner leaves while it is being taken', async () => {
    const session = liveHook();
    // `leave` releases the audio session too early to catch this one: it fires
    // while the OS is still handing it over, finds nothing started, and returns.
    // The session is then started anyway, on nobody's behalf, and on a phone it
    // holds the route and the microphone until something else takes it.
    session.duringAudioSession(async () => {
      await session.leave();
    });
    await start(session);

    assert.equal(session.audioSessionHeld(), false, 'the OS audio session was left running after the learner left');
  });

  test('leaving mid-connect is not a failure, and the learner is not shown one on the way out', async () => {
    const session = liveHook();
    // What livekit really does: disconnecting a room that is still connecting
    // aborts the attempt and rejects the connect promise as cancelled. That
    // rejection used to land on the error screen of somebody already leaving.
    session.duringConnect(async () => {
      await session.leave();
      throw new Error('Client initiated disconnect');
    });
    await start(session);

    assert.deepEqual(session.failures, [], 'a learner who chose to leave was shown a failure');
    assert.ok(!session.statuses.includes('error'), 'an error screen was raised behind a learner on their way out');
  });
});

describe('two starts at once — the older one must not clobber the newer', () => {
  test('a start still fetching a token cannot take the room away from the session on screen', async () => {
    const session = liveHook();
    let arrive = (): void => {};
    const heldToken = new Promise<void>((resolve) => {
      arrive = resolve;
    });

    // The first attempt hangs on a cold token server. ConvoScreen reaches this
    // by restarting when the learner switches to typing; the door on the
    // connecting screen reaches it by leaving and starting again.
    const first = start(session, { fetch: async () => { await heldToken; return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ token: 't', livekitUrl: 'wss://x' }) }; } });
    await start(session);
    arrive();
    await first;

    assert.equal(session.rooms.length, 1, 'the abandoned attempt opened a second room nobody can reach');
    assert.equal(session.roomRef.current, session.rooms[0], 'the late attempt overwrote the room the learner is actually in');
    assert.equal(session.rooms[0]!.disconnects, 0, 'the session on screen was torn down by an older attempt finishing');
    assert.equal(session.statuses.filter((phase) => phase === 'live').length, 1, 'the screen was told it went live twice');
  });

  test('a granted session publishes its own id, and a restart clears it before asking again', async () => {
    const session = liveHook();
    const grant = (sessionId: string) => ({
      fetch: async () => ({ status: 200, ok: true, headers: { get: () => null }, json: async () => ({ token: 't', livekitUrl: 'wss://x', sessionId }) }),
    });
    await start(session, grant('s-one'));
    await start(session, grant('s-two'));
    assert.deepEqual(session.sessionIds, [null, 's-one', null, 's-two'], 'a restart carried the old session id into the new session');
  });

  test('a restart takes the old room with it rather than leaving it running', async () => {
    const session = liveHook();
    await start(session);
    assert.equal(session.rooms.length, 1);

    // Switching to typing restarts the hook without leaving first. The old room
    // is about to lose the only reference to it.
    await start(session);

    assert.equal(session.rooms.length, 2, 'the restart never opened its own room');
    assert.equal(session.rooms[0]!.disconnects, 1, 'the first room was left connected with the tutor still billing it');
    assert.equal(session.roomRef.current, session.rooms[1], 'the screen is reading a room the restart replaced');
  });
});

describe('an abandoned room cannot speak to the screen it left', () => {
  test('tidying one up does not tell the learner their connection dropped', async () => {
    const session = liveHook();
    await start(session);
    const room = session.rooms[0]!;
    await session.leave();
    const dropped = room.handlers.get(RoomEvent.Disconnected);
    assert.ok(dropped, 'the hook still listens for the room going away');

    const before = session.statuses.length;
    dropped();

    assert.deepEqual(
      session.statuses.slice(before),
      [],
      'disconnecting a room on purpose painted "The connection dropped" over whatever the learner is doing now',
    );
  });

  test('a recap from a session the learner left is never written into their review deck', async () => {
    const session = liveHook();
    await start(session);
    const room = session.rooms[0]!;
    await session.leave();
    const data = room.handlers.get(RoomEvent.DataReceived);
    assert.ok(data, 'the hook still listens for what the tutor says');

    data(new Uint8Array([1]), undefined, undefined, TOPIC_SERVER);

    assert.equal(session.journalled, 0, 'practice the learner never did was banked from a session they had left');
  });
});


test('a voice-only refusal in the shipped start offers typing without constructing a room', async () => {
  const session = liveHook({ status: 503, body: { error: 'voice-unavailable', supportedModes: ['lesson-text', 'convo-text'] } });
  await start(session, { TokenServerError, classifyFailure });
  assert.deepEqual(session.failures, ['voice-unavailable']);
  assert.deepEqual(session.rooms, []);
  assert.ok(!session.statuses.includes('live'));
});

test('an account screen abandoned during the consent read sends no session or permission',async()=>{
 const session=liveHook();let calls=0;
 await start(session,{loadConsent:async()=>{await session.unmount();return {allowed:true};},fetch:async()=>{calls++;throw new Error('unexpected request');}});
 assert.equal(calls,0);assert.deepEqual(session.rooms,[]);
});

test('leaving a connected room before tutor arrival releases the issued lease once', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const session = liveHook({ body: { token: 'signed', livekitUrl: 'wss://livekit.example', sessionId: id } });
  const released: string[] = [];
  await start(session, { abandonSession: async (_user: string, sessionId: string) => { released.push(sessionId); } });
  assert.equal(session.statuses.at(-1), 'live');
  await session.leave(); await session.unmount();
  assert.deepEqual(released, [id]);
});

test('a tutor joining while the old room disconnects is observed before obsolete UI guards', async () => {
  const id = '22222222-2222-4222-8222-222222222222';
  const session = liveHook({ body: { token: 'signed', livekitUrl: 'wss://livekit.example', sessionId: id } });
  const released: string[] = [];
  await start(session, { abandonSession: async (_user: string, sessionId: string) => { released.push(sessionId); } });
  const room = session.rooms[0]!; let disconnected!: () => void;
  room.disconnect = () => new Promise<void>(resolve => { disconnected = resolve; });
  const exit = session.leave();
  room.handlers.get(RoomEvent.ParticipantConnected)!({ identity: 'tutor' });
  disconnected(); await exit;
  assert.deepEqual(released, []);
});
