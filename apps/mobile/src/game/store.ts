/**
 * The account-synced game facts on this device (Come alive, Phase 0, F729).
 *
 * `progress/activity.ts`'s shape, deliberately: one key (`game`), one
 * serialised write chain, the account bound when the work is asked for and
 * checked against the scope generation just before the write, so neither a
 * sign-out nor an account deletion mid-await can land one learner's streak
 * cover in another's namespace or bring a deleted namespace back.
 *
 * No cache: every read comes off the disk, so "already recorded" means
 * "already durable", and a replayed write is a no-op with no dirty flag.
 * Shapes, the strict reader and the merge live in `model.ts`, shared with
 * `sync/policy.ts`.
 *
 * Reads are strict. A blob from a newer build, a blob with a row this build
 * would never write (a cover kind it does not know, a string where a moment
 * belongs) is refused, not repaired: every write answers `failed` and leaves
 * the bytes alone, and the adopter declines. A repaired copy would be pushed
 * back to the account as if it were the learner's, and the rows it dropped
 * would be gone from every device.
 *
 * Nothing reads this in a screen yet. `game/settle.ts` (Phase 1) is the one
 * writer the product will have; these helpers are what it writes through.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayKey, StreakCover } from '@luvani/core';

import type { PersistAck } from '../storage/ack.ts';
import { onUserScopeReset, scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
import { sameData } from '../sync/envelope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';
import {
  emptyGame,
  isGameRowsPatch,
  landedIn,
  readGame,
  seenIn,
  withGameRows,
  type BadgeAward,
  type BonusRow,
  type GameRows,
  type GameSitting,
  type QuestClaimRow,
  type QuestDayRow,
  type SeenMark,
  type StoredGame,
  type XpMonth,
} from './model.ts';

export const GAME_SUFFIX = 'game';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('game');

/**
 * Who asked for this write. A learner's own sitting is news the account has
 * not heard, so it raises the dirty flag; an adopted merge is this device
 * catching up, and flagging it would push the account's own state back to it.
 */
type WriteOrigin = 'local' | 'adopted';

// Writes are serialised through one chain, so two sittings settling at once
// cannot each read the same blob and write over the other.
let chain: Promise<unknown> = Promise.resolve();

/** Run a mutation alone on the chain, with the account bound at enqueue. */
function serialized<T>(mutation: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = KEY();
  const owner = scopeGeneration();
  const run = () => mutation(key, owner);
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

/** The disk, read strictly. Absent is an empty record; anything this build cannot vouch for is not. */
async function readStored(key: string): Promise<StoredGame | 'newer' | 'unreadable'> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return 'unreadable';
  }
  if (raw === null) return emptyGame();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return 'unreadable';
  }
  const game = readGame(parsed);
  return game === null ? 'unreadable' : game;
}

/**
 * The blob exactly as the sync engine reads it, or null when this account has
 * never written one. Rejects on bytes this build cannot read, so an adoption
 * never writes a merge over local data nobody has looked at.
 */
async function persisted(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  const game = readGame(parsed);
  if (game === null || game === 'newer') throw new Error('Game progress is unreadable');
  return parsed;
}

/** Write only if the scope this work was bound under still stands. */
async function write(key: string, owner: number, value: StoredGame, origin: WriteOrigin): Promise<PersistAck> {
  if (owner !== scopeGeneration()) return 'failed';
  try {
    if (!(await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify(value))))) return 'failed';
  } catch {
    return 'failed';
  }
  if (origin === 'local') markDirty(GAME_SUFFIX);
  return 'durable';
}

/**
 * Add rows, rolled up and bounded, and say whether they are on disk.
 *
 * `durable` when every row offered is held by its identity, whether this write
 * put it there or an earlier one did (a replay writes nothing and raises no
 * flag). `failed` for a row this build would not write, an unreadable or newer
 * disk, a refused write, a changed account, or a row the age window cut the
 * moment it arrived.
 */
