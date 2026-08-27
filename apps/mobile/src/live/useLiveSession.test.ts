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
import type { RecapPayload, ServerMessage } from '@parle/core';
import { createProfile } from '@parle/brain/profile';

import { setActiveUser } from '../storage/scope.ts';
import { journalRecap } from './journal.ts';
import { recoveryPlan } from './journalRules.ts';
import { afterDismiss } from './safetyState.ts';
import { opensSession } from './sessionOpened.ts';
import { micOpensAtConnect, modeCarriesAudio, type LiveMode } from '../tutor/choosingView.ts';
import { stoppedBySafety, type SafetyDecision } from '../tutor/safetyView.ts';

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

    const raw = disk.get(`parle.u.${uid}.journal`);
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

/** Run a fragment with every free name it may use supplied by hand. */
function run(source: string, world: Record<string, unknown>): void {
  const names = Object.keys(world);
  const fn = new Function(...names, `"use strict";\n${asJs(source)}`) as (...args: unknown[]) => void;
  fn(...names.map((name) => world[name]));
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
}

/** Everything the message handler's switch reaches for: the rules real, the edges faked. */
function switchWorld(decided: SafetyDecision | null = null): {
  world: Record<string, unknown>;
  seen: Seen;
  safetyRef: { current: SafetyDecision | null };
} {
  const seen: Seen = { safety: [], notices: [], statuses: [], recaps: [], summaries: [], journalled: [], timers: [] };
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
    setSafety: (s: SafetyDecision | null) => seen.safety.push(s),
    safetyRef,
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
  };
  return { world, seen, safetyRef };
}

const deliver = (world: Record<string, unknown>, msg: unknown): void => run(SWITCH, { ...world, msg });

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
      const guard = (): void => run(MIC_API_GUARD, { mode, modeCarriesAudio, micApiUnavailable: () => true });
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
