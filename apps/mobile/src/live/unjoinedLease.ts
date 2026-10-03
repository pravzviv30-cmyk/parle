export interface UnjoinedLease { observeTutor(): void; release(): void; }
/** One grant, one monotonic observation, independent of mutable UI diagnostics. */
export function unjoinedLease(sessionId: string, abandon: (id: string) => void): UnjoinedLease {
  let tutorSeen = false; let claimed = false;
  return {
    observeTutor() { tutorSeen = true; },
    release() { if (tutorSeen || claimed) return; claimed = true; abandon(sessionId); },
  };
}
export interface LeaseRoom { remoteParticipants: { size: number }; disconnect(): Promise<void>; }
/** Do not free a lease behind a room whose disconnect failed. */
export async function disconnectLease(room: LeaseRoom | null, lease: UnjoinedLease | null): Promise<void> {
  if (room?.remoteParticipants.size) lease?.observeTutor();
  if (room) await room.disconnect();
  if (room?.remoteParticipants.size) lease?.observeTutor();
  lease?.release();
}
