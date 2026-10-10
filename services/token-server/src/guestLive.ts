/** Guest admission uses the existing capability/CAS store and worker lease protocol.
 * A reserved room belongs to one installation, then one worker fence, then one account.
 * No client-provided recap, finish flag or elapsed time is trusted by this service.
 */
import { randomUUID } from 'node:crypto';
import { isServiceFailure, parseFirstPracticeBrief, type FirstPracticeBrief, type ConversationPack } from '@luvani/core';
import { tutorDigest } from '../../shared/tutorLifecycle.ts';
import { validConversationPackFor } from './conversationPacks.ts';
import { HttpInputError } from './requestBoundary.ts';
import type { GuestStore } from './onboardingGuest.ts';

export interface GuestLiveRecord {
  brief: FirstPracticeBrief;
  sessionId: string;
  roomName: string;
  maxSeconds: number;
  joinDeadline: number;
  startedAt?: number;
  leaseUntil?: number;
  hardDeadline?: number;
  fence?: string;
  revision: number;
  digest?: string;
  seconds: number;
  learnerTurns: number;
  objectiveComplete: boolean;
  serviceFailure: string | null;
  safetyStopped?: boolean;
  baseline: ConversationPack | null;
  endedAt?: number;
  outcome?: 'completed' | 'partial' | 'interrupted';
}
const invalid = (status: 400 | 403 = 403): never => { throw new HttpInputError(status, 'guest session unavailable'); };
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const int = (v: unknown, low: number, high: number): v is number => Number.isSafeInteger(v) && Number(v) >= low && Number(v) <= high;
const date = (n: number) => new Date(n).toISOString();
export function newGuestLive(brief: FirstPracticeBrief, now = Date.now()): GuestLiveRecord {
  const sessionId = randomUUID();
  return { brief, sessionId, roomName: `luvani-${sessionId}`, maxSeconds: (brief.minutes ?? 5) * 60 + 60,
    joinDeadline: now + 120_000, revision: 0, seconds: 0, learnerTurns: 0, objectiveComplete: false, serviceFailure: null, baseline: null };
}
export async function prepareGuestLive(store: GuestStore, key: string, brief: unknown, now = Date.now()) {
  const parsed = parseFirstPracticeBrief(brief);
  if (!parsed) invalid(400);
  return store.update(key, row => {
    if (row.owner || row.expiresAt <= now) invalid();
    if (row.live?.endedAt || row.live?.fence) invalid();
    if (!row.live || JSON.stringify(row.live.brief) !== JSON.stringify(parsed)) row.live = newGuestLive(parsed!, now);
    // Reissue the same unclaimed room after a failed connection, never a second spend.
    row.live.joinDeadline = now + 120_000;
    return structuredClone(row.live);
  });
}
function deadlines(live: GuestLiveRecord, now: number) {
  return { serverNow: date(now), startedAt: date(live.startedAt!), leaseUntil: date(live.leaseUntil!), hardDeadline: date(live.hardDeadline!) };
}
function receipt(live: GuestLiveRecord, now: number) {
  return { kind: 'completed', sessionId: live.sessionId, receipt: { version: 1, sessionId: live.sessionId,
    chargedSeconds: live.serviceFailure || live.safetyStopped || live.learnerTurns === 0 ? 0 : live.seconds, releasedReservedSeconds: live.maxSeconds - (live.serviceFailure || live.safetyStopped || live.learnerTurns === 0 ? 0 : live.seconds),
    checkpointRevision: live.revision, state: live.outcome === 'interrupted' ? 'interrupted' : 'settled',
    baselineStatus: live.baseline ? 'saved' : 'none', completedAt: date(live.endedAt ?? now),
    settlement: { kind: live.serviceFailure || live.safetyStopped || live.learnerTurns === 0 ? 'not-charged' : 'charged', refundedSeconds: 0, secondsRemaining: 0, plan: 'trial' } } };
}
export async function guestLiveOperation(store: GuestStore, key: string, operation: string, body: Record<string, unknown>, now = Date.now()) {
  if (!['claim', 'checkpoint', 'complete', 'receipt'].includes(operation) || !uuid(body.userId) || !uuid(body.sessionId)) invalid(400);
  return store.update(key, row => {
    const live = row.live;
    if (!live || row.id !== body.userId || live.sessionId !== body.sessionId || row.owner) invalid();
    const room = live!;
    if (operation === 'receipt') return room.endedAt ? receipt(room, now) : { kind: 'pending', sessionId: room.sessionId, revision: room.revision };
    if (operation === 'claim') {
      if (!uuid(body.claimNonce) || body.roomName !== room.roomName || body.mode !== 'convo' || room.endedAt) invalid();
      if (room.fence && room.fence !== body.claimNonce) invalid();
      if (!room.fence) {
        if (room.joinDeadline <= now || row.expiresAt <= now) invalid();
        room.fence = body.claimNonce as string; room.startedAt = now; room.hardDeadline = now + room.maxSeconds * 1000;
        room.leaseUntil = Math.min(now + 20_000, room.hardDeadline);
      }
      if (room.leaseUntil! <= now) invalid();
      return { kind: 'claimed', version: 1, sessionId: room.sessionId, fence: room.fence, maxSeconds: room.maxSeconds,
        checkpointRevision: 0, ...deadlines(room, now) };
    }
    if (!room.fence || body.fence !== room.fence) invalid();
    const payload = { revision: body.revision, seconds: body.seconds, learnerTurns: body.learnerTurns,
      serviceFailure: body.serviceFailure ?? null, baseline: body.baseline ?? null, firstPracticeComplete: body.firstPracticeComplete === true,
      ...(body.firstPracticeStopped === true ? {firstPracticeStopped: true} : {}) };
    if (!int(payload.revision, 0, 10000) || !int(payload.seconds, 0, room.maxSeconds)
      || !int(payload.learnerTurns, 0, 1000) || (payload.serviceFailure !== null && !isServiceFailure(payload.serviceFailure))
      || (payload.baseline !== null && !validConversationPackFor(payload.baseline, row.id, room.sessionId))
      || (payload.learnerTurns > 0 && payload.baseline === null) || body.digest !== tutorDigest(payload)) invalid(400);
    if (room.endedAt) {
      if (operation === 'complete' && room.digest === body.digest) return receipt(room, now);
      invalid();
    }
    const expired = room.leaseUntil! <= now || room.hardDeadline! <= now;
    if (operation === 'checkpoint' && expired) invalid();
    if (payload.revision === room.revision) {
      if (body.digest !== room.digest && room.revision !== 0) invalid();
    } else {
      if (payload.revision !== room.revision + 1 || Number(payload.seconds) < room.seconds || Number(payload.learnerTurns) < room.learnerTurns
        || (room.objectiveComplete && !payload.firstPracticeComplete) || (room.serviceFailure && payload.serviceFailure !== room.serviceFailure)) invalid();
      // An expired worker can settle time, but cannot promote new learning evidence.
      if (!expired) {
        room.learnerTurns = payload.learnerTurns as number; room.baseline = payload.baseline as ConversationPack | null;
        room.objectiveComplete = payload.firstPracticeComplete && room.learnerTurns > 0;
      }
      room.seconds = Math.min(payload.seconds as number, Math.max(0, Math.floor((now - room.startedAt!) / 1000)));
      room.serviceFailure = payload.serviceFailure as string | null;
      room.revision = payload.revision as number; room.digest = body.digest as string;
    }
    if (operation === 'complete') {
      if (payload.firstPracticeStopped) { room.safetyStopped = true; room.baseline = null; room.objectiveComplete = false; }
      room.endedAt = now;
      room.outcome = expired || room.serviceFailure || room.safetyStopped ? 'interrupted' : room.objectiveComplete ? 'completed' : 'partial';
      row.seconds = room.serviceFailure || room.safetyStopped || room.learnerTurns === 0 ? 0 : room.seconds;
      return receipt(room, now);
    }
    room.leaseUntil = Math.min(now + 20_000, room.hardDeadline!);
    return { kind: 'checkpointed', sessionId: room.sessionId, revision: room.revision, ...deadlines(room, now) };
  });
}
/** Public receipt never exposes the worker fence, lease or another account's data. */
export function guestLiveResult(live: GuestLiveRecord, now = Date.now()) {
  const expired = !!live.fence && !live.endedAt && live.leaseUntil! <= now;
  return { sessionId: live.sessionId, outcome: live.outcome ?? (expired ? 'interrupted' : 'active'),
    seconds: live.seconds, learnerTurns: live.learnerTurns, completedAt: live.endedAt ?? null,
    pack: live.baseline };
}

/** Closing a failed connection can retain acknowledged work, never promote completion. */
export async function endGuestLive(store: GuestStore, key: string, now = Date.now()) {
  return store.update(key, row => {
    if (!row.live || row.owner) invalid();
    const live = row.live!;
    if (!live.endedAt) {
      live.endedAt = now; live.outcome = live.fence ? 'interrupted' : 'partial';
      row.seconds = live.serviceFailure || !live.learnerTurns ? 0 : live.seconds;
    }
    return guestLiveResult(live, now);
  });
}
