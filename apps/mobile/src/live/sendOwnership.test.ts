import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import type { TurnLine } from './turns.ts';
import { learnerLine } from './leaveKeepingWork.ts';

const source = readFileSync(new URL('./useLiveSession.ts', import.meta.url), 'utf8');
const marker = source.indexOf('    sendSay: useCallback(');
const begin = source.indexOf('      async (text: string) => {', marker);
const end = source.indexOf('\n      [publish, addTurn],', begin);
assert.ok(marker > 0 && begin > marker && end > begin, 'execute the actual typed-send callback');
const callback = stripTypeScriptTypes(source.slice(begin, end).trim().replace(/,$/, ''));

function sending() {
  const originalRoom = {};
  const roomRef = { current: originalRoom as object | null };
  const startGenRef = { current: 1 };
  const typedSendRevision = { current: 0 };
  const noticeTimer = { current: null as number | null };
  const pending: ((sent: boolean) => void)[] = [];
  const timers: (() => void)[] = [];
  let turns: TurnLine[] = [], thinking = false, notice: string | null = null, sequence = 0;
  const world = {
    roomRef, startGenRef, typedSendRevision, noticeTimer,
    learnerLine,
    choosingRef: { current: false },
    addTurn: (turn: Omit<TurnLine, 'id'>) => { const id = `test-${++sequence}`; turns.push({ ...turn, id }); return id; },
    setTurns: (update: (previous: TurnLine[]) => TurnLine[]) => { turns = update(turns); },
    setThinking: (value: boolean) => { thinking = value; },
    setNotice: (value: string | null) => { notice = value; },
    publish: () => new Promise<boolean>(resolve => { pending.push(resolve); }),
    clearTimeout: () => {},
    setTimeout: (run: () => void) => { timers.push(run); return timers.length; },
  };
  const send = new Function(...Object.keys(world), `return (${callback});`)(...Object.values(world)) as (text: string) => Promise<boolean>;
  return { send, roomRef, startGenRef, pending, timers,
    state: () => ({ turns: turns.map(turn => turn.fr), thinking, notice }),
    currentNotice: (value: string) => { notice = value; },
    serverNotice: (value: string) => { notice = value; noticeTimer.current = -1; },
    answered: () => { thinking = false; },
    replace: (changeRoom: boolean, changeGeneration: boolean) => {
      if (changeRoom) roomRef.current = {};
      if (changeGeneration) startGenRef.current += 1;
      turns = []; thinking = true; notice = 'The current room notice';
    },
  };
}

test('a current typed publish failure restores only its own optimistic turn and reports the failure', async () => {
  const h = sending();
  const result = h.send('fixture learner reply');
  assert.deepEqual(h.state(), { turns: ['fixture learner reply'], thinking: true, notice: null });
  h.pending[0]!(false);
  assert.equal(await result, false);
  assert.deepEqual(h.state(), { turns: [], thinking: false, notice: 'That did not send. Your words are back in the box.' });
  h.timers[0]!();
  assert.equal(h.state().notice, null);
});

test('a failed send from an old room or start cannot change the current input or notice', async () => {
  for (const [changeRoom, changeGeneration] of [[true, false], [false, true], [true, true]]) {
    const h = sending(), result = h.send('old fixture reply');
    h.replace(changeRoom!, changeGeneration!);
    const current = h.state();
    h.pending[0]!(false);
    assert.equal(await result, false);
    assert.deepEqual(h.state(), current);
    assert.equal(h.timers.length, 0, 'a departed attempt cannot arm a notice timer');
  }
});

test('an earlier failed send in the same room cannot clear a newer pending input or notice', async () => {
  const h = sending(), older = h.send('older fixture reply'), newer = h.send('newer fixture reply');
  h.currentNotice('The newer input notice');
  h.pending[0]!(false);
  assert.equal(await older, false);
  assert.deepEqual(h.state(), { turns: ['newer fixture reply'], thinking: true, notice: 'The newer input notice' });
  assert.equal(h.timers.length, 0);
  h.pending[1]!(true);
  assert.equal(await newer, true);
  assert.equal(h.state().thinking, true, 'transport handoff does not mean that the tutor answered');
});

test('a failure notice timer cannot clear a later room or same-room input notice', async () => {
  for (const replaceRoom of [false, true]) {
    const h = sending(), result = h.send('failed fixture reply');
    h.pending[0]!(false); await result;
    if (replaceRoom) h.replace(true, true);
    else void h.send('new fixture reply');
    h.currentNotice('The current input notice');
    h.timers[0]!();
    assert.equal(h.state().notice, 'The current input notice');
  }
});

test('a publish handoff never restarts thinking after an authoritative answer already completed it', async () => {
  const h = sending(), result = h.send('fixture learner reply');
  h.answered();
  h.currentNotice('The current server notice');
  h.pending[0]!(true);
  assert.equal(await result, true);
  assert.deepEqual(h.state(), { turns: ['fixture learner reply'], thinking: false, notice: 'The current server notice' });
});

test('a failure notice timer already queued cannot erase a newer server-owned notice', async () => {
  const h = sending(), result = h.send('failed fixture reply');
  h.pending[0]!(false); await result;
  h.serverNotice('The current server notice');
  h.timers[0]!();
  assert.equal(h.state().notice, 'The current server notice');
});
