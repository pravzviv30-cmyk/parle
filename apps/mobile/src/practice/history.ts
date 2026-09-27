/**
 * Conversation-practice history: what a learner actually did with a saved
 * conversation, as small immutable facts that follow the account.
 *
 * Pure, and deliberately free of AsyncStorage, because `sync/policy.ts` merges
 * it under plain node and the store (`historyStore.ts`) validates with the same
 * functions the merge does. One validator, so the disk and the merge can never
 * disagree about which rows exist.
 *
 * What an event may hold is the whole privacy promise, so the validator is
 * strict rather than forgiving: identifiers, times, a bounded list of per-target
 * outcomes, and nothing else. An unknown key rejects the event, which is how a
 * field carrying the learner's typed answer, a transcript or a recording can
 * never ride along, even from a future build.
 *
 * Said plainly: a `phraseKey` is not opaque. It is core's `phraseKeyOf`, the
 * saved French phrase itself, lowercased, exactly as the review deck (already
 * synced) keys it. So the history carries the saved learning phrase a target
 * drilled, and never what the learner answered.
 *
 * Three kinds are synced:
 *
 * - `session-completed`: a practice sitting finished with answered work. Its id
 *   is the stable sitting id, so a retry, a relaunch or a duplicate delivery is
 *   the same row. Up to six target outcomes, each attributed to its own source,
 *   so review in the same sitting never counts as practice of a conversation.
 * - `warmup-completed`: the recognition warm-up for one conversation finished.
 *   It shows the French, so it is exposure, never recall.
 * - `revisit-started`: a tutor revisit room opened for one conversation. It
 *   says a revisit started and nothing about how it went.
 *
 * A fourth shape, `legacy-mark`, exists only as a reader view over the old
 * device-local `packMarks`. It is never stored here and never synced, so an old
 * "practised" tap cannot become recall or live-use evidence by migration.
 *
 * The merge is a plain set union on the whole canonical event, sorted by
 * `(at, kind, id, rendering)`, then bounded: at most 150 events and at most
 * `MAX_PRACTICE_HISTORY_BYTES` of serialised events. A newest-suffix cut on
 * its own is NOT associative under a byte budget (an event dropped by an
 * earlier merge stops acting as the stopper in a later one), so the cut is
 * recorded as a `floor`: the `at` of the newest event that did not fit. Every
 * event at or below the floor is dropped, the floor only ever rises (max of
 * both sides), and cutting whole `at` groups makes the result a function of the
 * union alone: commutative, associative and idempotent, like every policy in
 * `sync/policy.ts`. Identical copies of an event are one row; differing copies
 * of one `(kind, id)` can only come from a bug or a forged payload, storage
 * keeps both and `uniquePracticeEvents`, the view readers get, shows one.
 *
 * Links to packs are kept even when the pack is later deleted. Readers filter
 * by the pack cache they already hold; the history carries no pack content, so
 * a dangling link resurrects nothing.
 */

import {
  conversationPackIdOf,
  PRACTICE_QUEUE_CAP,
  type PracticeOutcome,
  type PracticeSource,
} from '@luvani/core';
import { stableStringify, utf8Bytes } from '../sync/envelope.ts';

/** The inner schema version this build writes. `sync/policy.ts` declares the same. */
export const PRACTICE_HISTORY_VERSION = 1;

/** Newest events kept, on disk and in the merge. */
export const MAX_PRACTICE_EVENTS = 150;

/**
 * Longest phrase key an event may carry, in UTF-16 units. Core's `phraseKeyOf`
 * has no cap of its own, so this is a sanity bound far above any saved phrase
 * rather than a limit a real one could hit: six targets at this length, every
 * unit escaped by JSON at six bytes, is 72 KB, well inside the byte budget.
 */
export const MAX_PHRASE_KEY_LENGTH = 2000;

/**
 * The byte budget for the serialised `events` array: UTF-8 bytes of
 * `JSON.stringify` (real escaping, measured, never estimated), leaving room
 * under the 512 KiB sync envelope for the wrapper and the version field.
 */
export const MAX_PRACTICE_HISTORY_BYTES = 448 * 1024;

/** Attempts is a count of asks; the drill's mercy rule ends far below this. */
export const MAX_ATTEMPTS = 20;

const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;

export interface PracticeEventTarget {
  phraseKey: string;
  source: PracticeSource;
  outcome: PracticeOutcome;
  attempts: number;
}

export interface SessionCompletedEvent {
  kind: 'session-completed';
  /** The stable sitting id. */
  id: string;
  at: number;
  /** The conversation this sitting practised, or null for review only. Always one a target names. */
  packId: string | null;
  targets: PracticeEventTarget[];
}

export interface WarmupCompletedEvent {
  kind: 'warmup-completed';
  id: string;
  at: number;
  packId: string;
}

export interface RevisitStartedEvent {
  kind: 'revisit-started';
  /** The live session id. */
  id: string;
  at: number;
  packId: string;
}

