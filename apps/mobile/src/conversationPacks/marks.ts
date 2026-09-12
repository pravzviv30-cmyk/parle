/**
 * What this phone did with a pack (F550).
 *
 * A Conversation Pack is server-owned and the local cache is replaced by the
 * server's copy on every refresh, so a field written here would be gone by
 * the next focus. `lastPractisedAt` is that field: `buildConversationPack`
 * writes it null and nothing anywhere assigns it afterwards, so the next step
 * re-offered the same pack forever and the session card's practised chip was
 * dead code. The mark lives beside the pack instead, keyed by the pack's id,
 * and `withMarks` folds it in at read: the server's own date when it ever
 * carries one, else this phone's.
 *
 * Device-local, and named in `sync/policy.ts`'s exclusions for the reason the
 * pack cache is: a server-owned record with a second authority is two
 * records. What excluding it costs is a second phone re-offering a pack this
 * one already practised, once.
 *
 * `continuedAt` is the other half, for the thread rule: a pack whose
 * conversation was kept going is not offered as the thread again.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConversationPack } from '@luvani/core';

import { userKey } from '../storage/scope.ts';

const VERSION = 1;

export const MAX_PACK_MARKS = 60;

export interface PackMark {
  packId: string;
  practisedAt: number | null;
  continuedAt: number | null;
}

interface StoredMarks {
  version: typeof VERSION;
  marks: PackMark[];
}

export type MarkField = 'practisedAt' | 'continuedAt';

const KEY = () => userKey('packMarks');

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested, never when it runs.
  const key = KEY();
  const run = () => mutation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

function isMark(value: unknown): value is PackMark {
  if (typeof value !== 'object' || value === null) return false;
  const { packId, practisedAt, continuedAt } = value as Record<string, unknown>;
  const stamp = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
  return typeof packId === 'string' && stamp(practisedAt) && stamp(continuedAt);
}

async function readStored(key: string): Promise<PackMark[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredMarks> | null;
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.marks)) return [];
    return parsed.marks.filter(isMark);
  } catch {
    return [];
  }
}

export function loadPackMarks(): Promise<PackMark[]> {
  return readStored(KEY());
}

/** The most recent thing a mark records, for the cap. */
function latest(mark: PackMark): number {
  return Math.max(mark.practisedAt ?? 0, mark.continuedAt ?? 0);
}

/**
 * One mark per pack, the given field stamped, the least recently touched
 * dropped past the cap. Pure, so the cap can be asked without a disk.
 */
export function withMark(marks: readonly PackMark[], packId: string, field: MarkField, now: number): PackMark[] {
  const existing = marks.find((mark) => mark.packId === packId);
  const stamped: PackMark = { packId, practisedAt: null, continuedAt: null, ...existing, [field]: now };
  const rest = marks.filter((mark) => mark.packId !== packId);
  return [stamped, ...rest].sort((a, b) => latest(b) - latest(a)).slice(0, MAX_PACK_MARKS);
}

function stamp(packId: string, field: MarkField, now: number): Promise<void> {
  return serialized(async (key) => {
    const next: StoredMarks = { version: VERSION, marks: withMark(await readStored(key), packId, field, now) };
    try {
      await AsyncStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage full or unavailable. The pack is offered once more; nothing else.
    }
  });
}

export function markPackPractised(packId: string, now: number): Promise<void> {
  return stamp(packId, 'practisedAt', now);
}

export function markPackContinued(packId: string, now: number): Promise<void> {
  return stamp(packId, 'continuedAt', now);
}

/**
 * The packs with this phone's marks folded in. The server's own date wins
 * when it ever carries one; the mark stands in until then.
 */
export function withMarks(packs: readonly ConversationPack[], marks: readonly PackMark[]): ConversationPack[] {
  return packs.map((pack) => {
    if (pack.lastPractisedAt !== null) return pack;
    const mark = marks.find((entry) => entry.packId === pack.id);
    if (!mark || mark.practisedAt === null) return pack;
    return { ...pack, lastPractisedAt: new Date(mark.practisedAt).toISOString() };
  });
}

/** When this phone kept the pack's conversation going, or null. */
export function continuedAt(pack: Pick<ConversationPack, 'id'>, marks: readonly PackMark[]): number | null {
  return marks.find((entry) => entry.packId === pack.id)?.continuedAt ?? null;
}

/**
 * The pack a drill node belongs to, or null.
 *
 * Two node shapes name a pack: the pack's own id, which My French and the
 * Practice feed open, and `replay:<id>`, which the replay card opens. Anything
 * else is a lesson or a topic node and marks nothing.
 */
export function packIdOfNode(nodeId: string, packs: readonly Pick<ConversationPack, 'id'>[]): string | null {
  const id = nodeId.startsWith('replay:') ? nodeId.slice('replay:'.length) : nodeId;
  return packs.some((pack) => pack.id === id) ? id : null;
}
