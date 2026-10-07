import { classifyFailure } from './failure.ts';
import { unjoinedLease } from './unjoinedLease.ts';
/**
 * What the live hook does with the messages it is sent, held to its own source.
 *
 * apps/mobile has no renderer (docs/TESTING.md), and this hook cannot even be
 * imported here: it reaches expo-modules-core through globals.ts, which node's
 * type stripping refuses to load. So the message handler cannot be driven the
 * way a test would like to drive it.
 *
 * What this does instead is LIFT the production text — the whole `switch
 * (msg.t)`, the session-open check above it, the watchdog it stands down, the
 * dismissal, the two audio blocks — out of the file exactly as the file writes
 * it, and run each fragment against real rules and faked edges. Every free name
 * a fragment uses is supplied by hand, so a fragment that reaches for something
 * this harness has not thought about throws a ReferenceError rather than
 * quietly passing. Narrower than driving the hook, and far wider than matching
 * a string: what these check is what the production lines actually do.
 *
 * The defect the first of them exists for was silent in exactly that way.
 * `journalRecap` grew a second argument for the learner model, the journal and
 * the review store were both tested end to end through it, and this handler
 * went on calling the one-argument version while holding the profile on the
 * line above. Every test passed and the feature did nothing on a phone.
 *
 * The rules themselves are not in here, on purpose. `safetyState.ts`,
 * `sessionOpened.ts` and `choosingView.ts` are importable modules with their
 * own answers; this file proves the hook asks them, and asks them everywhere.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RoomEvent, Track } from 'livekit-client';
import { ConversationTextRecorder, DEFAULT_TUTOR_VOICE, decodeClientMessage, encodeMessage, isTutorVoiceKey, type RecapPayload, type ServerMessage } from '@luvani/core';
import { attachCorrectionReason } from './correctionReason.ts';
import { createProfile } from '@luvani/brain/profile';

import { setActiveUser } from '../storage/scope.ts';
import { journalRecap } from './journal.ts';
import { recoveryPlan } from './journalRules.ts';
import { classifyPipelineError, failureCopy, type LiveFailure } from './failure.ts';
import { afterDismiss } from './safetyState.ts';
import { opensSession } from './sessionOpened.ts';
import { micOpensAtConnect, modeCarriesAudio, type LiveMode } from '../tutor/choosingView.ts';
import { stoppedBySafety, type SafetyDecision } from '../tutor/safetyView.ts';
import { holdLive, liveRoom } from '../sound/audioFocus.ts';
import { recapMayTakeTheAudio } from './recapAudio.ts';

const NOW = new Date(2026, 7, 27, 14).getTime();

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const phrase = (fr: string, en: string) => ({ fr, frWritten: null, en, enLiteral: null, register: 'familier', note: null });

const recap = (): RecapPayload => ({
  headline: 'You ordered a coffee.',
  wins: ['You said it without help.'],
  fixes: [],
  phrases: [phrase('Ça marche', 'coming up'), phrase('Autre chose', 'something else')],
  nextFocus: 'The u sound',
  topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
  cefr: { estimate: 'A1', confidence: 'low' },
  stats: { turns: 6, rescues: 1, unassistedRate: 0.7 },
});

/**
 * The learner model as the recap carries it, built through `createProfile` so
 * this test cannot drift away from what `repairProfile` accepts.
 */
function profileWith(used: Record<string, number>): unknown {
  const profile = createProfile();
  for (const [fr, timesUsedWell] of Object.entries(used)) {
    profile.phrases[fr.toLowerCase()] = {
      fr,
      frWritten: null,
      en: 'used in conversation',
      register: 'familier',
      introducedAt: new Date(NOW).toISOString(),
      timesUsedWell,
      mastered: false,
    };
  }
  return profile;
}

/**
 * AsyncStorage resolves under plain node and has no implementation off a
 * device, so the module object every store shares is given one. Same
 * arrangement as journal.test.ts and storage/storeBinding.test.ts.
 */
function installDisk(): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  return map;
}

/** The body of `case 'recap':`, which is everything the app does with a recap. */
function recapCase(source: string): string {
  const open = source.indexOf("case 'recap':");
  assert.ok(open >= 0, 'the hook still handles the recap message');
  const close = source.indexOf("case '", open + 1);
  assert.ok(close > open, 'the recap case still ends where the next one begins');
  return source.slice(open, close);
}

/** The call to the journal inside it, parentheses matched, written as it is written. */
function journalCall(block: string): string {
  const start = block.indexOf('journalRecap(');
  assert.ok(start >= 0, 'the recap is still written down before the session can be closed');
  let depth = 0;
  for (let i = start; i < block.length; i += 1) {
    if (block[i] === '(') depth += 1;
    else if (block[i] === ')') {
      depth -= 1;
      if (depth === 0) return block.slice(start, i + 1);
    }
  }
  throw new Error('the call to the journal is never closed');
}

/** Run that call, with the real journal and one recap message off the wire. */
function makeTheCall(call: string, msg: unknown): Promise<void> {
  const run = new Function('journalRecap', 'msg', `"use strict"; return ${call};`) as (
    journal: typeof journalRecap,
    message: unknown,
  ) => Promise<void>;
  return run(journalRecap, msg);
}

describe('the recap message, on its way to the disk', () => {
  test('the counts a conversation earned reach the journal, not just the end card', async () => {
    // The agent sends the recap and the updated learner model on one message.
    // The card renders the recap; the counts of what was used well live on the
    // model, and the journal is where they turn into practice.
    const uid = '33333333-3333-4333-8333-000000000001';
    const disk = installDisk();
    setActiveUser(uid);

    const message = {
      t: 'recap' as const,
      recap: recap(),
      profile: profileWith({ 'Ça marche': 3 }),
    };
    await makeTheCall(journalCall(recapCase(read('./useLiveSession.ts'))), message);

    const raw = disk.get(`luvani.u.${uid}.journal`);
    assert.ok(raw, 'the recap never reached the disk at all');

    // Read back the way a launch reads it, so this is the batch the deck is
    // actually built from rather than a shape agreeing with itself.
    const batch = recoveryPlan(JSON.parse(raw));
    assert.ok(batch, 'the journalled session is not recoverable');
    assert.deepEqual(batch.phrases.map((p) => p.fr), ['Ça marche', 'Autre chose'], 'the recap itself still rides');
    assert.deepEqual(
      batch.convoUses,
      [{ fr: 'Ça marche', uses: 3 }],
      'a phrase the learner has started using must reach review as one, not as a phrase they read once',
    );
  });
});

/* ------------------------------------------------------------------------- *
 * The harness: production text, lifted and run.
 * ------------------------------------------------------------------------- */

const hook = read('./useLiveSession.ts');

/**
 * From `header` — which must end in its own opening bracket — to the bracket
 * that closes it. Nothing in the fragments below carries a bracket inside a
 * string or a comment, and if one ever does the generated function fails to
 * parse, which is a failure and not a false pass.
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

/** Every fragment with this header, in source order. */
function fragments(source: string, header: string): string[] {
  const found: string[] = [];
  for (let from = 0; ; ) {
    const start = source.indexOf(header, from);
    if (start < 0) return found;
    const whole = fragmentAt(source, start, header);
    found.push(whole);
    from = start + whole.length;
  }
}

/** The inside of a block, without its header or its closing brace. */
function insideOf(source: string, header: string): string {
  return fragment(source, header).slice(header.length, -1);
}

/** One statement written on one line, taken whole. */
function statementWith(source: string, needle: string): string {
  const i = source.indexOf(needle);
  assert.notEqual(i, -1, `this test reads the hook for "${needle}" and the hook no longer writes it`);
  const text = source.slice(source.lastIndexOf('\n', i) + 1, source.indexOf('\n', i)).trim();
  assert.ok(text.endsWith(';'), `"${needle}" is no longer one statement on one line, so this test cannot lift it`);
  return text;
}

/**
 * Several one-line statements, lifted whole and returned in the order the hook
 * writes them. Order is the subject of the test, so it is read off the source
 * rather than taken from the order the needles were passed in.
 */
function statementsInOrder(source: string, ...needles: string[]): string {
  return needles
    .map((needle) => {
      const at = source.indexOf(needle);
      assert.notEqual(at, -1, `this test reads the hook for "${needle}" and the hook no longer writes it`);
      return { at, text: statementWith(source, needle) };
    })
    .sort((a, b) => a.at - b.at)
    .map((one) => one.text)
    .join('\n');
}

/** A module constant, read off the source rather than restated here. */
function constant(source: string, name: string): number | number[] {
  const found = new RegExp(`const ${name} = ([^;]+);`).exec(source);
  assert.ok(found, `${name} is gone from the hook`);
  return JSON.parse(found[1]!) as number | number[];
}

/**
 * A fragment as plain JavaScript, through node's own stripper — the same one
 * `--experimental-strip-types` runs this file with.
 *
 * Lifted production text carries TypeScript that `new Function` cannot parse; a
 * single non-null assertion is enough to stop it. The wrapper is what makes the
 * fragment a legal program to strip: these are function bodies, so they are
 * allowed to `return`, and two of them are allowed to `await`. The stripper
 * only blanks characters, never moves them, so unwrapping is exact.
 */
function asJs(source: string): string {
  const wrapped = stripTypeScriptTypes(`async function lifted() {\n${source}\n}`);
  return wrapped.slice(wrapped.indexOf('{') + 1, wrapped.lastIndexOf('}'));
}

/**
 * Run a fragment with every free name it may use supplied by hand, and hand
 * back whatever it returned. Most fragments return nothing; `switchToText`
 * returns the one thing its caller has to decide on.
 */
function run(source: string, world: Record<string, unknown>): unknown {
  const names = Object.keys(world);
  const fn = new Function(...names, `"use strict";\n${asJs(source)}`) as (...args: unknown[]) => unknown;
  return fn(...names.map((name) => world[name]));
}