export type PracticeEvent = SessionCompletedEvent | WarmupCompletedEvent | RevisitStartedEvent;

export interface StoredPracticeHistory {
  version: typeof PRACTICE_HISTORY_VERSION;
  events: PracticeEvent[];
  /** Events at or before this instant have aged out and are never re-admitted. 0 when nothing has. */
  floor: number;
}

/** Read-only view of an old device-local pack mark. Never stored, never synced. */
export interface LegacyPracticeMark {
  kind: 'legacy-mark';
  /** `legacy:<label>:<packId>`, stable, so a reader can key a row on it. */
  id: string;
  packId: string;
  at: number;
  label: 'practised' | 'continued';
}

export type PracticeHistoryItem = PracticeEvent | LegacyPracticeMark;

// ─────────────────────────────────────────────────────────────── validation

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && own.every((key) => keys.includes(key));
}

export function isEventId(value: unknown): value is string {
  return typeof value === 'string' && EVENT_ID.test(value);
}

function isPackId(value: unknown): value is string {
  return typeof value === 'string' && conversationPackIdOf(value) === value;
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isSource(value: unknown): value is PracticeSource {
  if (!isRecord(value)) return false;
  if (value.kind === 'review') return hasExactly(value, ['kind']);
  if (value.kind === 'pack') return hasExactly(value, ['kind', 'packId']) && isPackId(value.packId);
  return false;
}

function isTarget(value: unknown): value is PracticeEventTarget {
  if (!isRecord(value) || !hasExactly(value, ['phraseKey', 'source', 'outcome', 'attempts'])) return false;
  const { phraseKey, source, outcome, attempts } = value;
  if (typeof phraseKey !== 'string' || !phraseKey.startsWith('phrase:')) return false;
  if (phraseKey.length > MAX_PHRASE_KEY_LENGTH || phraseKey.trim() !== phraseKey || phraseKey === 'phrase:') return false;
  if (!isSource(source)) return false;
  if (outcome !== 'recalled' && outcome !== 'practised' && outcome !== 'unresolved') return false;
  if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1 || attempts > MAX_ATTEMPTS) return false;
  // Self-consistent or refused: core claims recall only for a first-attempt answer.
  if (outcome === 'recalled' && attempts !== 1) return false;
  return true;
}

/**
 * The one strict validator for a synced practice event.
 *
 * Also refuses events that contradict themselves: a completed sitting with no
 * targets or more than six, one phrase twice, targets from two conversations,
 * or a `packId` that no target is attributed to (or a pack target with none).
 */
export function isPracticeEvent(value: unknown): value is PracticeEvent {
  if (!isRecord(value)) return false;
  if (!isEventId(value.id) || !isTime(value.at)) return false;
  switch (value.kind) {
    case 'warmup-completed':
    case 'revisit-started':
      return hasExactly(value, ['kind', 'id', 'at', 'packId']) && isPackId(value.packId);
    case 'session-completed': {
      if (!hasExactly(value, ['kind', 'id', 'at', 'packId', 'targets'])) return false;
      const { packId, targets } = value;
      if (packId !== null && !isPackId(packId)) return false;
      if (!Array.isArray(targets) || targets.length === 0 || targets.length > PRACTICE_QUEUE_CAP) return false;
      if (!targets.every(isTarget)) return false;
      if (new Set(targets.map((t) => t.phraseKey)).size !== targets.length) return false;
      const packs = new Set(targets.flatMap((t) => (t.source.kind === 'pack' ? [t.source.packId] : [])));
      if (packs.size > 1) return false;
      const named = packs.size === 0 ? null : [...packs][0]!;
      return named === packId;
    }
    default:
      return false;
  }
}

/** A stored blob this build can read, or null. A newer version is not readable here. */
export function readPracticeHistory(value: unknown): StoredPracticeHistory | null {
  if (!isRecord(value) || value.version !== PRACTICE_HISTORY_VERSION || !Array.isArray(value.events)) return null;
  return { version: PRACTICE_HISTORY_VERSION, ...bound(value.events.filter(isPracticeEvent), floorOf(value)) };
}

function floorOf(value: unknown): number {
  const floor = isRecord(value) ? value.floor : undefined;
  return typeof floor === 'number' && Number.isSafeInteger(floor) && floor > 0 ? floor : 0;
}

// ──────────────────────────────────────────────────────────────────── merge

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function rendering(event: PracticeEvent): string {
  return stableStringify(event);
}

/** The UTF-8 size an event adds to the serialised array, separator included. */
export function eventBytes(event: PracticeEvent): number {
  return utf8Bytes(JSON.stringify(event)) + 1;
}

/**
 * Set union on the whole rendering, drop everything at or below the floor,
 * then walk from the newest end; the first event that breaks either bound
 * raises the floor to its `at`, and every event at or below that goes too.
 */
