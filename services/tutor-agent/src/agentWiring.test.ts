/**
 * What the worker wires into the room, and what it says when a vendor dies.
 *
 * A tripwire file, in the `joinMeta.test.ts` idiom and for the same reason:
 * `agent.ts` is the LiveKit entrypoint, so importing it runs preflight, probes
 * four vendors and hands the process to `cli.runApp`. There is no way to drive
 * it from a test. What is defended here is plumbing rather than behaviour — the
 * behaviour on the other end of each of these wires already has real tests
 * against the real classes (`convo.test.ts`), and every one of them passes with
 * the worker wired to nothing at all. That gap is what this file closes.
 *
 * One check here is not a tripwire. The kinds the pipeline can report are
 * compared against the kinds the protocol carries, by the compiler, so the
 * claim that a sixth SDK kind cannot arrive miscategorised is checked rather
 * than asserted in a comment.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERROR_KINDS, type ErrorKind } from '@luvani/core';
import type { ErrorEvent as PipelineErrorEvent } from '@livekit/agents';

const AGENT = readFileSync(fileURLToPath(new URL('./agent.ts', import.meta.url)), 'utf8');

/** Comments may promise anything; only what runs is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const CODE = stripComments(AGENT);

/** The union the Error handler is handed, straight off the SDK. */
type SdkKind = PipelineErrorEvent['error']['type'];

describe('the vendor failure the worker reports', () => {
  test('the kinds the pipeline can report are exactly the kinds the protocol carries', () => {
    // `Record<SdkKind, true>` is the compile-time half: a sixth kind added to
    // the SDK, or one renamed, fails to build here and in agent.ts together,
    // rather than arriving at the app as a silent miscategorisation of one of
    // the five. The annotation below is the other direction — every kind the
    // agent can send is one the protocol already names.
    const fromPipeline: Record<SdkKind, true> = {
      stt_error: true,
      tts_error: true,
      llm_error: true,
      realtime_model_error: true,
      interruption_detection_error: true,
    };
    const carried: ErrorKind[] = Object.keys(fromPipeline) as SdkKind[];

    assert.deepEqual(
      [...carried].sort(),
      [...ERROR_KINDS].sort(),
      'the pipeline reports a kind the protocol has no name for, or names one it can never report',
    );
  });

  test('the error frame carries what broke and whether it is coming back', () => {
    // The two lines that are the whole of F198. Without them the handler
    // discards the union's own discriminant, and a dead recogniser reaches the
    // app as one sentence about the tutor's voice.
    assert.match(CODE, /const kind = ev\.error\.type;/, 'the kind is thrown away, so the app has to guess from a sentence');
    assert.match(CODE, /const recoverable = ev\.error\.recoverable;/, 'without the flag a dead vendor reads as a passing blip');

    const frame = CODE.slice(CODE.indexOf("t: 'error'", CODE.indexOf('AgentSessionEventTypes.Error')));
    const published = frame.slice(0, frame.indexOf('}'));
    assert.match(published, /\bkind,/, 'the kind is read and not sent, which is the same bug three lines further down');
    assert.match(published, /\brecoverable,/, 'the flag is read and not sent, and the app is entitled to both or neither');
  });

  test('an unrecoverable failure is logged under the alarm the incident is grepped by', () => {
    const handler = CODE.slice(CODE.indexOf('AgentSessionEventTypes.Error'));
    const body = handler.slice(0, handler.indexOf('AgentSessionEventTypes.AgentStateChanged'));

    // The string is an interface. It is shared with apps/mobile/src/live/failure.ts,
    // which cannot be imported here without dragging livekit-client into the
    // worker, so both ends are pinned to the literal instead.
    assert.match(body, /\[luvani\] TUTOR_PIPELINE_DOWN/, 'a vendor half of the tutor can die without anything greppable being logged');
    assert.match(body, /\[luvani:live\] pipeline/, 'a recoverable blip goes unlogged, so nobody can count them');
    assert.match(
      body,
      /recoverable \? '\[luvani:live\] pipeline' : '\[luvani\] TUTOR_PIPELINE_DOWN'/,
      'the alarm is raised for the wrong half: it belongs to the failure that is not coming back',
    );
    assert.match(body, /kind=\$\{kind\}/, 'the log line never says what broke');

    // Nothing the learner said, and not the frame's sentence either. That line
    // is the one most likely to be pasted somewhere public.
    const logged = body.slice(body.indexOf('console.error(\n'), body.indexOf('void Promise.resolve()'));
    assert.doesNotMatch(logged, /message|transcript|text/, 'the log line carries learner-facing prose, and diagnostics carry none');
  });
});