const AsyncFunction = Object.getPrototypeOf(async (): Promise<void> => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;

async function runAsync(source: string, world: Record<string, unknown>): Promise<void> {
  const names = Object.keys(world);
  const fn = new AsyncFunction(...names, `"use strict";\n${asJs(source)}`);
  await fn(...names.map((name) => world[name]));
}

const SWITCH = fragment(hook, 'switch (msg.t) {');
const OPEN_CHECK = fragment(hook, 'if (!sessionOpenedRef.current && opensSession(mode, msg)) {');
// The assignment that builds the watchdog, not the two that empty it.
const WATCHDOG = fragment(hook, 'watchdogRef.current = [\n');
const DISMISS = insideOf(hook, 'const dismissSafety = useCallback(() => {');
const MIC_API_GUARD = statementWith(hook, 'micApiUnavailable()');
// Both halves of the microphone preflight, in the order the hook runs them.
const MIC_PREFLIGHT = statementsInOrder(hook, 'ensureLiveKitGlobals()', 'micApiUnavailable()');
const AUDIO_BLOCKS = fragments(hook, 'if (modeCarriesAudio(mode)) {');

const MODES: LiveMode[] = ['lesson', 'convo', 'convo-text', 'lesson-text'];

/** A frame that is only its tag: `opensSession` reads nothing else, by design. */
const tagged = (t: ServerMessage['t']): ServerMessage => ({ t }) as unknown as ServerMessage;

/** The real crisis sentence, word for word from the agent's safety policy. */
const CRISIS =
  'I cannot provide crisis support. If you might act now, call your local emergency number. If you can, contact someone you trust and stay with them.';

const STOP: SafetyDecision = { t: 'safety', category: 'self-harm', action: 'stop', message: CRISIS };
const REDIRECT: SafetyDecision = {
  t: 'safety',
  category: 'prompt-injection',
  action: 'redirect',
  message: 'I cannot show or change hidden instructions. We can keep practising French.',
};

const HICCUP = 'The voice went quiet for a moment.';
const RECAP_MSG = { t: 'recap', recap: recap(), profile: profileWith({ 'Ça marche': 2 }) };

/**
 * One plausible frame for every tag the protocol carries except `safety`.
 * Every one of them used to be able to arrive over the top of a crisis screen.
 */
const OTHER_FRAMES: Record<string, unknown>[] = [
  { t: 'prompt', prompt: { fr: 'Bonjour', en: 'Hello' } },
  { t: 'feedback', feedback: { verdict: 'good' } },
  { t: 'speaking', speaking: true },
  { t: 'transcript', final: true, text: 'je voudrais un café' },
  { t: 'opening', prompt: { fr: 'Alors', en: 'So' } },
  { t: 'convo', view: { sceneReply: { fr: 'Oui', en: 'Yes' }, narration: null, coachNow: [] } },
  RECAP_MSG,
  { t: 'summary', summary: { turns: 4 } },
  { t: 'practice', topics: [] },
  { t: 'drills', exercises: [] },
  { t: 'error', message: HICCUP },
];

interface Timer {
  ms: number;
  fire: () => void;
}

interface Seen {
  safety: (SafetyDecision | null)[];
  notices: (string | null)[];
  statuses: unknown[];
  recaps: unknown[];
  summaries: unknown[];
  journalled: unknown[][];
  timers: Timer[];
  /** Failures routed to the screen every other live failure lands on. */
  failed: LiveFailure[];
  /** Every line the handler put on the console, level and all. */
  logs: string[];
  /** How many times it left the room, which is what stops the meter. */
  left: number;
}

/** Everything the message handler's switch reaches for: the rules real, the edges faked. */
function switchWorld(
  decided: SafetyDecision | null = null,
  session: { mode?: LiveMode; voiceless?: boolean } = {},
): {
  world: Record<string, unknown>;
  seen: Seen;
  safetyRef: { current: SafetyDecision | null };
} {
  const seen: Seen = {
    safety: [],
    notices: [],
    statuses: [],
    recaps: [],
    summaries: [],
    journalled: [],
    timers: [],
    failed: [],
    logs: [],
    left: 0,
  };
  const safetyRef = { current: decided };
  const noop = (): void => {};
  const world: Record<string, unknown> = {
    msg: null,
    setPrompt: noop,
    setFeedback: noop,
    setTutorSpeaking: noop,
    setLastTranscript: noop,
    addTurn: noop,
    setConvo: noop,
    setTurns: noop,
    setOpening: noop,
    setPractice: noop,
    setDrills: noop,
    setSummary: (s: unknown) => seen.summaries.push(s),
    setRecap: (r: unknown) => seen.recaps.push(r),
    setStatus: (s: unknown) => seen.statuses.push(s),
    setNotice: (n: string | null) => seen.notices.push(n),
    terminalFailureRef: { current: false },
    setSettlement: noop,
    setCanDoEvidence: noop,
    attachCorrectionReason,
    evidenceSessionRef: { current: null },
    grant: { sessionId: '11111111-1111-4111-8111-111111111111' },
    missionId: 'mission:premier-cafe',
    setSafety: (s: SafetyDecision | null) => seen.safety.push(s),
    safetyRef,
    // The recap closes the microphone before it shows (F763). Its own test
    // below runs the real close; here it is only a name the recap case calls.
    closeMicForRecap: noop,
    conversationTextRef: { current: new ConversationTextRecorder() },
    noticeTimer: { current: null as unknown },
    // Real, because "is this session stopped" must be one reading of the frame
    // and not the hook's own second opinion about it.
    stoppedBySafety,
    journalRecap: (...args: unknown[]) => {
      seen.journalled.push(args);
      return Promise.resolve();
    },
    setTimeout: (fire: () => void, ms: number) => seen.timers.push({ ms, fire }),
    clearTimeout: noop,
    // The session this handler is running inside. Both are read by the `error`
    // case, and both are real: which failures a learner can feel depends on the
    // mode they were granted AND on whether they have since taken the quiet
    // door, and the classification is the same one failure.ts publishes.
    noTypedRecovery: false,
    mode: session.mode ?? 'convo',
    voicelessRef: { current: session.voiceless ?? false },
    modeCarriesAudio,
    classifyPipelineError,
    failureCopy,
    fail: (failure: LiveFailure) => seen.failed.push(failure),
    leave: () => {
      seen.left += 1;
      return Promise.resolve();
    },
    // Shadows the global, so the lines are collected rather than printed and
    // the level each one went out at is part of the assertion.
    console: {
      warn: (line: string) => seen.logs.push(`warn ${line}`),
      info: (line: string) => seen.logs.push(`info ${line}`),
    },
  };
  return { world, seen, safetyRef };
}

const deliver = (world: Record<string, unknown>, msg: unknown): void => {
  run(SWITCH, { ...world, msg });
};

describe('the safety decision the hook holds — F136', () => {
  test('a safety stop survives the recap, the summary and the eight second timer', () => {
    const { world, seen, safetyRef } = switchWorld();

    deliver(world, STOP);
    assert.equal(safetyRef.current, STOP, 'the safety frame never reached the state the two screens read');
    assert.deepEqual(seen.safety, [STOP], 'the screens were never told');
    assert.equal(seen.notices.length, 0, 'the crisis sentence went out as a notice, which is the frame this replaces');
    assert.equal(seen.timers.length, 0, 'a timer was started against a safety decision, and it is the one state with none');

    // Every other frame the protocol carries, delivered over the top of it.
    // The recap and the summary are the two that used to win: the agent calls
    // finish on the same tick it decides, so both arrive milliseconds later.
    for (const frame of OTHER_FRAMES) deliver(world, frame);
    assert.equal(safetyRef.current, STOP, 'an ordinary frame erased a stop, and the screen underneath congratulates');
    assert.deepEqual(seen.safety, [STOP], 'something told the screens the decision had changed');
    assert.ok(seen.recaps.length === 1 && seen.summaries.length === 1, 'this test is no longer delivering both endings');

    // The eight second timer still exists, still belongs to the notice, and
    // still takes only the notice with it when it fires.
    assert.deepEqual(
      seen.timers.map((t) => t.ms),
      [8000],
      'either the notice lost its timer or something else grew one',
    );
    seen.timers[0]!.fire();
    assert.deepEqual(seen.notices, [HICCUP, null], 'the notice no longer clears itself, and that part was right');
    assert.equal(safetyRef.current, STOP, 'the eight second timer took the safety decision away with the notice');

    // And the whole file, so a fourth writer cannot appear later: three
    // assignments, and every one of them is accounted for above or below.
    assert.deepEqual(
      [...hook.matchAll(/setSafety\([^)]*\)/g)].map((m) => m[0]),
      ['setSafety(null)', 'setSafety(msg)', 'setSafety(next)'],
      'something else in the hook writes the safety state: start clears it, the frame sets it, dismissal ends a redirect',
    );
  });

  test('the recap of a stopped session is never journalled, and a redirect costs nothing', () => {
    // The journal write happens inside the hook, before any screen has the
    // recap, so a screen withholding its own recap withholds nothing here.
    const stopped = switchWorld(STOP);
    deliver(stopped.world, RECAP_MSG);
    assert.deepEqual(stopped.seen.journalled, [], 'a stopped session wrote its practice to the disk on the way out');
    assert.equal(stopped.seen.recaps.length, 1, 'the hook stopped holding the recap, which the screens rely on to withhold it');

    const ordinary = switchWorld(null);
    deliver(ordinary.world, RECAP_MSG);
    assert.deepEqual(
      ordinary.seen.journalled,
      [[RECAP_MSG.recap, { profile: RECAP_MSG.profile }]],
      'an ordinary session stopped journalling its recap, which is every learner losing every session',
    );

    const steered = switchWorld(REDIRECT);
    deliver(steered.world, RECAP_MSG);
    assert.equal(steered.seen.journalled.length, 1, 'a redirect quietly cost the learner the practice they had earned');
  });

  test('a redirect is the only safety decision a learner can put away', () => {
    assert.equal(afterDismiss(STOP), STOP, 'a stop can be tapped away, and the session underneath looks live again');
    assert.equal(afterDismiss(REDIRECT), null);
    assert.equal(afterDismiss(null), null);

    // dismissSafety itself, as the hook writes it.
    const stopped: { current: SafetyDecision | null } = { current: STOP };
    const toldOfStop: (SafetyDecision | null)[] = [];
    run(DISMISS, { afterDismiss, safetyRef: stopped, setSafety: (s: SafetyDecision | null) => toldOfStop.push(s) });
    assert.equal(stopped.current, STOP, 'the learner dismissed a stop and the crisis surface went away');
    assert.deepEqual(toldOfStop, [], 'a tap that changes nothing still re-rendered the screen');

    const steered: { current: SafetyDecision | null } = { current: REDIRECT };
    const toldOfRedirect: (SafetyDecision | null)[] = [];
    run(DISMISS, { afterDismiss, safetyRef: steered, setSafety: (s: SafetyDecision | null) => toldOfRedirect.push(s) });
    assert.equal(steered.current, null, 'a redirect the learner has read stays on screen for the rest of the session');
    assert.deepEqual(toldOfRedirect, [null]);
  });

  test('a stop can be the first frame a session ever gets, and the watchdog stands down for it', () => {
    // The rule first: a decision opens the session in every mode, and the
    // mode-specific table underneath it still refuses the wrong protocol.
    for (const mode of MODES) {
      assert.equal(opensSession(mode, STOP), true, `${mode}: a stop does not count as a session being on screen`);
      assert.equal(opensSession(mode, REDIRECT), true, `${mode}: a redirect does not count, and the tutor is plainly here`);
      assert.equal(opensSession(mode, tagged('speaking')), false, `${mode}: an agent hung inside its TTS counts as a session`);
    }
    assert.equal(opensSession('convo', tagged('prompt')), false, 'a conversation accepts a lesson and spins behind it forever');
    assert.equal(opensSession('lesson', tagged('prompt')), true, 'a lesson no longer opens on its own prompt');

    // Then the hook, in all four modes: the stop marks the session open and
    // clears the watchdog, and nothing the watchdog holds can fire over it.
    for (const mode of MODES) {
      const sessionOpenedRef = { current: false };
      const heardAgentRef = { current: true };
      const diagRef = { current: { sessionOpened: false, agentJoined: false } };
      const waiting: boolean[] = [];
      let cleared = 0;

      run(OPEN_CHECK, {
        sessionOpenedRef,
        diagRef,
        mode,
        msg: STOP,
        opensSession,
        clearWatchdog: () => {
          cleared += 1;
        },
        setWaitingForTutor: (v: boolean) => waiting.push(v),
        trace: () => {},
      });
      assert.equal(sessionOpenedRef.current, true, `${mode}: a stop does not count as the session having opened`);
      assert.equal(diagRef.current.sessionOpened, true, `${mode}: the diagnostics call a stopped session one that never started`);
      assert.equal(cleared, 1, `${mode}: the watchdog is still running behind a session that has ended`);
      assert.deepEqual(waiting, [false], `${mode}: the screen still says it is waiting for a tutor that has answered`);

      const fired: string[] = [];
      const timers: (() => void)[] = [];
      run(`${WATCHDOG};`, {
        watchdogRef: { current: [] },
        READY_RETRIES_MS: constant(hook, 'READY_RETRIES_MS'),
        AGENT_JOIN_TIMEOUT_MS: constant(hook, 'AGENT_JOIN_TIMEOUT_MS'),
        SESSION_OPEN_TIMEOUT_MS: constant(hook, 'SESSION_OPEN_TIMEOUT_MS'),
        setTimeout: (fire: () => void) => timers.push(fire),
        heardAgentRef,
        sessionOpenedRef,
        diagRef,
        send: (m: { t: string }) => fired.push(`send:${m.t}`),
        trace: () => {},
        giveUp: (failure: string) => fired.push(`giveUp:${failure}`),
      });
      assert.equal(timers.length, 5, `${mode}: the watchdog is not three retries and two deadlines any more`);
      for (const fire of timers) fire();
      assert.deepEqual(fired, [], `${mode}: the watchdog left the room and replaced the stop with an error screen`);
    }
  });
});