function bound(events: readonly PracticeEvent[], floorIn: number): { events: PracticeEvent[]; floor: number } {
  const held = new Map<string, PracticeEvent>();
  for (const event of events) if (event.at > floorIn) held.set(rendering(event), event);
  const sorted = [...held.entries()]
    .sort(
      ([rx, x], [ry, y]) =>
        x.at - y.at || compareText(x.kind, y.kind) || compareText(x.id, y.id) || compareText(rx, ry),
    )
    .map(([, event]) => event);
  let bytes = 2;
  let floor = floorIn;
  for (let at = sorted.length - 1, count = 0; at >= 0; at -= 1, count += 1) {
    bytes += eventBytes(sorted[at]!);
    if (count >= MAX_PRACTICE_EVENTS || bytes > MAX_PRACTICE_HISTORY_BYTES) {
      floor = Math.max(floor, sorted[at]!.at);
      break;
    }
  }
  return { events: sorted.filter((event) => event.at > floor), floor };
}

/**
 * One event per `(kind, id)`, oldest first: the reader view. Where two differing
 * copies exist (never produced by this app), the canonical max is shown, so
 * every device shows the same one.
 */
export function uniquePracticeEvents(events: readonly PracticeEvent[]): PracticeEvent[] {
  const held = new Map<string, PracticeEvent>();
  for (const event of events) {
    const id = `${event.kind}\u0000${event.id}`;
    const seen = held.get(id);
    held.set(id, seen === undefined || compareText(rendering(event), rendering(seen)) > 0 ? event : seen);
  }
  return events.filter((event) => held.get(`${event.kind}\u0000${event.id}`) === event);
}

/** Merge two events lists with no floor. Invalid entries on either side contribute nothing. */
export function mergePracticeEvents(a: readonly unknown[], b: readonly unknown[]): PracticeEvent[] {
  return bound([...a, ...b].filter(isPracticeEvent), 0).events;
}

/** The sync policy's merge: two stored blobs, either possibly absent or corrupt. The floor is the max of both. */
export function mergePracticeHistory(local: unknown, remote: unknown): StoredPracticeHistory {
  const events = (side: unknown): unknown[] =>
    isRecord(side) && Array.isArray(side.events) ? (side.events as unknown[]) : [];
  const merged = bound([...events(local), ...events(remote)].filter(isPracticeEvent), Math.max(floorOf(local), floorOf(remote)));
  return { version: PRACTICE_HISTORY_VERSION, ...merged };
}

/** Add events to a stored history, keeping its floor. */
export function withPracticeEvents(stored: StoredPracticeHistory, added: readonly PracticeEvent[]): StoredPracticeHistory {
  return { version: PRACTICE_HISTORY_VERSION, ...bound([...stored.events, ...added], stored.floor) };
}

// ────────────────────────────────────────────────────────────────── readers

/** Every event linked to one conversation, oldest first. */
export function eventsForPack(events: readonly PracticeEvent[], packId: string): PracticeEvent[] {
  return events.filter((event) => event.packId === packId);
}

/**
 * The targets of a completed sitting that practised this conversation. Review
 * targets in the same sitting are never counted for the pack.
 */
export function packTargetsOf(event: PracticeEvent, packId: string): PracticeEventTarget[] {
  if (event.kind !== 'session-completed') return [];
  return event.targets.filter((t) => t.source.kind === 'pack' && t.source.packId === packId);
}

/** Whether a sitting with this id is already in the history. */
export function hasCompletedSitting(events: readonly PracticeEvent[], sittingId: string): boolean {
  return events.some((event) => event.kind === 'session-completed' && event.id === sittingId);
}

/**
 * Old device-local pack marks, as reader-only labels. They say a pack was
 * practised or continued on this phone before this history existed, and
 * nothing more: never recalled, never used while speaking.
 */
export function legacyMarkItems(
  marks: readonly { packId: string; practisedAt: number | null; continuedAt: number | null }[],
): LegacyPracticeMark[] {
  const out: LegacyPracticeMark[] = [];
  for (const mark of marks) {
    if (!isPackId(mark.packId)) continue;
    if (isTime(mark.practisedAt)) out.push({ kind: 'legacy-mark', id: `legacy:practised:${mark.packId}`, packId: mark.packId, at: mark.practisedAt, label: 'practised' });
    if (isTime(mark.continuedAt)) out.push({ kind: 'legacy-mark', id: `legacy:continued:${mark.packId}`, packId: mark.packId, at: mark.continuedAt, label: 'continued' });
  }
  return out.sort((x, y) => x.at - y.at || compareText(x.packId, y.packId) || compareText(x.label, y.label));
}

/** A sitting or warm-up id: stable once minted, unique enough per device, valid as an event id. */
export function mintPracticeId(now: number, prefix: 's' | 'w' = 's'): string {
  return `${prefix}${Math.max(0, Math.floor(now)).toString(36)}.${Math.random().toString(36).slice(2, 10) || '0'}`;
}
