import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcileTutorRooms } from './maintenance.ts';
import type { TutorSessionRepository } from './tutorSessions.ts';
test('room-stop outbox acknowledges only absent or successfully deleted rooms', async () => {
  const calls: Record<string, unknown>[] = [];
  const ids = [1,2,3].map(n => `80000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
  const repository = { rpc: async (_name: string, args: Record<string, unknown>) => {
    calls.push(args);
    return { kind: 'reconciled', roomStops: ids.map((sessionId,n) => ({ sessionId, roomName: `luvani-${n}` })) };
  } } as unknown as TutorSessionRepository;
  const result = await reconcileTutorRooms(repository, {
    listRooms: async names => names[0] === 'luvani-0' ? [] : [{}],
    deleteRoom: async name => { if (name === 'luvani-2') throw new Error('uncertain'); },
  });
  assert.deepEqual(result, { requested: 3, closed: 2 });
  assert.deepEqual(calls[1]?.p_closed_session_ids, ids.slice(0,2));
});