describe('the native WebRTC shim, before the microphone is judged — F211', () => {
  // On a phone there is no `navigator.mediaDevices` until `registerGlobals()`
  // has run, and `ensureLiveKitGlobals` is the only thing in the app that runs
  // it. So the order of these two statements decides whether a spoken session
  // can start at all. A browser has mediaDevices already, which is why web
  // never sees this and why the test supplies the native world by hand.
  const world = (installed: { yes: boolean }): Record<string, unknown> => ({
    mode: 'lesson' as LiveMode,
    modeCarriesAudio,
    ensureLiveKitGlobals: () => {
      installed.yes = true;
    },
    micApiUnavailable: () => !installed.yes,
  });

  test('the WebRTC globals are installed before the hook asks whether a microphone exists', () => {
    const installed = { yes: false };
    assert.doesNotThrow(
      () => run(MIC_PREFLIGHT, world(installed)),
      'a spoken session refuses a working microphone when the guard runs before the shim that installs it',
    );
    assert.ok(installed.yes, 'the shim never ran, so the guard was answered by whatever the platform happened to have');
  });

  test('a device the shim cannot give a microphone is still refused', () => {
    // The control. Without it the test above would pass just as well if the
    // guard had been deleted rather than reordered.
    assert.throws(
      () => run(MIC_PREFLIGHT, { ...world({ yes: false }), ensureLiveKitGlobals: () => {} }),
      /mediaDevices/,
      'a spoken session with no microphone API must still not connect',
    );
  });
});

describe("the hook's audio path, per mode — F140", () => {
  test('both quiet modes connect without a microphone API and never publish one', async () => {
    assert.equal(AUDIO_BLOCKS.length, 2, 'the hook asks the mode table twice: for the audio session, and again at connect');

    const table: Record<LiveMode, { audio: boolean; mic: boolean }> = {
      lesson: { audio: true, mic: true },
      convo: { audio: true, mic: false },
      'convo-text': { audio: false, mic: false },
      'lesson-text': { audio: false, mic: false },
    };

    for (const mode of MODES) {
      const want = table[mode];

      // The guard that runs before anything else, on a device with no
      // microphone API at all. This is the learner the quiet modes exist for.
      const guard = (): void => {
        run(MIC_API_GUARD, { mode, modeCarriesAudio, micApiUnavailable: () => true });
      };
      if (want.audio) assert.throws(guard, /mediaDevices/, `${mode}: a spoken session with no microphone API must not connect`);
      else assert.doesNotThrow(guard, `${mode}: refused on a device with no microphone, and it never wanted one`);

      // And the audio itself, on a device that has one.
      const sessions: number[] = [];
      const published: boolean[] = [];
      const played: number[] = [];
      const micOpen: boolean[] = [];
      const diagRef = { current: { micPublished: false } };

      await runAsync(AUDIO_BLOCKS.join('\n'), {
        mode,
        modeCarriesAudio,
        micOpensAtConnect,
        ensureAudioSession: () => {
          sessions.push(1);
          return Promise.resolve();
        },
        room: {
          localParticipant: {
            setMicrophoneEnabled: (on: boolean) => {
              published.push(on);
              return Promise.resolve();
            },
          },
          startAudio: () => {
            played.push(1);
            return Promise.resolve();
          },
          canPlaybackAudio: true,
        },
        diagRef,
        setMicOpen: (v: boolean) => micOpen.push(v),
        setAudioBlocked: () => {},
      });

      assert.equal(sessions.length, want.audio ? 1 : 0, `${mode}: the audio session is taken by a mode that carries no audio`);
      assert.equal(played.length, want.audio ? 1 : 0, `${mode}: playback started for a mode with nothing to play`);
      assert.deepEqual(published, want.mic ? [true] : [], `${mode}: a microphone was published against the mode table`);
      assert.equal(diagRef.current.micPublished, want.mic, `${mode}: the diagnostics disagree with the microphone`);
      assert.deepEqual(micOpen, want.mic ? [true] : [], `${mode}: the circle is told a microphone opened that did not`);
    }
  });
});

/* ------------------------------------------------------------------------- *
 * Wave 2: a blip, an absent tutor, the quiet door, and a dead pipeline.
 * ------------------------------------------------------------------------- */

/**
 * The three events livekit-client publishes on the way through an outage, each
 * lifted with its handler and made a statement again.
 *
 * `fragment` throws if the hook stops subscribing to one of them, which is the
 * first half of what F195 is about: the handler that was missing was missing
 * entirely, and nothing anywhere said so.
 */
