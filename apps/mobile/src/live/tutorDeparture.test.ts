import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { ConnectionState, RoomEvent } from 'livekit-client';
import { failureCopy } from './failure.ts';
import { ConversationTextRecorder, type ServerMessage } from '@luvani/core';
import { disconnectLease, unjoinedLease } from './unjoinedLease.ts';
import { nextStart } from './startOwnership.ts';

const source = readFileSync(new URL('./useLiveSession.ts', import.meta.url), 'utf8');

function departure(phase = 'live', remaining = 0, active = true) {
  const start = source.indexOf('      room.on(RoomEvent.ParticipantDisconnected,');
  assert.ok(start > 0, 'the connected client must observe its tutor leaving, not only its own room disconnect');
  const end = source.indexOf('\n      });', start) + '\n      });'.length;
  let handler!: () => void;
  let status: { phase: string; [key: string]: unknown } = { phase, marker: 'preserve-existing-result' };
  const calls: string[] = [];
  const world = {
    RoomEvent,
    ConnectionState,
    room: { state: ConnectionState.Connected, remoteParticipants: new Map(Array.from({ length: remaining }, (_, i) => [String(i), {}])), on: (event: string, callback: () => void) => { assert.equal(event, RoomEvent.ParticipantDisconnected); handler = callback; } },
    owns: () => active,
    clearWatchdog: () => calls.push('watchdog'),
    setReconnecting: (value: boolean) => { assert.equal(value, false); },
    setMicOpen: (value: boolean) => { assert.equal(value, false); calls.push('mic-closed'); },
    setThinking: (value: boolean) => { assert.equal(value, false); },
    setTutorSpeaking: (value: boolean) => { assert.equal(value, false); },
    setStatus: (update: (value: typeof status) => typeof status) => { status = update(status); },
    failureCopy,
    leave: async () => { calls.push('leave'); active = false; },
    teardownRoom: async () => { calls.push('leave'); active = false; },
    conversationTextRef: { current: new ConversationTextRecorder() },
  };
  new Function(...Object.keys(world), stripTypeScriptTypes(source.slice(start, end)))(...Object.values(world));
  return { run: () => handler(), calls, status: () => status, settle: () => new Promise<void>(resolve => setImmediate(resolve)) };
}

test('a departed tutor cannot leave a live composer and microphone in an empty room', async () => {
  const h = departure(); h.run(); h.run();
  await h.settle();
  assert.deepEqual(h.calls, ['watchdog', 'mic-closed', 'leave']);
  assert.equal(h.status().phase, 'error');
  assert.equal(h.status().failure, 'dropped');
  assert.equal(h.status().canType, false, 'typing cannot recover a room with no tutor');
});

test('tutor departure preserves an existing recap or failure while releasing the empty room', async () => {
  for (const phase of ['ended', 'error']) {
    const h = departure(phase); h.run();
    await h.settle();
    assert.deepEqual(h.status(), { phase, marker: 'preserve-existing-result' });
    assert.deepEqual(h.calls, ['watchdog', 'mic-closed', 'leave']);
  }
});

test('a stale departure or another remaining remote participant cannot tear down the active tutor', async () => {
  for (const h of [departure('live', 0, false), departure('live', 1)]) {
    h.run(); await h.settle(); assert.deepEqual(h.calls, []); assert.equal(h.status().phase, 'live');
  }
});

function callbackBody(name: string): string | undefined {
  const header = `const ${name} = useCallback(async () => {`;
  const begin = source.indexOf(header);
  if (begin < 0) return undefined;
  const end = source.indexOf('\n  }, [', begin);
  assert.ok(end > begin, 'the production teardown callback must be closed');
  return source.slice(begin + header.length, end);
}

