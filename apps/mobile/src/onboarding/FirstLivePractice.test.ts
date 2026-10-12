/** Exercise the production screen's failure decisions without loading native modules. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { failureCopy } from '../live/failure.ts';
import { takeTypedDoor, typedDoorFor } from '../live/typedDoor.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';

const source = readFileSync(new URL('./FirstLivePractice.tsx', import.meta.url), 'utf8');
const decisions = source.slice(source.indexOf('  const ready ='), source.indexOf('  const end ='))
  .replace('const state: OrbState', 'const state');
const evaluate = new Function('live', 'typing', 'ending', 'saving', 'name', 'failureCopy', 'typedDoorFor',
  `${decisions}\nreturn { caption, state, canRecoverByTyping, canRetryConnection };`);
const recovery = source.slice(source.indexOf('  const recoverByTyping ='), source.indexOf('  const changeInput ='));
const recover = new Function('live', 'canRecoverByTyping', 'takeTypedDoor', 'setTyping', 'setIssue',
  `${recovery}\nrecoverByTyping();`);
const room = (overrides = {}) => ({
  status: { phase: 'error', failure: 'tutor-deaf', message: failureCopy('tutor-deaf').message },
  sessionId: 'same-metered-session', convo: {}, settlement: null, recap: null,
  tutorSpeaking: false, thinking: false, micOpen: false, reconnecting: false,
  waitingForTutor: false, ...overrides,
});
const view = (live: ReturnType<typeof room>, typing = false, ending = false, saving = false) =>
  evaluate(live, typing, ending, saving, tutorNameOf(null), failureCopy, typedDoorFor);

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
    } }, true, takeTypedDoor, (next: boolean) => { typing = next; }, (next: string) => { issue = next; });
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
    () => assert.fail('must not open typing'), () => assert.fail('must not clear failure'));
  assert.equal(switches, 0);
});

test('a terminal or disconnected room refusing the switch stays failed without a replacement grant', () => {
  let starts = 0, issue = '';
  const live = room({ start: () => { starts++; }, switchToText: () => false });
  recover(live, true, takeTypedDoor, () => assert.fail('must not open typing'), (next: string) => { issue = next; });
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