describe('the room the worker owns', () => {
  test('a stop closes the room, and closes the hard stop with it', () => {
    const close = CODE.slice(CODE.indexOf('tutor.attachRoomClose('));
    assert.ok(close.startsWith('tutor.attachRoomClose('), 'nothing wires the room close, so a stopped session keeps its microphone published');

    const body = close.slice(0, close.indexOf('});'));
    assert.match(body, /clearTimeout\(hardStop\)/, 'the time-limit timer outlives the room and fires into a session that has ended');
    assert.match(body, /ctx\.room\.disconnect\(\)/, 'the tutor says the session is over and the room stays up around it');
  });

  test('the publisher hands back its promise, so a stop can wait for its own message', () => {
    // In the two typed modes the reliable data frame is the only delivery a
    // safety message gets — nothing is spoken. Dropping this promise closes the
    // room one tick early and takes the crisis line with it.
    assert.doesNotMatch(
      CODE,
      /void ctx\.room\.localParticipant/,
      'the publish promise is dropped, so closeAfterStop has nothing to wait on and a typed stop loses its line',
    );
    assert.match(
      CODE,
      /const publish = \(message: ServerMessage\) =>\s*\n\s*ctx\.room\.localParticipant/,
      'the publisher no longer returns the frame, which is the only signal the room has that the message landed',
    );
    assert.match(CODE, /tutor\.attach\(publish\)/, 'the tutor is attached to something other than the publisher that reports delivery');
  });
});

