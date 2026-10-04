import type { TutorSessionRepository } from './tutorSessions.ts';

export interface RoomCloser {
  listRooms(names: string[]): Promise<unknown[]>;
  deleteRoom(name: string): Promise<void>;
}
/** Outbox acknowledgements follow a confirmed absent/deleted room, never a timeout. */
export async function reconcileTutorRooms(repository: TutorSessionRepository, rooms: RoomCloser) {
  const result = await repository.rpc('reconcile_tutor_sessions_v1', { p_limit: 5, p_closed_session_ids: [] });
  if (result.kind !== 'reconciled' || !Array.isArray(result.roomStops) || result.roomStops.length > 5) throw new Error('invalid-room-stop-batch');
  const closed: string[] = [];
  for (const stop of result.roomStops) {
    if (!stop || typeof stop !== 'object' || typeof stop.sessionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(stop.sessionId)
      || typeof stop.roomName !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(stop.roomName)) throw new Error('invalid-room-stop');
    try {
      if ((await rooms.listRooms([stop.roomName])).length !== 0) await rooms.deleteRoom(stop.roomName);
      closed.push(stop.sessionId);
    } catch { /* uncertain stop remains durably pending */ }
  }
  if (closed.length) await repository.rpc('reconcile_tutor_sessions_v1', { p_limit: 5, p_closed_session_ids: closed });
  return { requested: result.roomStops.length, closed: closed.length };
}