function add(added: Partial<GameRows>): Promise<PersistAck> {
  if (!isGameRowsPatch(added)) return Promise.resolve('failed');
  return serialized(async (key, owner) => {
    const stored = await readStored(key);
    if (stored === 'newer' || stored === 'unreadable' || owner !== scopeGeneration()) return 'failed';
    const next = withGameRows(stored, added);
    if (!landedIn(next, added)) return 'failed';
    if (sameData(next, stored)) return 'durable';
    return write(key, owner, next, 'local');
  });
}

/**
 * The account's game facts on this device. Rejects when the disk cannot be
 * read or was written by a newer build, so a screen can tell a failed read
 * from a learner with nothing yet.
 */
export async function loadGame(): Promise<StoredGame> {
  const stored = await readStored(KEY());
  if (stored === 'unreadable' || stored === 'newer') throw new Error('Game progress is unreadable');
  return stored;
}

/** A finished sitting the activity log does not hold: one that earned no XP. */
export function appendSitting(sitting: GameSitting): Promise<PersistAck> {
  return add({ sittings: [sitting] });
}

/** Covers that bridge a streak. One per day; the earliest written keeps the day. */
export function addCovers(covers: readonly StreakCover[]): Promise<PersistAck> {
  return add({ covers: [...covers] });
}

/** The daily goal was met on this local day. */
export function markGoalDay(day: DayKey): Promise<PersistAck> {
  return add({ goalDays: [day] });
}

/**
 * The three quests a day was dealt. Frozen the first time: a day already
 * held answers `durable` and is never re-dealt, so a change in eligibility
 * later that day cannot reshuffle what the learner was shown.
 */
export function setQuestDay(row: QuestDayRow): Promise<PersistAck> {
  if (!isGameRowsPatch({ questDays: [row] })) return Promise.resolve('failed');
  return serialized(async (key, owner) => {
    const stored = await readStored(key);
    if (stored === 'newer' || stored === 'unreadable' || owner !== scopeGeneration()) return 'failed';
    if (stored.questDays.some((held) => held.day === row.day)) return 'durable';
    const next = withGameRows(stored, { questDays: [row] });
    if (!landedIn(next, { questDays: [row] })) return 'failed';
    return write(key, owner, next, 'local');
  });
}

/** Quests (and the day's chest) claimed. A claim already held is kept, earliest first. */
export function addClaims(claims: readonly QuestClaimRow[]): Promise<PersistAck> {
  return add({ claims: [...claims] });
}

/** Fixed "for practising" XP, once per key however many devices credit it. */
export function addBonus(rows: readonly BonusRow[]): Promise<PersistAck> {
  return add({ bonus: [...rows] });
}

/** Capped activity XP per month. Only ever raised, so the total shown never falls. */
export function raiseXpMonths(rows: readonly XpMonth[]): Promise<PersistAck> {
  return add({ xpMonths: [...rows] });
}

/**
 * Badges awarded. Kept for good: no window ages one out and no merge drops
 * one, and a dated award replaces one counted from older practice.
 */
export function awardBadges(awards: readonly BadgeAward[]): Promise<PersistAck> {
  return add({ badges: [...awards] });
}

/** Celebrations played, so no device plays them again. */
export function markSeen(marks: readonly SeenMark[]): Promise<PersistAck> {
  return add({ seen: [...marks] });
}

/** Whether a celebration has already played anywhere. Rejects when the disk cannot be read. */
export async function hasSeen(key: string): Promise<boolean> {
  return seenIn(await loadGame(), key);
}

/**
 * Fold the account's game facts into this device's, on this store's chain.
 * The folded value is read exactly as a disk read is, so a row the merge keeps
 * is a row this store keeps, and a fold this build cannot read is declined.
 * No dirty flag: adopting is catching up, not a new local change.
 */
function adoptGame(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key, owner) => {
    let current: unknown;
    try {
      current = await persisted(key);
    } catch {
      return 'declined';
    }
    const folded = readGame(fold(current));
    if (folded === null || folded === 'newer') return 'declined';
    return (await write(key, owner, folded, 'adopted')) === 'durable' ? 'adopted' : 'declined';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('game', adoptGame);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