describe('a job process does not re-verify the vendors — F384', () => {
  // The framework starts every job as a fresh process from its own entry script
  // and imports agent.ts again, so the module's top level runs once per session.
  // The worker is the process whose entry script is this file; only it may pay
  // for the three vendor round trips, and only it may exit loudly on a bad env.
  test('preflight and the vendor check run only when this file is the entry script — F384', () => {
    const guard = AGENT.indexOf('const isWorkerProcess = process.argv[1] === fileURLToPath(import.meta.url);');
    assert.ok(guard > -1, 'agent.ts no longer decides whether it is the worker from its entry script');
    const block = AGENT.slice(guard);
    const open = block.indexOf('if (isWorkerProcess) {');
    const close = block.indexOf('\n}\n', open);
    assert.ok(open > -1 && close > open, 'the worker-only block is missing');
    const inside = block.slice(open, close);
    assert.match(inside, /\bpreflight\(\);/, 'preflight() left the worker-only block');
    assert.match(inside, /reportVendors\(await verifyVendors\(/, 'the vendor check left the worker-only block');
    const after = block.slice(close);
    assert.match(after, /const workerOptions = new WorkerOptions\(/, 'the CLI retains the SDK options used to obtain its actual health port');
    assert.match(after, /cli\.runApp\(workerOptions\)/, 'runApp must stay outside the block: the framework needs the module to load in a job too');
    // Nothing else at the top level asks a vendor before a job can answer.
    const topLevel = AGENT.slice(AGENT.indexOf('\n});\n', AGENT.indexOf('export default defineAgent(')));
    assert.equal((topLevel.match(/verifyVendors\(/g) ?? []).length, 1, 'verifyVendors is called more than once at the top level');
  });
});

describe('thinking time reaches the session (VOICE-010)', () => {
  test('the session is built from turnHandlingFor with the start rung', () => {
    const build = CODE.slice(CODE.indexOf('turnHandling: turnHandlingFor('));
    const call = build.slice(0, build.indexOf('}),'));
    assert.match(call, /startRung/, 'the session opens on the fluent floor whatever the learner\'s rung');
  });

  test('a rung change reaches session.updateOptions, from both tutors', () => {
    assert.match(
      CODE,
      /new ThinkingTime\(startRung, \(endpointing\) => \{\s*session\.updateOptions\(\{ turnHandling: \{ endpointing \} \}\);\s*\}\)/,
      'the thinking-time controller is not wired to the session, so the floor never moves',
    );
    assert.match(CODE, /thinkingTime: thinking,\s*\}\)/, 'the conversation reports its rung and hold to nobody');
    assert.match(CODE, /new LuvaniTutor\([^)]*thinkingTime: thinking/, 'the lesson reports its rung and hold to nobody');
  });

  test('who started speaking reaches the cut-off tracker', () => {
    assert.match(CODE, /if \(ev\.newState === 'speaking'\) thinking\.tutorSpeaking\(\);/, 'a tutor reply is never seen, so every new turn could count as a cut-off');
    assert.match(CODE, /thinking\.learnerSpeechStarted\(\);\s*tutor\.setLearnerSpeaking\(true\);/, 'a learner cut off mid-sentence never raises the floor');
  });
});

describe('the end-of-session clock and tap-to-send reach the room', () => {
  test('the clock runs on both the lifecycle and the legacy cap, and never for a guest scene', () => {
    assert.match(CODE, /const endClock = scene \|\| !headsUpEnabled\(\) \? undefined : new SessionEndClock\(tutor, remainingMs,/, 'a scene got the heads-up, nobody did, or the kill switch is not read');
    const build = CODE.slice(CODE.indexOf('const remainingMs = () =>'));
    const source = build.slice(0, build.indexOf(';\n'));
    assert.match(source, /\(lifecycle\.maxSeconds - lifecycle\.elapsedSeconds\(\)\) \* 1_000/, 'the lifecycle path reads a different clock from the cap');
    assert.match(source, /maximumSessionSec \* 1_000 - \(Date\.now\(\) - sessionStartedAt\)/, 'the legacy path has no clock');
    assert.ok(CODE.indexOf('const sessionStartedAt = Date.now();') < CODE.indexOf('const hardStop ='), 'the legacy clock starts after the hard stop it shadows');
    assert.ok(CODE.indexOf('endClock?.start();') > CODE.indexOf('await session.start('), 'the clock starts before there is a session to speak through');
  });

  test('the clock hears the agent and the learner, and stops with the room', () => {
    const agentState = CODE.slice(CODE.indexOf('AgentSessionEventTypes.AgentStateChanged'), CODE.indexOf('AgentSessionEventTypes.MetricsCollected'));
    assert.match(agentState, /endClock\?\.agentState\(ev\.newState\)/);
    const userState = CODE.slice(CODE.indexOf('AgentSessionEventTypes.UserStateChanged'));
    const handler = userState.slice(0, userState.indexOf('\n    });'));
    assert.match(handler, /endClock\?\.learnerSpeaking\(true\)/);
    assert.match(handler, /endClock\?\.learnerSpeaking\(false\)/);
    assert.match(handler, /tapToSend\?\.learnerSpeaking\(true\)/, 'no held turn ever opens');
    assert.equal((CODE.match(/endClock\?\.stop\(\); tapToSend\?\.stop\(\);/g) ?? []).length, 2, 'a timer outlives the room or the learner');
  });

  test('tap-to-send is off for scenes, quiet in typed sessions, and its frames never reach the tutors', () => {
    assert.match(CODE, /const tapToSend = scene \|\| !tapToSendEnabled\(\) \? undefined : new TapToSend\(\(\) => session, tutor, publish, undefined, \{ voiceless \}\)/, 'a typed start never gets tap-to-send back after switching to voice');
    const data = CODE.slice(CODE.indexOf("ctx.room.on('dataReceived'"));
    const intercept = data.indexOf("control?.t === 'tap-to-send' || control?.t === 'send'");
    assert.ok(intercept > -1 && intercept < data.indexOf('tutor.handleClientMessage('), 'the tutors are handed turn controls they do not own');
    const peek = data.indexOf('tapToSend?.setVoiceless(control.voiceless);');
    assert.ok(peek > intercept && peek < data.indexOf('tutor.handleClientMessage('), 'going typed leaves a held turn recording');
    assert.doesNotMatch(data.slice(peek, data.indexOf('tutor.handleClientMessage(')), /return;/, 'the mode frame is swallowed and the tutor keeps talking');
  });

  test('tap-to-send waits for session.start and hears the agent state', () => {
    const live = CODE.indexOf('tapToSend?.markLive();');
    assert.ok(live > CODE.indexOf('await session.start('), 'turn detection is changed before the session has an activity');
    const agentState = CODE.slice(CODE.indexOf('AgentSessionEventTypes.AgentStateChanged'), CODE.indexOf('AgentSessionEventTypes.MetricsCollected'));
    assert.match(agentState, /tapToSend\?\.agentState\(ev\.newState\)/, 'a Send over an uninterruptible line is dropped');
  });

  test('the close stands the legacy time-limit notice down, and the lifecycle stop is untouched', () => {
    const build = CODE.slice(CODE.indexOf('new SessionEndClock('));
    const onClose = build.slice(0, build.indexOf('});'));
    assert.match(onClose, /clearTimeout\(hardStop\)/, 'the learner hears goodbye and then the time-limit notice');
    assert.match(onClose, /silentStop = setTimeout\(\(\) => \{ void ctx\.room\.disconnect\(\); \}/, 'the legacy path lost its ceiling');
    assert.doesNotMatch(onClose, /lifecycle\?*\.(onStop|complete)/);
    assert.match(CODE, /lifecycle\?\.onStop\(\(\) => \{/, 'the lifecycle backstop is gone');
  });
});
