/** Exercise the production screen's failure decisions without loading native modules. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { failureCopy } from '../live/failure.ts';
import { takeTypedDoor, typedDoorFor } from '../live/typedDoor.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { GUEST_ROOM_ENDED, guestLiveBody, guestSceneMode } from './guestScene.ts';
import { classifyFailure, TokenServerError } from '../live/failure.ts';

const source = readFileSync(new URL('./FirstLivePractice.tsx', import.meta.url), 'utf8');
const decisions = source.slice(source.indexOf('  const opened ='), source.indexOf('  const end ='))
  .replace('const state: OrbState', 'const state');
const evaluate = new Function('live', 'typing', 'ending', 'saving', 'name', 'failureCopy', 'typedDoorFor', 'scene', 'typedScene', 'over', 'GUEST_ROOM_ENDED',
  `${decisions}\nreturn { caption, state, canRecoverByTyping, canRetryConnection, roomEnded };`);
const recovery = source.slice(source.indexOf('  const recoverByTyping ='), source.indexOf('  const changeInput ='));
const recover = new Function('live', 'canRecoverByTyping', 'takeTypedDoor', 'setTyping', 'setIssue', 'scene', 'setTypedScene', 'setTypedRestart',
  `${recovery}\nrecoverByTyping();`);
const room = (overrides = {}) => ({
  status: { phase: 'error', failure: 'tutor-deaf', message: failureCopy('tutor-deaf').message },
  sessionId: 'same-metered-session', convo: {}, settlement: null, recap: null,
  tutorSpeaking: false, thinking: false, micOpen: false, reconnecting: false,
  waitingForTutor: false, ...overrides,
});
const view = (live: ReturnType<typeof room>, typing = false, ending = false, saving = false, scene = false, typedScene = false) =>
  evaluate(live, typing, ending, saving, tutorNameOf(null), failureCopy, typedDoorFor, scene, typedScene, scene ? (live as { summary?: unknown }).summary ?? null : live.recap, GUEST_ROOM_ENDED);

test('failed first practice never announces readiness or stale live activity', () => {
  for (const typing of [false, true]) {
    for (const activity of [{}, { tutorSpeaking: true }, { thinking: true }, { micOpen: true }, { reconnecting: true }]) {
      const failed = view(room(activity), typing);
      assert.equal(failed.caption, 'Tutor cannot hear');
      assert.equal(failed.state, 'error');
      const exhausted = view(room({ ...activity, status: {
        phase: 'out-of-minutes', label: 'Practice time is up', message: 'Your practice allowance has ended.',
      } }), typing);
      assert.equal(exhausted.caption, 'Practice time is up');
      assert.equal(exhausted.state, 'error');
      assert.equal(exhausted.canRecoverByTyping, false);
      assert.equal(exhausted.canRetryConnection, false);
    }
  }
  assert.equal(view(room(), false, true).caption, 'Finishing this conversation…');
  assert.equal(view(room(), false, false, true).caption, 'Saving your session…');
});

test('voice failure typing keeps the existing room and never requests another grant', () => {
  for (const failure of ['tutor-deaf', 'tutor-mute', 'tutor-talks-over'] as const) {
    const live = room({ status: { phase: 'error', failure, message: failureCopy(failure).message } });
    assert.equal(view(live).canRecoverByTyping, true);
    let switches = 0, starts = 0, typing = false, issue = 'old notice';
    recover({ ...live, start: () => { starts++; }, switchToText: () => {
      switches++; live.status = { phase: 'live' } as typeof live.status; return true;
    } }, true, takeTypedDoor, (next: boolean) => { typing = next; }, (next: string) => { issue = next; }, false, () => assert.fail('a conversation never reopens typed'));
    assert.equal(switches, 1);
    assert.equal(starts, 0);
    assert.equal(live.sessionId, 'same-metered-session');
    assert.equal(typing, true);
    assert.equal(issue, '');
    assert.equal(view(live, typing).caption, 'Ready for your message');
  }
  assert.match(source, /canRecoverByTyping && <PillButton label="Continue by typing" onPress=\{recoverByTyping\}/);
});

test('settling, closed, nonvoice and already-typing failures have no recovery door', () => {
  for (const changes of [
    { settlement: { kind: 'pending' } },
    { settlement: { kind: 'settled' } },
    { recap: {} },
    { sessionId: null },
    { status: { phase: 'error', failure: 'tutor-stalled' } },
    { status: { phase: 'error', failure: 'dropped' } },
  ]) assert.equal(view(room(changes)).canRecoverByTyping, false);
  assert.equal(view(room(), true).canRecoverByTyping, false);
  assert.equal(view(room(), false, true).canRecoverByTyping, false);
  let switches = 0;
  recover(room({ switchToText: () => { switches++; return true; } }), false, takeTypedDoor,
    () => assert.fail('must not open typing'), () => assert.fail('must not clear failure'), false, () => assert.fail('no cold reopen'));
  assert.equal(switches, 0);
});

test('a terminal or disconnected room refusing the switch stays failed without a replacement grant', () => {
  let starts = 0, issue = '';
  const live = room({ start: () => { starts++; }, switchToText: () => false });
  recover(live, true, takeTypedDoor, () => assert.fail('must not open typing'), (next: string) => { issue = next; }, false, () => assert.fail('no cold reopen'));
  assert.equal(starts, 0);
  assert.equal(live.status.phase, 'error');
  assert.match(issue, /End the session or check its result/);
});

test('connection retry is limited to an error before any session or settlement exists', () => {
  const unopened = room({ convo: null, sessionId: null });
  assert.equal(view(unopened).canRetryConnection, true);
  assert.equal(view(room({ convo: null })).canRetryConnection, false);
  assert.equal(view(room({ convo: null, sessionId: null, settlement: { kind: 'pending' } })).canRetryConnection, false);
  assert.equal(view(unopened, false, true).canRetryConnection, false);
  assert.match(source, /canRetryConnection && <PillButton label="Try connecting again"/);
  assert.match(source, /live.status.phase === 'out-of-minutes' \? live.status.message/);
});

test('the café scene opens on the lesson prompt and ends on its summary', () => {
  const lesson = { ...room({ status: { phase: 'live' }, convo: null }), prompt: { turn: {} } as { turn: object } | null, summary: null };
  assert.equal(view(lesson, false, false, false, true).state, 'ready');
  const unopened = { ...lesson, prompt: null };
  assert.equal(view(unopened, false, false, false, true).state, 'connecting', 'a scene is not open until its first prompt');
  // A typing door before any room opens reopens the scene typed, without a grant in hand.
  const cold = room({ convo: null, sessionId: null, status: { phase: 'error', failure: 'mic-unavailable', message: '' } });
  assert.equal(view(cold, false, false, false, true).canRecoverByTyping, true);
  assert.equal(view(cold, false, false, false, true, true).canRecoverByTyping, false, 'already typed');
  let typed = false, starts = 0, restarts = 0;
  recover({ ...cold, start: () => { starts++; } }, true, takeTypedDoor, () => assert.fail('the room is not switched'), () => {}, true, (next: boolean) => { typed = next; }, (f: (n: number) => number) => { restarts = f(restarts); });
  assert.equal(typed, true);
  assert.equal(restarts, 1);
  assert.equal(starts, 0, 'the restart follows the mode change, not the tap');
  assert.match(source, /mode: guestSceneMode\(typedScene\), guestToken: guest\.token!/);
  assert.match(source, /scene \? GUEST_SCENE_LESSON_ID : 'convo-01'/);
  assert.match(source, /<SupportBlock support=\{live\.prompt\.support\} onOptionPress=\{live\.sendChoice\}/);
  assert.match(source, /GUEST_SCENE_MAX_SECONDS \* 1000/);
  // The scene keeps no learner text: no contribution callback on its branch.
  assert.match(source, /\? \{ mode: guestSceneMode\(typedScene\), guestToken: guest\.token!, tutorVoice: guest\.plan\.tutorVoice \}\n/);
});

test('the end sheet says what a scene keeps, and the conversation keeps its own line', () => {
  assert.match(source, /\{scene \? 'The lines you reach will be kept\.' : 'Your confirmed replies will be kept\.'\}/);
});

test('a guest room the server will not grant again says the scene ended and offers the result', () => {
  // What the hook makes of a 409 from /onboarding/live.
  const failure = classifyFailure(new TokenServerError(409, undefined));
  assert.equal(failure, 'session-elsewhere');
  for (const scene of [true, false]) {
    for (const sessionId of [null, 'claimed-room']) {
      const ended = view(room({ sessionId, convo: null, status: { phase: 'error', failure, message: failureCopy(failure).message } }), false, false, false, scene);
      assert.equal(ended.roomEnded, true);
      assert.equal(ended.caption, 'This scene has ended');
      assert.equal(ended.canRetryConnection, false, 'a claimed room is never reissued, so retry can never work');
      assert.equal(ended.canRecoverByTyping, false);
    }
  }
  assert.match(source, /\{roomEnded \? GUEST_ROOM_ENDED\.message : live\.status\.phase === 'error'/);
  assert.match(source, /\{roomEnded && <PillButton label=\{saving \|\| ending \? 'Saving…' : GUEST_ROOM_ENDED\.action\} disabled=\{saving \|\| ending\} onPress=\{\(\) => void end\(\)\} \/>\}/);
  assert.match(source, /<IconAction icon="close" label="End session"/, 'End session stays');
  for (const line of Object.values(GUEST_ROOM_ENDED)) assert.doesNotMatch(line, /[—–]|another device|half an hour/);
  // Any other failure keeps its own copy and doors.
  assert.equal(view(room()).roomEnded, false);
});

test('the signed-in session-active copy is unchanged', () => {
  const copy = failureCopy('session-elsewhere');
  assert.equal(copy.label, 'Session already open');
  assert.equal(copy.message, 'Luvani still has a French session open for you. If it is on another device, end it there and try again. If you just left one here, it clears itself within half an hour, and practice works offline until then.');
  assert.equal(copy.canType, false);
  assert.doesNotMatch(readFileSync(new URL('../LiveSessionScreen.tsx', import.meta.url), 'utf8'), /GUEST_ROOM_ENDED/);
});

test('a refused microphone on a granted but never joined scene room restarts the scene typed', () => {
  // The grant happened, so there is a session id, but no room joined: the in-room switch is refused.
  const refused = room({ convo: null, sessionId: 'granted-unjoined', status: { phase: 'error', failure: 'mic-denied', message: failureCopy('mic-denied').message } });
  assert.equal(view(refused, false, false, false, true).canRecoverByTyping, true);
  let typed = false, restarts = 0, switches = 0;
  const issues: string[] = [];
  recover({ ...refused, switchToText: () => { switches++; return false; } }, true, takeTypedDoor, () => assert.fail('no room to type in'),
    (next: string) => issues.push(next), true, (next: boolean) => { typed = next; }, (f: (n: number) => number) => { restarts = f(restarts); });
  assert.equal(switches, 1, 'the room is asked first, in case it can switch in place');
  assert.equal(typed, true);
  assert.equal(restarts, 1);
  assert.ok(!issues.some((line) => /cannot continue by typing/.test(line)), 'a scene never says it cannot continue by typing');
  // The restart opens typed: the mode and the grant body are the typed lesson.
  assert.equal(guestSceneMode(typed), 'lesson-text');
  assert.deepEqual(guestLiveBody(guestSceneMode(typed)), { mode: 'lesson-text' });
  assert.match(source, /useEffect\(\(\) => \{ if \(typedRestart > 0\) void live\.start\(\); \}, \[typedRestart\]\);/);
  // A restart the server refuses with 409 (the room was claimed after all) is the scene-ended state.
  const claimed = view(room({ convo: null, sessionId: null, status: { phase: 'error', failure: classifyFailure(new TokenServerError(409, undefined)), message: '' } }), true, false, false, true, true);
  assert.equal(claimed.roomEnded, true);
  assert.equal(claimed.canRetryConnection, false);
  assert.equal(claimed.canRecoverByTyping, false);
  // Switching to typing while still connecting restarts the same way.
  assert.match(source, /if \(nextTyping && scene && !ready\) restartTyped\(\);/);
});

test('the guest conversation keeps its refusal when the room cannot switch', () => {
  const issues: string[] = [];
  const live = room({ status: { phase: 'error', failure: 'mic-denied', message: '' }, switchToText: () => false });
  recover(live, true, takeTypedDoor, () => assert.fail('must not open typing'), (next: string) => issues.push(next), false, () => assert.fail('no restart'), () => assert.fail('no restart'));
  assert.match(issues.at(-1) ?? '', /cannot continue by typing/);
});
