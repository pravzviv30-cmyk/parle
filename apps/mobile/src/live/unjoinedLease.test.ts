import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unjoinedLease, disconnectLease } from './unjoinedLease.ts';
test('a tutor arriving during held disconnect keeps its own lease', async () => {
  const releases: string[] = []; const lease = unjoinedLease('A', id => { releases.push(id); });
  const participants = new Map(); let finish!: () => void;
  const exit = disconnectLease({ remoteParticipants: participants, disconnect: () => new Promise<void>(resolve => { finish = resolve; }) }, lease);
  lease.observeTutor(); finish(); await exit; lease.release(); assert.deepEqual(releases, []);
});
test('old exit releases only its unjoined grant once while a new grant exists', async () => {
  const releases: string[] = []; const abandon = (id: string) => { releases.push(id); };
  const old = unjoinedLease('A', abandon); const next = unjoinedLease('B', abandon);
  let finish!: () => void;
  const exit = disconnectLease({ remoteParticipants: new Map(), disconnect: () => new Promise<void>(resolve => { finish = resolve; }) }, old);
  next.observeTutor(); finish(); await exit; await disconnectLease(null, old);
  assert.deepEqual(releases, ['A']); next.release(); assert.deepEqual(releases, ['A']);
});
test('initial roster, a failed disconnect and late obsolete participant event never release a joined room', async () => {
  const releases: string[] = []; const abandon = (id: string) => { releases.push(id); };
  const initial = unjoinedLease('initial', abandon);
  await disconnectLease({ remoteParticipants: new Map([['agent', {}]]), disconnect: async () => {} }, initial);
  const failed = unjoinedLease('failed', abandon);
  await assert.rejects(disconnectLease({ remoteParticipants: new Map(), disconnect: async () => { throw new Error('held room'); } }, failed));
  assert.deepEqual(releases, []);
  failed.observeTutor(); await disconnectLease(null, failed); assert.deepEqual(releases, []);
});