/** Exercise the real recorder, callback registration and room/audio teardown. */
function productionDeparture(completed: boolean, delayed = false) {
  const recorder = new ConversationTextRecorder();
  recorder.receive({ t: 'transcript', text: 'Un café, s’il vous plaît.', final: true });
  const recap = { t: 'recap', recap: {}, profile: {} } as unknown as ServerMessage;
  if (completed) recorder.receive(recap);
  const startGenRef = { current: 1 };
  const calls: string[] = [];
  let finish!: () => void, handler!: () => void;
  const room = { state: ConnectionState.Connected, remoteParticipants: new Map<string, unknown>(),
    on: (_event: string, run: () => void) => { handler = run; },
    disconnect: async () => { calls.push('disconnect'); if (delayed) await new Promise<void>(resolve => { finish = resolve; }); } };
  const lease = unjoinedLease('completed-session', () => calls.push('abandon'));
  lease.observeTutor();
  const roomRef: { current: typeof room | null } = { current: room }, leaseRef = { current: lease };
  let status: { phase: string } = { phase: completed ? 'ended' : 'live' };
  const world: Record<string, unknown> = {
    RoomEvent, ConnectionState, room, owns: () => startGenRef.current === 1, failureCopy,
    startGenRef, nextStart, conversationTextRef: { current: recorder }, roomRef, leaseRef, disconnectLease,
    clearWatchdog: () => {}, send: () => calls.push('leave-frame'),
    removeAudioEls: () => calls.push('remove-audio'), releaseAudioSession: async () => { calls.push('release-audio'); },
    setReconnecting: () => {}, setMicOpen: () => calls.push('mic-closed'), setThinking: () => {}, setTutorSpeaking: () => {},
    setStatus: (update: (value: typeof status) => typeof status) => { status = update(status); },
  };
  const compile = (body: string) => new Function(...Object.keys(world), stripTypeScriptTypes(`const run = async function() {${body}};`) + '\nreturn run;')(...Object.values(world)) as () => Promise<void>;
  // The pre-repair hook performs transport teardown directly in public leave.
  // Executing that body keeps the red proof behavioral rather than a missing-symbol assertion.
  world.teardownRoom = compile(callbackBody('teardownRoom') ?? callbackBody('leave')!);
  world.leave = compile(callbackBody('leave')!);
  const begin = source.indexOf('      room.on(RoomEvent.ParticipantDisconnected,');
  const end = source.indexOf('\n      });', begin) + '\n      });'.length;
  new Function(...Object.keys(world), stripTypeScriptTypes(source.slice(begin, end)))(...Object.values(world));
  return { recorder, calls, recap, run: () => handler(), leave: world.leave as () => Promise<void>,
    replaceRoom: () => { startGenRef.current = nextStart(startGenRef.current); const next = { ...room }; roomRef.current = next; return next; },
    roomRef, room, finish: () => finish(), settle: () => new Promise<void>(resolve => setImmediate(resolve)) };
}

test('remote tutor teardown preserves an already delivered recap text before React paints it', async () => {
  const h = productionDeparture(true); const delivered = h.recorder.snapshot(); h.run();
  await h.settle();
  assert.deepEqual(h.recorder.snapshot(), delivered, 'closing an empty room must retain the authoritative recap’s saveable text');
  assert.deepEqual(h.calls, ['mic-closed', 'leave-frame', 'disconnect', 'remove-audio', 'release-audio']);
  await h.leave();
  assert.equal(h.recorder.snapshot(), null, 'an explicit leave still discards the in-memory conversation');
});

test('remote departure discards unfinished text rather than manufacturing a completed transcript', async () => {
  const h = productionDeparture(false); h.run(); await h.settle();
  h.recorder.receive(h.recap);
  assert.deepEqual(h.recorder.snapshot(), [], 'an incomplete room must not retain text behind the error');
  assert.ok(!h.calls.includes('abandon'), 'a joined tutor keeps its authoritative settlement lease');
});

test('a held old-room teardown never releases audio owned by a newer start', async () => {
  const h = productionDeparture(true, true); h.run(); await Promise.resolve(); const next = h.replaceRoom(); h.finish(); await h.settle();
  assert.equal(h.roomRef.current, next);
  assert.ok(!h.calls.includes('remove-audio') && !h.calls.includes('release-audio'), 'a late disconnect may finish only its captured room');
  assert.ok(!h.calls.includes('abandon'));
});

test('the installed LiveKit restart ordering cannot mistake roster rebuilding for a departed tutor', async () => {
  const sdk = readFileSync(new URL('../../../../node_modules/livekit-client/src/room/Room.ts', import.meta.url), 'utf8');
  const header = '  private handleRestarting = () => {';
  const begin = sdk.indexOf(header), end = sdk.indexOf('\n  };', begin);
  assert.ok(begin > 0 && end > begin, 'inspect the installed SDK’s actual restart behavior');
  const body = sdk.slice(begin + header.length, end);
  const h = productionDeparture(false);
  h.room.remoteParticipants.set('tutor', { identity: 'tutor' });
  const owner = Object.assign(h.room, {
    isResuming: false, clearConnectionReconcile: () => {}, emit: () => {},
    handleParticipantDisconnected: (identity: string) => { h.room.remoteParticipants.delete(identity); h.run(); },
    setAndEmitConnectionState: (state: ConnectionState) => { h.room.state = state; return true; },
  });
  new Function('ConnectionState', 'RoomEvent', stripTypeScriptTypes(body)).call(owner, ConnectionState, RoomEvent);
  await h.settle();
  assert.equal(h.room.state, ConnectionState.Reconnecting);
  assert.deepEqual(h.calls, [], 'a reconnect must keep its existing room, microphone and lease');
});