const RECONNECT_HANDLERS = ['SignalReconnecting', 'Reconnecting', 'Reconnected']
  .map((event) => `${fragment(hook, `room.on(RoomEvent.${event}, () => {`)});`)
  .join('\n');

const DISCONNECTED_HANDLER = `${fragment(hook, 'room.on(RoomEvent.Disconnected, () => {')});`;
const GIVE_UP = fragment(hook, 'const giveUp = (failure: LiveFailure) => {');
const ABANDON = fragment(hook, 'async function abandonSession(userId: string, sessionId: string): Promise<void> {');
const SWITCH_TO_TEXT = insideOf(hook, 'const switchToText = useCallback((): boolean => {');
const OPEN_MIC = insideOf(hook, 'const openMic = useCallback(() => {');

/** A real account and a real grant's session, both shaped as the server insists. */
const UID = '44444444-4444-4444-8444-000000000002';
const SESSION_ID = '55555555-5555-4555-8555-000000000003';

/**
 * Every failure the hook can reach, listed once. The `satisfies` is what makes
 * a seventeenth failure a typecheck error here rather than a silent hole: the
 * lease question has to be answered for it too.
 */
const EVERY_FAILURE = Object.keys({
  'voice-unavailable': true,
  'mic-denied': true,
  'mic-missing': true,
  'mic-in-use': true,
  'mic-unavailable': true,
  'server-unreachable': true,
  'server-refused': true,
  // Added on main by the connect-and-refusal work while this branch was open.
  // The exhaustive map is the point: a new failure has to be answered here.
  'rate-limited': true,
  'session-elsewhere': true,
  'sign-in-required': true,
  signal: true,
  media: true,
  'agent-absent': true,
  'agent-silent': true,
  dropped: true,
  'tutor-deaf': true,
  'tutor-mute': true,
  'tutor-stalled': true,
  'tutor-talks-over': true,
  unknown: true,
} satisfies Record<LiveFailure, true>) as LiveFailure[];

describe('a blip in the middle of a session — F195', () => {
  test('a reconnect re-sends ready and the session resumes instead of ending', () => {
    // Subscribe exactly as the hook subscribes, against livekit-client's own
    // event names. A renamed or dropped event is a handler that never runs
    // again, and the only symptom would be the bug this closes coming back.
    const subscribed = new Map<string, () => void>();
    const sent: unknown[] = [];
    const reconnecting: boolean[] = [];
    const ended: unknown[] = [];
    const voicelessRef = { current: false };

    const wire = (voiceless: boolean): void => {
      subscribed.clear();
      sent.length = 0;
      reconnecting.length = 0;
      voicelessRef.current = voiceless;
      run(RECONNECT_HANDLERS, {
        room: { on: (event: string, handler: () => void) => subscribed.set(event, handler) },
        RoomEvent,
        trace: () => {},
        setReconnecting: (v: boolean) => reconnecting.push(v),
        send: (m: unknown) => sent.push(m),
        voicelessRef,
        // The ownership guard main added while this branch was open. A reconnect
        // belongs to the session on screen, so it answers true here; the tests
        // that prove a stale start cannot act live in startOwnership.test.ts.
        owns: () => true,
        // Supplied so that a handler which ever reaches for one of these is a
        // failure here. A blip is not an ending, it does not stand the watchdog
        // down, and — slice 1's rule — it cannot touch the safety decision.
        fail: (failure: LiveFailure) => ended.push(failure),
        setStatus: (s: unknown) => ended.push(s),
        clearWatchdog: () => ended.push('clearWatchdog'),
        setSafety: (s: unknown) => ended.push(s),
      });
    };

    wire(false);
    assert.deepEqual(
      [...subscribed.keys()],
      [RoomEvent.SignalReconnecting, RoomEvent.Reconnecting, RoomEvent.Reconnected],
      'the hook does not subscribe to all three reconnect events, so a blip is invisible until the client gives up',
    );

    subscribed.get(RoomEvent.SignalReconnecting)!();
    assert.deepEqual(reconnecting, [true], 'the signal channel went away and the screen carried on looking live');
    assert.deepEqual(sent, [], 'nothing can be published while the signal channel is down, so nothing should try');

    subscribed.get(RoomEvent.Reconnecting)!();
    assert.deepEqual(reconnecting, [true, true], 'the whole connection went away and the screen still said nothing');

    subscribed.get(RoomEvent.Reconnected)!();
    assert.deepEqual(reconnecting, [true, true, false], 'the connection came back and the screen is still apologising for it');
    assert.deepEqual(
      sent,
      [{ t: 'ready' }],
      'nothing re-sent ready, so the agent replay path built for exactly this is never triggered and the session is lost',
    );
    // And it is a frame the agent will actually read, not merely an object.
    assert.deepEqual(decodeClientMessage(encodeMessage(sent[0] as never)), { t: 'ready' });

    // The quiet door, taken before the blip. The agent holds its own voiceless
    // flag, but the frame that set it may have been published into the outage
    // that caused this, and a tutor talking aloud at somebody who asked for
    // quiet is the one half of this pair that waiting does not fix.
    wire(true);
    subscribed.get(RoomEvent.Reconnected)!();
    assert.deepEqual(
      sent,
      [{ t: 'ready' }, { t: 'mode', voiceless: true }],
      'a session that had gone quiet came back speaking, because only ready was re-sent',
    );
    assert.deepEqual(decodeClientMessage(encodeMessage(sent[1] as never)), { t: 'mode', voiceless: true });

    assert.deepEqual(ended, [], 'a reconnect ended the session, stood the watchdog down, or wrote the safety state');

    // The drop is still a drop. livekit-client only reaches Disconnected once it
    // has given up reconnecting, and that is still the one path to an error.
    let dropped: unknown = null;
    const disconnect = new Map<string, () => void>();
    run(DISCONNECTED_HANDLER, {
      room: { on: (event: string, handler: () => void) => disconnect.set(event, handler) },
      RoomEvent,
      owns: () => true,
      clearWatchdog: () => {},
      setReconnecting: () => {},
      setStatus: (update: (s: unknown) => unknown) => {
        dropped = update({ phase: 'live' });
      },
      failureCopy,
    });
    disconnect.get(RoomEvent.Disconnected)!();
    assert.deepEqual(
      dropped,
      { phase: 'error', failure: 'dropped', message: failureCopy('dropped').message, canType: failureCopy('dropped').canType },
      'a connection that never came back no longer tells the learner anything',
    );
  });
});

describe('the tutor that never arrived — F196', () => {
  test('giving up on an absent tutor frees the account to try again now', async () => {
    // The give-up path, once for every failure it can be handed. Only one of
    // them may hand the lease back: 'agent-silent' means an agent IS in the room
    // and may still be holding the floor, and freeing a lease out from under a
    // live session is how one account comes to run two.
    for (const failure of EVERY_FAILURE) {
      const abandoned: unknown[][] = [];
      const left: number[] = [];
      const failed: LiveFailure[] = [];
      run(`${GIVE_UP};\ngiveUp(which);`, {
        which: failure,
        abandonSession: (...args: unknown[]) => {
          abandoned.push(args);
          return Promise.resolve();
        },
        userId: UID,
        grant: { token: 'jwt', livekitUrl: 'wss://example', sessionId: SESSION_ID },
        leave: () => {
          left.push(1);
          const lease = unjoinedLease(SESSION_ID, id => { abandoned.push([UID, id]); });
          if (failure !== 'agent-absent') lease.observeTutor();
          lease.release();
          return Promise.resolve();
        },
        fail: (f: LiveFailure) => failed.push(f),
      });

      assert.deepEqual(failed, [failure], `${failure}: the learner is no longer told what happened`);
      assert.deepEqual(left, [1], `${failure}: the room is left open behind the error screen, and the meter is still counting`);
      if (failure === 'agent-absent') {
        assert.deepEqual(
          abandoned,
          [[UID, SESSION_ID]],
          'the tutor never came, and the account is still locked out of its own next attempt for thirty minutes',
        );
      } else {
        assert.deepEqual(abandoned, [], `${failure}: released a lease that may still belong to a live session`);
      }
    }

    // The release itself. It is the one lease call the app makes, so what it
    // sends is worth pinning: the account's own bearer token, the sessionId the
    // server compares before it releases anything, and nothing else at all.
    const calls: { url: string; init: Record<string, unknown> }[] = [];
    await runAsync(`${ABANDON}\nreturn abandonSession(userId, sessionId);`, {
      userId: UID,
      sessionId: SESSION_ID,
      TOKEN_SERVER: 'https://tokens.example',
      authHeaders: () => Promise.resolve({ authorization: 'Bearer account-token' }),
      loadConsent: async () => null,
      analyticsAllowed: () => false,
      fetch: (url: string, init: Record<string, unknown>) => {
        calls.push({ url, init });
        return Promise.resolve({ status: 200 });
      },
      trace: () => {},
    });

    assert.equal(calls.length, 1, 'the lease is never handed back, so the learner is refused by their own dead session');
    assert.equal(calls[0]!.url, 'https://tokens.example/session/abandon');
    assert.equal(calls[0]!.init.method, 'POST');
    assert.deepEqual(
      JSON.parse(calls[0]!.init.body as string),
      { userId: UID, sessionId: SESSION_ID },
      'the sessionId is what the server compares before releasing, and without it nothing is freed',
    );
    assert.equal(
      (calls[0]!.init.headers as Record<string, string>).authorization,
      'Bearer account-token',
      'the release is authenticated as the account, or the server cannot tell whose lease this is',
    );
    assert.doesNotMatch(
      ABANDON,
      /session\/end|seconds|debit|x-luvani-agent|AGENT_SECRET/,
      'this call releases a lease and does nothing else, which is the whole reason it is safe to make from a phone',
    );

    // The sessionId comes off the grant, and the grant has to carry it. This
    // hop is a cast, so the source is the only place it can be checked.
    assert.match(
      hook,
      /const grant = \(await res\.json\(\)\) as \{ token: string; livekitUrl: string; sessionId: string \}/,
      'the grant stopped carrying the sessionId, so the release has nothing to name and frees nothing',
    );

    // And a release that itself fails is swallowed. It runs while the learner is
    // already reading an error, and a second one would only make the first wrong.
    await runAsync(`${ABANDON}\nreturn abandonSession(userId, sessionId);`, {
      userId: UID,
      sessionId: SESSION_ID,
      TOKEN_SERVER: 'https://tokens.example',
      authHeaders: () => Promise.resolve({}),
      loadConsent: async () => null,
      analyticsAllowed: () => false,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
      trace: () => {},
    });
  });
});

describe('a grant that never reached a tutor hands its lease back — F165', () => {
  test('a grant nobody joins does not hold the session lease for half an hour', () => {
    // A grant takes a thirty-minute lease before anyone joins the room, and only
    // the agent's /session/end gives it back. The give-up watchdog hands it back
    // for a tutor that joined an empty room (F196), but two paths never reach it:
    // a connect that throws, and a start walked away from before a tutor joined.
    // Both used to keep the lease, and the learner was refused their own next
    // session for half an hour by one that never happened.

    // The production release helper runs against the real attempt-owned lease.
    // Calling it twice must still abandon an unjoined grant exactly once.
    const RELEASE = fragment(hook, 'const releaseHeldLease = (): void => {');
    const released = (held: string | null, agentJoined: boolean, heardAgent: boolean): unknown[][] => {
      const abandoned: unknown[][] = [];
      run(`${RELEASE}\nreleaseHeldLease();\nreleaseHeldLease();`, {
        ownedLease: held === null ? null : (() => {
          const lease = unjoinedLease(held, id => { abandoned.push([UID, id]); });
          if (agentJoined || heardAgent) lease.observeTutor();
          return lease;
        })(),
        leaseRef: { current: null },
        diagRef: { current: { agentJoined } },
        heardAgentRef: { current: heardAgent },
        userId: UID,
        abandonSession: (...args: unknown[]) => {
          abandoned.push(args);
          return Promise.resolve();
        },
      });
      return abandoned;
    };

    // No tutor in the room: the lease is handed back, with the account and the
    // grant's own sessionId, and exactly once.
    assert.deepEqual(
      released(SESSION_ID, false, false),
      [[UID, SESSION_ID]],
      'a grant nobody joined kept its lease, so every retry 409s for half an hour',
    );
    // A tutor has taken the room: not ours to free. Freeing a lease out from
    // under a live tutor is how one account comes to run two.
    assert.deepEqual(released(SESSION_ID, true, false), [], 'a lease was freed under a tutor that had already joined');
    assert.deepEqual(released(SESSION_ID, false, true), [], 'a lease was freed while an agent was already talking to us');
    // Nothing granted yet: nothing to free.
    assert.deepEqual(released(null, false, false), [], 'an attempt that never took a grant tried to hand one back');

    // Wired, not merely written. The release is useless if nothing calls it: the
    // catch a failed connect lands in, and the stand-down an abandoned start
    // takes, both hand the lease back before they end.
    const CATCH = fragment(hook, '} catch (err) {');
    assert.match(
      CATCH,
      /releaseHeldLease\(\);\s*\n\s*fail\(classifyFailure\(err\)\)/,
      'a session that failed to connect never hands its lease back, so the learner is locked out of their own next one',
    );
    const ABANDONED = fragment(hook, 'const abandoned = async (): Promise<boolean> => {');
    assert.match(
      ABANDONED,
      /releaseHeldLease\(\);\s*\n\s*return true;/,
      'a start walked away from after its grant keeps the lease it took',
    );
    // The sessionId it hands back is the grant's own, taken the moment it arrives.
    assert.match(hook, /ownedLease = unjoinedLease\(grant\.sessionId,/, 'the release has no sessionId to name, so it frees nothing');
  });
});

describe('the quiet door, mid-session — F200', () => {
  test('switching to text keeps the room, stops the microphone and needs no new grant', () => {
    const published: boolean[] = [];
    const sent: unknown[] = [];
    const micOpen: boolean[] = [];
    const voiceless: boolean[] = [];
    const voicelessRef = { current: false };
    const diagRef = { current: { micPublished: true } };
    const statuses: unknown[] = [];
    const room = {
      localParticipant: {
        setMicrophoneEnabled: (on: boolean) => {
          published.push(on);
          return Promise.resolve();
        },
      },
    };
    const roomRef: { current: unknown } = { current: room };

    const switched = run(SWITCH_TO_TEXT, {
      roomRef,
      terminalFailureRef: { current: false },
      voicelessRef,
      setVoiceless: (v: boolean) => voiceless.push(v),
      diagRef,
      setMicOpen: (v: boolean) => micOpen.push(v),
      send: (m: unknown) => sent.push(m),
      setStatus: (update: (s: unknown) => unknown) => statuses.push(update),
      trace: () => {},
    });

    assert.equal(switched, true, 'the switch reported failure in a room that was right there, and the caller will rebuild');
    assert.equal(roomRef.current, room, 'the room was torn down, which is the rebuild this exists to replace');
    assert.deepEqual(published, [false], 'the microphone is still publishing after the learner asked to stop speaking');
    assert.deepEqual(micOpen, [false], 'the circle still reads as an open microphone');
    assert.equal(diagRef.current.micPublished, false, 'the diagnostics still claim a microphone nobody is speaking into');
    assert.equal(voicelessRef.current, true, 'the handler cannot tell this session has gone quiet, so it will still shout about audio');
    assert.deepEqual(voiceless, [true], 'the screens were never told, so the typed row never appears');

    assert.deepEqual(sent, [{ t: 'mode', voiceless: true }], 'the agent was never told, so the tutor keeps speaking at a learner who is typing');
    assert.deepEqual(
      decodeClientMessage(encodeMessage(sent[0] as never)),
      { t: 'mode', voiceless: true },
      'the agent reads this frame strictly and would drop it, and a dropped frame moves nothing',
    );

    // The whole point: no token, no grant, no second room. The rebuild this
    // replaces asked the token server for a session while the first one's
    // thirty-minute lease was still standing, and the learner was refused for
    // taking a door the app had just offered them.
    assert.doesNotMatch(
      SWITCH_TO_TEXT,
      /fetch\(|TOKEN_SERVER|session\/start|new Room\(|\.connect\(|start\(\)/,
      'the switch asks for a new grant, and the lease it is already holding will refuse it',
    );

    // The error screen is cleared on the way through, because a blocking vendor
    // failure leaves the room open exactly so this door works.
    assert.equal(statuses.length, 1, 'the screen is left on the failure it just offered a way out of');
    const update = statuses[0] as (s: unknown) => unknown;
    assert.deepEqual(
      update({ phase: 'error', failure: 'tutor-deaf', message: 'x', canType: true }),
      { phase: 'live' },
      'the learner tapped "Continue by typing" and stayed on the error screen they were escaping',
    );
    const live = { phase: 'live' };
    assert.equal(update(live), live, 'a session that was already live was re-rendered for nothing');

    // A microphone that will not close is not a reason to keep the learner
    // speaking into it: the frame still goes, and the switch still happened.
    const stubborn: unknown[] = [];
    const refused = run(SWITCH_TO_TEXT, {
      terminalFailureRef: { current: false },
      roomRef: {
        current: {
          localParticipant: { setMicrophoneEnabled: () => Promise.reject(new Error('device busy')) },
        },
      },
      voicelessRef: { current: false },
      setVoiceless: () => {},
      diagRef: { current: { micPublished: true } },
      setMicOpen: () => {},
      send: (m: unknown) => stubborn.push(m),
      setStatus: () => {},
      trace: () => {},
    });
    assert.equal(refused, true, 'a microphone that would not close took the quiet door away with it');
    assert.deepEqual(stubborn, [{ t: 'mode', voiceless: true }]);

    // No room at all: a session that failed before it ever connected. Nothing
    // here can help, and saying so is what lets the caller open a typed session
    // properly instead of believing this one carried on.
    const orphan: unknown[] = [];
    const cold = run(SWITCH_TO_TEXT, {
      roomRef: { current: null },
      voicelessRef: { current: false },
      setVoiceless: () => {},
      startGenRef: { current: 1 },
      noTypedRecovery: false,
      diagRef: { current: { micPublished: false } },
      setMicOpen: () => {},
      send: (m: unknown) => orphan.push(m),
      setStatus: () => {},
      trace: () => {},
    });
    assert.equal(cold, false, 'the switch claimed a session that does not exist, and the caller will never rebuild one');
    assert.deepEqual(orphan, [], 'a mode frame was published into a room that is not there');
  });

  test('tapping the circle after the quiet door asks the tutor to speak again', async () => {
    // Publishing a microphone IS asking to speak. A tutor left voiceless would
    // answer in silence for the rest of the session, with nothing on the screen
    // to say why, which is the quiet door as a one-way trip.
    const openMicWorld = (voicelessRef: { current: boolean }, sent: unknown[]): Record<string, unknown> => ({
      roomRef: {
        current: {
          localParticipant: {
            isMicrophoneEnabled: false,
            setMicrophoneEnabled: () => Promise.resolve(),
          },
        },
      },
      startGenRef: { current: 1 },
      noTypedRecovery: false,
      diagRef: { current: { micPublished: false } },
      trace: () => {},
      setMicOpen: () => {},
      voicelessRef,
      setVoiceless: () => {},
      send: (m: unknown) => sent.push(m),
      setNotice: () => {},
      noticeTimer: { current: null as unknown },
      setTimeout: () => 0,
      clearTimeout: () => {},
    });

    const back: unknown[] = [];
    const quiet = { current: true };
    run(OPEN_MIC, openMicWorld(quiet, back));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(back, [{ t: 'mode', voiceless: false }], 'the learner went back to speaking and the tutor stayed silent for good');
    assert.equal(quiet.current, false, 'the session still believes it is quiet, so an audio failure it can feel would be hidden');

    const ordinary: unknown[] = [];
    const speaking = { current: false };
    run(OPEN_MIC, openMicWorld(speaking, ordinary));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(ordinary, [], 'an ordinary first tap now publishes a mode frame nobody asked for');
  });
});

describe('half the tutor stops working mid-session — F198, the rendering half', () => {
  test('a dead pipeline reaches the failure screen and a blip stays in the session', () => {
    const frame = (kind: string | undefined, recoverable: boolean | undefined) => ({
      t: 'error',
      message: 'The tutor lost its voice for a moment.',
      ...(kind !== undefined ? { kind } : {}),
      ...(recoverable !== undefined ? { recoverable } : {}),
    });

    // A dead recogniser, in a spoken conversation. The learner is talking to
    // something that will never answer while the meter runs, and a notice that
    // clears itself after eight seconds is exactly the frame this replaces.
    const deaf = switchWorld();
    deliver(deaf.world, frame('stt_error', false));
    assert.deepEqual(deaf.seen.failed, ['tutor-deaf'], 'a dead pipeline is still shown as a passing blip');
    assert.deepEqual(deaf.seen.notices, [], 'the outage went out as a notice, which takes itself away and leaves the learner talking to nothing');
    assert.deepEqual(deaf.seen.timers, [], 'an outage was given the notice timer, and it will clear itself off the screen');
    assert.equal(deaf.seen.left, 0, 'the room was closed on a failure the learner can carry on typing through');
    assert.deepEqual(
      deaf.seen.logs,
      ['warn [luvani] TUTOR_PIPELINE_DOWN kind=stt_error recoverable=no mode=spoken shown=blocking'],
      'a vendor half of the tutor went down and the alarm line is not on the console at the level that gets noticed',
    );

    // The reply itself failing. There is no typed door onto the same wall, so
    // there is nothing left to stay in the room for, and a room the learner
    // cannot use is a room the meter must not go on counting.
    const stalled = switchWorld();
    deliver(stalled.world, frame('llm_error', false));
    assert.deepEqual(stalled.seen.failed, ['tutor-stalled']);
    assert.equal(failureCopy('tutor-stalled').canType, false, 'this test is no longer about the failure with no way forward');
    assert.equal(stalled.seen.left, 1, 'the tutor cannot answer and the room is still open, still connected, and still being charged for');

    // A blip. The room, the microphone and the meter are all still running, and
    // replacing the session with a dead-end screen would lose the conversation.
    const blip = switchWorld();
    deliver(blip.world, frame('tts_error', true));
    assert.deepEqual(blip.seen.failed, [], 'a hiccup that is coming back took the whole session away');
    assert.equal(blip.seen.left, 0, 'a hiccup that is coming back ended the room');
    assert.equal(blip.seen.notices.length, 1, 'the learner was told nothing at all about a voice that just went');
    assert.notEqual(blip.seen.notices[0], frame('tts_error', true).message, 'the agent sentence is shown raw, so all five kinds still read alike');
    assert.deepEqual(blip.seen.timers.map((t) => t.ms), [8000], 'the notice no longer clears itself, and that part was right');
    assert.deepEqual(blip.seen.logs, ['info [luvani:live] pipeline kind=tts_error recoverable=yes mode=spoken shown=notice']);

    // A typed session carries no audio in either direction, so an audio failure
    // in one is invisible by construction. Telling somebody who is typing that
    // their microphone failed is the whole reason `spoken` is not defaulted.
    const typed = switchWorld(null, { mode: 'convo-text' });
    deliver(typed.world, frame('stt_error', false));
    assert.deepEqual(typed.seen.failed, [], 'a learner who is typing was shown a microphone failure they cannot possibly have');
    assert.deepEqual(typed.seen.notices, [], 'a learner who is typing was interrupted by a failure they cannot feel');
    assert.equal(typed.seen.left, 0, 'a typed session was ended by an audio failure that cannot reach it');
    assert.deepEqual(typed.seen.logs, ['info [luvani] TUTOR_PIPELINE_DOWN kind=stt_error recoverable=no mode=typed shown=silent']);

    // And the same thing again for a session that STARTED spoken and has since
    // taken the quiet door. This is the learner who took that door because the
    // tutor went deaf; the next frame from the same dead vendor must not take
    // the conversation they moved to away from them.
    const switched = switchWorld(null, { mode: 'convo', voiceless: true });
    deliver(switched.world, frame('stt_error', false));
    assert.deepEqual(
      switched.seen.failed,
      [],
      'a learner who took the quiet door was thrown out by the very outage they took it for',
    );
    assert.deepEqual(switched.seen.notices, []);
    assert.deepEqual(switched.seen.logs, ['info [luvani] TUTOR_PIPELINE_DOWN kind=stt_error recoverable=no mode=typed shown=silent']);

    // An agent older than the kinds sends neither field, and a session hitting
    // its time limit sends a bare error too. Both keep today's behaviour.
    const bare = switchWorld();
    deliver(bare.world, frame(undefined, undefined));
    assert.deepEqual(bare.seen.failed, [], 'a frame with nothing to classify took the session away on a guess');
    assert.deepEqual(bare.seen.notices, [frame(undefined, undefined).message], 'the only honest sentence available is no longer shown');

    // A kind with no flag is not a licence to guess either.
    const unsure = switchWorld();
    deliver(unsure.world, frame('stt_error', undefined));
    assert.deepEqual(unsure.seen.failed, [], 'a missing recoverable flag was read as an outage, and a live conversation was lost to it');
    assert.equal(unsure.seen.notices.length, 1);
  });
});

describe('the voice the learner chose, on its way to the agent — F291', () => {
  /**
   * The `/session/start` body, lifted out of the hook exactly as the hook
   * writes it and run against supplied free names.
   *
   * Same technique as the fragments above and for the same reason: this hook
   * cannot be imported here at all, and matching a string would pass just as
   * happily for a field that is spelled and never sent. Every name the
   * expression reaches for is handed in, so a body that grows a dependency this
   * harness has not thought about throws a ReferenceError rather than quietly
   * agreeing.
   */
  function startBody(world: Record<string, unknown>): Record<string, unknown> {
    const source = read('./useLiveSession.ts');
    // Anchored on the route, because the hook posts two bodies and the other
    // one is /session/abandon. Getting that wrong is how this harness would
    // report on a request nobody asked about.
    const route = source.indexOf('/session/start');
    assert.ok(route >= 0, 'the hook no longer starts a session');
    const at = source.indexOf('body: JSON.stringify({', route);
    assert.ok(at >= 0, 'the session start no longer builds a body');
    const open = source.indexOf('{', source.indexOf('JSON.stringify(', at));
    let depth = 0;
    let expression = '';
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          expression = source.slice(open, i + 1);
          break;
        }
      }
    }
    assert.ok(expression.length > 0, 'the body object is never closed');
    const names = Object.keys(world);
    const run = new Function(...names, `"use strict"; return (${expression});`) as (
      ...args: unknown[]
    ) => Record<string, unknown>;
    return run(...names.map((name) => world[name]));
  }

  const world = (chosen: string | undefined): Record<string, unknown> => ({
    userId: 'u1',
    consent: null,
    analyticsAllowed: () => false,
    lessonId: 'convo-01',
    startRung: undefined,
    mode: 'convo',
    snapshot: undefined,
    seedTopic: undefined,
    continuationPackId: undefined,
    missionId: undefined,
    tutorVoice: chosen,
    DEFAULT_TUTOR_VOICE,
  });

  test('every session start sends the chosen voice, and the default when none is chosen', () => {
    // Chosen. The key travels, never a vendor id: the ids live in the agent,
    // which is the only process holding the account that bills for them.
    const chosen = startBody(world('marie'));
    assert.equal(chosen.tutorVoice, 'marie', 'the learner picked a voice and the session opened in somebody else');
    assert.ok(isTutorVoiceKey(chosen.tutorVoice), 'what rides the wire is not one of our keys');

    // Unchosen, which is the ordinary state of a new account. The default is
    // SENT rather than left out, and that is the whole of F291: the app has a
    // picker and the agent has a fallback, and an absent field would leave the
    // two agreeing only by coincidence about who "unchosen" means.
    const unchosen = startBody(world(undefined));
    assert.ok(
      Object.hasOwn(unchosen, 'tutorVoice'),
      'an unchosen voice sends no field, so the app and the agent are each free to pick a different person',
    );
    assert.equal(unchosen.tutorVoice, DEFAULT_TUTOR_VOICE);
    assert.equal(unchosen.tutorVoice, chosen.tutorVoice === 'marie' ? DEFAULT_TUTOR_VOICE : unchosen.tutorVoice);

    // Nothing else about the body moved. seedTopic and missionId stay absent
    // when they have nothing to say, which is what tells them apart from this.
    assert.ok(!Object.hasOwn(unchosen, 'missionId'), 'a session with no mission started sending one');
    assert.ok(!Object.hasOwn(unchosen, 'seedTopic'), 'a session with no seed started sending one');
    assert.equal(unchosen.userId, 'u1');
    assert.equal(unchosen.lessonId, 'convo-01');

    // And both live screens hand it in. A hook that always sends the field is
    // no use if the screens never fill it: the default would then be sent for
    // every learner, including the ones who chose.
    for (const screen of ['../ConvoScreen.tsx', '../LiveSessionScreen.tsx']) {
      const source = read(screen);
      const call = source.slice(source.indexOf('useLiveSession('), source.indexOf('useLiveSession(') + 900);
      assert.match(
        call,
        /tutorVoice: tutorVoiceOf\(profile\)/,
        `${screen} opens a session without the chosen voice, so the picker changes nothing on this surface`,
      );
    }
  });
});

describe('the session id the hook exposes, for source-linked history', () => {
  const HOOK = read('./useLiveSession.ts');

  test('the id is cleared by every start and published only from an owned grant', () => {
    const startAt = HOOK.indexOf('const start = useCallback(async () => {');
    assert.ok(startAt > 0, 'the start callback moved; this test is stale');
    const start = HOOK.slice(startAt, HOOK.indexOf('const room = new Room();', startAt));
    const cleared = start.indexOf('setSessionId(null);');
    const fetched = start.indexOf('/session/start');
    const granted = start.indexOf('ownedLease = unjoinedLease(grant.sessionId,');
    const published = start.indexOf('setSessionId(typeof grant.sessionId');
    assert.ok(cleared > 0 && cleared < fetched, 'a new start does not clear the last session id before asking for a grant');
    assert.ok(published > granted, 'the id is published before the grant arrives');
    const between = start.slice(granted, published);
    assert.match(between, /if \(await abandoned\(\)\) return;/, 'an abandoned start can still publish its id');
    assert.equal((HOOK.match(/setSessionId\(/g) ?? []).length, 2, 'the id is set somewhere other than the clear and the grant');
  });

  // Stage 4 (2026-09-25): a rebuilt session is a new session, so the last
  // session's view must not survive into it. Without this, the typed-door
  // rebuild would publish the new grant's id while `convo` still held the old
  // room's view, and ConvoScreen's goal-step and revisit effects would record
  // the new id before the new room was real.
  test('every start clears the last view before it asks for a grant, and nothing else clears it — Stage 4', () => {
    const startAt = HOOK.indexOf('const start = useCallback(async () => {');
    assert.ok(startAt > 0, 'the start callback moved; this test is stale');
    const start = HOOK.slice(startAt, HOOK.indexOf('const room = new Room();', startAt));
    const cleared = start.indexOf('setConvo(null);');
    const fetched = start.indexOf('/session/start');
    const published = start.indexOf('setSessionId(typeof grant.sessionId');
    assert.ok(cleared > 0, 'a new start keeps the last session\'s view, so a rebuilt room reads as open before it is');
    const code = start.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ');
    assert.match(code, /setTurns\(\[\]\); setConvo\(null\);/, 'the view is cleared somewhere other than beside the turns it belongs with');
    assert.ok(cleared < fetched && cleared < published, 'the view is cleared after the grant, so the new id can meet the old view');
    // Exactly the two sites: the clear here and the view the agent publishes.
    assert.equal((HOOK.match(/setConvo\(/g) ?? []).length, 2, 'the view is set somewhere other than the clear and the published view');
    assert.match(HOOK, /setConvo\(msg\.view\);/, 'the published view no longer reaches convo');
  });

  test('the hook returns the id read-only, and the interface says what it does not prove', () => {
    const iface = HOOK.slice(HOOK.indexOf('export interface LiveSession {'), HOOK.indexOf('export function useLiveSession('));
    assert.match(iface, /sessionId: string \| null;/);
    const returned = HOOK.slice(HOOK.lastIndexOf('  return {'));
    assert.match(returned, /\n\s+sessionId,\n/, 'the hook does not return the session id');
  });
});


test('a terminal service failure keeps settlement pending until the server acknowledgement', () => {
  const { world, seen } = switchWorld();
  const settlements: unknown[] = [];
  world.setSettlement = (value: unknown) => settlements.push(value);
  deliver(world, { t: 'error', message: 'Tutor stopped', kind: 'llm_error', recoverable: false, terminal: true });
  assert.deepEqual(settlements, [{ kind: 'pending' }]);
  assert.equal(seen.left, 0, 'leaving early would lose the worker acknowledgement');
  const ack = { kind: 'not-charged' as const, refundedSeconds: 0, secondsRemaining: 1800, plan: 'trial' as const };
  deliver(world, { t: 'settlement', result: ack });
  assert.deepEqual(settlements, [{ kind: 'pending' }, ack]);
  assert.equal(seen.timers.length, 0, 'settlement must not disappear like a transient notice');
  assert.equal(run(SWITCH_TO_TEXT, { roomRef: { current: {} }, terminalFailureRef: { current: true } }), false, 'a closed failed room cannot be reused for typing');
});


test('optional can-do wire evidence is fenced by current issued session, mission, reset and terminal stop', () => {
  const built = switchWorld();const received: unknown[] = [];
  const evidenceSessionRef = { current: '11111111-1111-4111-8111-111111111111' as string | null };
  const terminalFailureRef = { current: false };
  const world = { ...built.world, evidenceSessionRef, terminalFailureRef, setCanDoEvidence: (value: unknown) => received.push(value) };
  const evidence = { sessionId: evidenceSessionRef.current, missionId: 'mission:premier-cafe', sourceId: 'accepted-1', beatId: 'greet-and-order', quote: 'Un café, merci.' };
  deliver(world, {t:'can-do-evidence', evidence});assert.equal(received.length,1);
  deliver(world, {t:'can-do-evidence', evidence:{...evidence,sessionId:'other'}});
  deliver(world, {t:'can-do-evidence', evidence:{...evidence,missionId:'other'}});assert.equal(received.length,1);
  terminalFailureRef.current = true;deliver(world, {t:'can-do-evidence',evidence});assert.equal(received.length,1);
  terminalFailureRef.current = false;evidenceSessionRef.current = null;deliver(world, {t:'can-do-evidence',evidence});assert.equal(received.length,1);
  const reset = fragment(hook, 'useEffect(() => onUserScopeReset(() => {');
  assert.ok(reset.includes('setCanDoEvidence(null)'));assert.ok(reset.includes('evidenceSessionRef.current = null'));
});

 test('Walk closes a typed-recoverable blocking failure instead of keeping the meter running', () => {
  const walk = switchWorld(); walk.world.noTypedRecovery = true;
  deliver(walk.world, { t: 'error', message: 'recognition unavailable', kind: 'stt_error', recoverable: false });
  assert.equal(walk.seen.left, 1); assert.deepEqual(walk.seen.failed, ['tutor-deaf']);
});

 test('Walk microphone failure is acknowledged and ends the unusable room', async () => {
  const failed: LiveFailure[] = []; let left = 0; const notices: string[] = [];
  const result = await run(`${OPEN_MIC}`, {
    roomRef: { current: { localParticipant: { isMicrophoneEnabled: false, setMicrophoneEnabled: async () => { throw new Error('Permission denied'); } } } },
    startGenRef: { current: 1 }, noTypedRecovery: true, trace: () => {},
    leave: async () => { left++; }, fail: (failure: LiveFailure) => failed.push(failure), classifyFailure,
    setNotice: (text: string) => notices.push(text), noticeTimer: { current: null },
  });
  assert.equal(result, false); assert.equal(left, 1); assert.equal(failed.length, 1); assert.deepEqual(notices, []);
});


/* ------------------------------------------------------------------------- *
 * F763: the microphone at the recap, and the recap's moment.
 * ------------------------------------------------------------------------- */

const CLOSE_MIC_FOR_RECAP = insideOf(hook, 'const closeMicForRecap = useCallback(() => {');

/** The effect that hands the audio focus back to the recap: the body of the useEffect that asks the rule. */
function releaseEffect(source: string): string {
  const asks = source.indexOf('recapMayTakeTheAudio({');
  assert.notEqual(asks, -1, 'the hook no longer asks recapMayTakeTheAudio before it gives the hold back');
  const header = 'useEffect(() => {';
  const open = source.lastIndexOf(header, asks);
  assert.ok(open >= 0 && source.slice(open, asks).split('\n').length <= 3, 'the rule is no longer asked at the top of its own effect');
  return insideOf(source.slice(open), header);
}

describe('the microphone at the recap — F763', () => {
  test('the recap closes the microphone before it shows', async () => {
    // What happens, in order, from the recap frame arriving to the recap being drawn.
    const order: string[] = [];
    // Every close LiveKit is asked for, answered by hand in the order the test chooses.
    const closes: { confirm: () => void; refuse: (error: Error) => void }[] = [];
    const room = {
      localParticipant: {
        setMicrophoneEnabled: (on: boolean): Promise<void> => {
          order.push(`setMicrophoneEnabled(${on})`);
          return new Promise<void>((resolve, reject) => {
            closes.push({ confirm: resolve, refuse: reject });
          });
        },
        // No microphone track left to unpublish once the mute lands (F777 drives that half).
        getTrackPublication: (): undefined => undefined,
      },
    };
    const diagRef = { current: { micPublished: true } };
    const roomRef: { current: unknown } = { current: room };
    const startGenRef = { current: 1 };
    const confirmed: boolean[] = [];
    const closeWorld = {
      Track,
      roomRef,
      startGenRef,
      diagRef,
      setMicOpen: (open: boolean) => order.push(`setMicOpen(${open})`),
      setMicClosedAtRecap: (closed: boolean) => confirmed.push(closed),
      trace: () => {},
    };
    const closeMicForRecap = (): unknown => run(CLOSE_MIC_FOR_RECAP, closeWorld);
    const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

    const { world, seen } = switchWorld();
    deliver({ ...world, closeMicForRecap, setRecap: (r: unknown) => { order.push('recap shown'); seen.recaps.push(r); } }, RECAP_MSG);

    assert.deepEqual(
      order,
      ['setMicOpen(false)', 'setMicrophoneEnabled(false)', 'recap shown'],
      'the recap is drawn over a microphone that is still published, or the circle still reads it as open',
    );
    assert.equal(diagRef.current.micPublished, false, 'the diagnostics still claim a microphone after the session ended');
    assert.equal(seen.journalled.length, 1, 'closing the microphone cost the recap its journal entry');

    // Asked for is not the same as closed: until LiveKit confirms it, the room keeps the learner's ears.
    assert.deepEqual(confirmed, [], 'the close was taken as done before LiveKit said so');
    closes[0]!.confirm();
    await settle();
    assert.deepEqual(confirmed, [true], 'a confirmed close never reaches the effect that gives the recap its moment');
    confirmed.length = 0;

    // A close that fails is never reported as closed, and leave() still ends both.
    closeMicForRecap();
    closes[1]!.refuse(new Error('track gone'));
    await settle();
    assert.deepEqual(confirmed, [], 'a microphone that would not close was reported closed');

    // A close confirmed after the learner left, or after a new start took the
    // session, belongs to a room that is gone: it never reaches the release, so
    // it cannot give away a hold a newer room took.
    closeMicForRecap();
    roomRef.current = null;
    closes[2]!.confirm();
    await settle();
    roomRef.current = room;
    closeMicForRecap();
    startGenRef.current += 1;
    closes[3]!.confirm();
    await settle();
    assert.deepEqual(confirmed, [], 'a close from a room the learner has left was reported as this session\'s');

    // A stopped session's recap closes the microphone as well: nobody is listening any more.
    const stopped = switchWorld(STOP);
    let closedForStop = 0;
    deliver({ ...stopped.world, closeMicForRecap: () => { closedForStop += 1; } }, RECAP_MSG);
    assert.equal(closedForStop, 1, 'a stopped session left the microphone published under the stop screen');

    // The hold goes only once the session has ended, the close is confirmed and
    // the tutor is quiet, and never for a stop (F137 gets no moment).
    const EFFECT = releaseEffect(hook);
    const releases = (state: { recapArrived: boolean; micClosedAtRecap: boolean; tutorSpeaking: boolean; stoppedNow: boolean }): number => {
      let released = 0;
      run(EFFECT, { ...state, recapMayTakeTheAudio, trace: () => {}, releaseLiveHold: () => { released += 1; } });
      return released;
    };
    const ready = { recapArrived: true, micClosedAtRecap: true, tutorSpeaking: false, stoppedNow: false };
    assert.equal(releases(ready), 1, 'the recap never gets the audio focus back, so its moment is refused');
    assert.equal(releases({ ...ready, recapArrived: false }), 0, 'the hold went before the session ended');
    assert.equal(releases({ ...ready, micClosedAtRecap: false }), 0, 'the hold went while the microphone was still published');
    assert.equal(releases({ ...ready, tutorSpeaking: true }), 0, 'the hold went under a line the tutor is still speaking');
    assert.equal(releases({ ...ready, stoppedNow: true }), 0, 'a stopped session was given a moment');

    // And the release itself gives back the hold and nothing else: the room's
    // session is still `leave()`'s to end, and the next room holds again.
    const { ensureAudioSession, releaseAudioSession, releaseLiveHold } = await import('./globals.ts');
    await ensureAudioSession();
    assert.equal(liveRoom(), true);
    releaseLiveHold();
    assert.equal(liveRoom(), false, 'the recap still sits under the room\'s hold');
    releaseLiveHold();
    await releaseAudioSession();
    assert.equal(liveRoom(), false, 'leaving after the recap took a hold back');
    await ensureAudioSession();
    assert.equal(liveRoom(), true, 'the next room took no hold after a recap gave one back');
    await releaseAudioSession();
    assert.equal(liveRoom(), false);

    // Giving the room's hold back must not let a takeover start over the recap:
    // the recap holds the celebration queue while it is on screen, as every end
    // card does, so what the conversation earned plays after the learner leaves.
    const recapScreen = read('../RecapScreen.tsx');
    assert.match(recapScreen, /import \{ holdCelebrations \} from '\.\/celebrate\/queue\.ts';/, 'the recap cannot hold the celebration queue');
    assert.match(recapScreen, /useEffect\(\(\) => holdCelebrations\(\), \[\]\);/, 'a takeover can start over the recap once the room lets go');
  });
});

/* ------------------------------------------------------------------------- *
 * F777: the recap stops the microphone capture, not only mutes it.
 * ------------------------------------------------------------------------- */

/**
 * The phone's shim, run as it is written: `globals.native.ts` reaches the
 * native LiveKit module, so its imports are supplied by hand (the real
 * audio-focus hold, a fake LiveKit audio session) and its exports handed back.
 */
function nativeShim(session: { startAudioSession: () => Promise<void>; stopAudioSession: () => Promise<void> }): {
  ensureAudioSession: () => Promise<void>;
  releaseAudioSession: () => Promise<void>;
  releaseLiveHold: () => void;
} {
  const source = read('./globals.native.ts').replace(/^import [^;]+;$/gm, '').replace(/^export /gm, '');
  const make = new Function(
    'registerGlobals',
    'AudioSession',
    'holdLive',
    'markUnknown',
    `"use strict";\n${stripTypeScriptTypes(source)}\nreturn { ensureAudioSession, releaseAudioSession, releaseLiveHold };`,
  ) as (...args: unknown[]) => ReturnType<typeof nativeShim>;
  return make(() => {}, session, holdLive, () => {});
}

describe('the microphone capture at the recap — F777', () => {
  test('the recap stops the microphone capture, not only mutes it', async () => {
    const order: string[] = [];
    const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
    // The learner's published microphone, and LiveKit's participant around it.
    // `setMicrophoneEnabled(false)` only mutes: the track stays published and
    // the device goes on recording, which is the iPhone's indicator left on.
    const micTrack = { kind: Track.Kind.Audio };
    let published: typeof micTrack | null = micTrack;
    let stopping: { confirm: () => void; refuse: (error: Error) => void } | null = null;
    const participant = {
      setMicrophoneEnabled: (on: boolean): Promise<void> => {
        order.push(`setMicrophoneEnabled(${on})`);
        return Promise.resolve();
      },
      getTrackPublication: (source: Track.Source) =>
        source === Track.Source.Microphone && published !== null ? { track: published } : undefined,
      unpublishTrack: (track: unknown, stopOnUnpublish?: boolean): Promise<void> => {
        order.push(`unpublishTrack(${track === micTrack ? 'the microphone' : 'something else'}, stop: ${stopOnUnpublish})`);
        return new Promise<void>((resolve, reject) => {
          stopping = { confirm: () => { published = null; resolve(); }, refuse: reject };
        });
      },
    };
    const room = { localParticipant: participant };
    const roomRef: { current: unknown } = { current: room };
    const startGenRef = { current: 1 };
    const confirmed: boolean[] = [];
    const closeMicForRecap = (): unknown =>
      run(CLOSE_MIC_FOR_RECAP, {
        Track,
        roomRef,
        startGenRef,
        diagRef: { current: { micPublished: true } },
        setMicOpen: (open: boolean) => order.push(`setMicOpen(${open})`),
        setMicClosedAtRecap: (closed: boolean) => confirmed.push(closed),
        trace: () => {},
      });
    const stop = (): { confirm: () => void; refuse: (error: Error) => void } => {
      assert.ok(stopping !== null, 'nothing was asked to stop');
      return stopping;
    };

    // The recap frame keeps F763's order: the circle is told, the close is
    // asked for, and only then is the recap shown.
    const { world, seen } = switchWorld();
    deliver({ ...world, closeMicForRecap, setRecap: (r: unknown) => { order.push('recap shown'); seen.recaps.push(r); } }, RECAP_MSG);
    assert.deepEqual(order, ['setMicOpen(false)', 'setMicrophoneEnabled(false)', 'recap shown']);

    // Then the capture itself stops: once the mute lands, the microphone track
    // is unpublished and stopped, which is what lets the device go.
    await settle();
    assert.deepEqual(
      order.filter((step) => step.startsWith('unpublishTrack')),
      ['unpublishTrack(the microphone, stop: true)'],
      'the recap only muted the microphone, so the capture runs on and the indicator stays on',
    );
    // Closed is reported only once the capture has stopped, so the room's hold
    // goes after it, never before (the release effect waits on this).
    assert.deepEqual(confirmed, [], 'the microphone was reported closed while it was still recording');
    stop().confirm();
    await settle();
    assert.deepEqual(confirmed, [true], 'a stopped capture never reached the effect that gives the recap its moment');
    const releases = (micClosedAtRecap: boolean): number => {
      let released = 0;
      run(releaseEffect(hook), {
        recapArrived: true,
        micClosedAtRecap,
        tutorSpeaking: false,
        stoppedNow: false,
        recapMayTakeTheAudio,
        trace: () => {},
        releaseLiveHold: () => { released += 1; },
      });
      return released;
    };
    assert.equal(releases(false), 0, 'the hold went before the capture had stopped');
    assert.equal(releases(true), 1);

    // A capture that will not stop is never reported closed: the hold stays, and leave() ends both.
    published = micTrack;
    confirmed.length = 0;
    closeMicForRecap();
    await settle();
    stop().refuse(new Error('negotiation failed'));
    await settle();
    assert.deepEqual(confirmed, [], 'a microphone that would not stop was reported closed');

    // A stop that lands after the learner has left belongs to a room that is gone.
    published = micTrack;
    closeMicForRecap();
    await settle();
    roomRef.current = null;
    stop().confirm();
    await settle();
    assert.deepEqual(confirmed, [], 'a stop from a room the learner has left was reported as this session\'s');
    roomRef.current = room;

    // A session with no microphone published (typed, or the circle never
    // tapped) has no capture to stop, and is closed as soon as the mute lands.
    order.length = 0;
    closeMicForRecap();
    await settle();
    assert.deepEqual(order.filter((step) => step.startsWith('unpublishTrack')), [], 'a microphone that was never published was unpublished');
    assert.deepEqual(confirmed, [true]);

    // And a later start without leave() takes its hold again: on a phone, where
    // LiveKit's session is still up after the recap gave its hold back, and on
    // the web. One hold for one room, not two.
    let activations = 0;
    let deactivations = 0;
    const phone = nativeShim({
      startAudioSession: async () => { activations += 1; },
      stopAudioSession: async () => { deactivations += 1; },
    });
    await phone.ensureAudioSession();
    assert.equal(liveRoom(), true);
    phone.releaseLiveHold();
    assert.equal(liveRoom(), false, 'the recap still sits under the room\'s hold');
    await phone.ensureAudioSession();
    assert.equal(liveRoom(), true, 'a phone started a room after a recap without leaving, and the room held nothing');
    assert.equal(activations, 2, 'the session the recap\'s sound may have let go was not made active again');
    await phone.ensureAudioSession();
    assert.equal(activations, 2, 'a live, held room was started over');
    phone.releaseLiveHold();
    assert.equal(liveRoom(), false, 'one room took two holds');
    await phone.releaseAudioSession();
    assert.equal(deactivations, 1);
    assert.equal(liveRoom(), false);

    const web = await import('./globals.ts');
    await web.ensureAudioSession();
    web.releaseLiveHold();
    await web.ensureAudioSession();
    assert.equal(liveRoom(), true, 'a browser started a room after a recap without leaving, and the room held nothing');
    await web.ensureAudioSession();
    web.releaseLiveHold();
    assert.equal(liveRoom(), false, 'one room took two holds');
    await web.releaseAudioSession();
    assert.equal(liveRoom(), false);
  });
});
