/**
 * The review deck on the device.
 *
 * AsyncStorage is enough for now. The deck is one small JSON array, the
 * scheduling math lives in @luvani/core, and nothing here needs a backend —
 * reviewing must cost zero metered minutes, so nothing here may ever grow a
 * network call either. When accounts arrive this file is the only thing that
 * changes.
 *
 * The deck does reach the account now, but never from here: a local write is
 * flagged for the sync engine and the engine hands merged decks back through
 * `adoptDeck` below. Reviewing itself is still a disk read and a disk write, on
 * a plane, for free.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyGrade,
  buildCardsFromSummary,
  dueCards,
  mergeCards,
  newCard,
  phraseKeyOf,
  raiseEvidenceTo,
  staggerNewCards,
  LESSONS,
  type ConvoPhrase,
  type GradeContext,
  type ReviewCard,
  type ReviewGrade,
  type SessionSummary,
} from '@luvani/core';
import type { PersistAck } from '../storage/ack.ts';
import { onUserScopeReset, scopeGeneration, userKey } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('review');

/** See progress/activity.ts for why an adopted write does not raise the flag. */
type WriteOrigin = 'local' | 'adopted';

/**
 * All writers share one key via read-modify-write, and two of them are fired
 * without awaiting (a session summary and its recap phrases can land in the
 * same beat). Chaining every mutation through one promise makes lost updates
 * impossible without reaching for anything heavier than a queue of one.
 */
let writeChain: Promise<unknown> = Promise.resolve();
const caches = new Map<string, Promise<ReviewCard[]>>();

onUserScopeReset(() => {
  caches.clear();
});

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const run = () => mutation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

async function readDeck(key: string): Promise<ReviewCard[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Every element checked, not just the array. This used to be a bare
    // `as ReviewCard[]`, so one malformed entry travelled into `dueCards`,
    // `evidenceOf` and every screen that folds the deck, and threw there
    // instead of here. A screen that throws inside a promise chain goes blank
    // and says nothing, which is how F449 reached a real phone.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCard);
  } catch {
    // A corrupt deck is not worth crashing over. Start fresh.
    return [];
  }
}

/**
 * The deck exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 *
 * Deliberately not `loadDeckFor`. The cache answers a missing key with an empty
 * deck, and the merge policy has to be able to tell "no deck here" from "a deck
 * with nothing in it" — the first has no claim on anything, the second is a
 * learner who cleared theirs.
 */
async function persistedDeck(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    // Unreadable is the same as absent here: the fold merges against nothing
    // and the account's deck is adopted whole, which is what a fresh device does.
    return null;
  }
}

/** The least a card must be to have an identity the merge can carry. */
function isCard(value: unknown): value is ReviewCard {
  return typeof value === 'object' && value !== null && typeof (value as ReviewCard).id === 'string';
}

function loadDeckFor(key: string): Promise<ReviewCard[]> {
  const cached = caches.get(key);
  if (cached) return cached;
  const pending = readDeck(key);
  caches.set(key, pending);
  return pending;
}

export function loadDeck(): Promise<ReviewCard[]> {
  return loadDeckFor(KEY());
}

/**
 * The one place this store touches the disk, and the one place it says so.
 *
 * The cache is filled first and stays filled even when the write fails, so a
 * learner on a full phone keeps reviewing exactly as they did before. What a
 * failure changes is what anyone downstream is allowed to believe: `markDirty`
 * is inside the try for the reason the registry states at sync/registry.ts:181
 * — a flag raised for a write that then failed would push whatever happened to
 * be on disk, which is the previous value.
 */
async function saveDeck(key: string, deck: readonly ReviewCard[], origin: WriteOrigin): Promise<PersistAck> {
  const next = [...deck];
  caches.set(key, Promise.resolve(next));
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
    if (origin === 'local') markDirty('review');
    return 'durable';
  } catch {
    // Storage full or unavailable. The deck still works for this launch.
    return 'failed';
  }
}

/**
 * Fold a finished session's cards into the deck, and say whether it landed.
 *
 * Merge, never replace: a card the learner has been reviewing keeps its
 * scheduling even when a new session produces the same word again.
 *
 * The acknowledgement is returned rather than swallowed, which is the whole
 * difference between the scripted path and the conversation one. This function
 * has always awaited a `PersistAck` and thrown it away, so a learner who
 * finished a lesson on a full phone watched the cards animate onto the Practice
 * tab and lost every one of them, silently, while a conversation in the same
 * second was journalled and banked at the next launch. Nothing here retries —
 * that is `bankLesson` in live/journal.ts, on the outbox that already exists —
 * but nothing downstream can retry a failure it was never told about.
 */
export function addFromSummary(summary: SessionSummary): Promise<PersistAck> {
  return serialized(async (key) => {
    const existing = await loadDeckFor(key);
    const incoming = buildCardsFromSummary(summary, LESSONS, Date.now());
    return saveDeck(key, mergeCards(existing, incoming), 'local');
  });
}

/**
 * One phrase's lifetime count of correct natural uses in conversation, as the
 * brain counted it. A total, never a delta — see `foldConvoUses`.
 */
export interface PhraseUse {
  fr: string;
  uses: number;
}

/**
 * Raise the conversation counter on every card the batch names.
 *
 * **Max, not add.** The count arrives as a lifetime total off the learner
 * model, so a batch banked twice — which is exactly what a crash between
 * banking and clearing the journal produces — leaves the counter where it
 * already was. Adding would inflate a learner's evidence every time their
 * phone died at the wrong moment.
 *
 * The arithmetic is core's (`raiseEvidenceTo`), because core owns the record
 * and a second copy of "how a counter climbs" is how two devices start
 * disagreeing about what someone knows. A count for a phrase with no card is
 * simply not applied: there is nothing to hold it, and inventing a card here
 * would bank a phrase the recap never curated.
 */
function foldConvoUses(deck: readonly ReviewCard[], uses: readonly PhraseUse[]): ReviewCard[] {
  if (uses.length === 0) return [...deck];
  const floors = new Map<string, number>();
  for (const use of uses) {
    // Two entries can name one card: the learner model keys a phrase on its
    // written form when it has one, and both forms key here to the same id.
    const id = phraseKeyOf(use.fr);
    floors.set(id, Math.max(floors.get(id) ?? 0, use.uses));
  }
  return deck.map((card) => {
    const floor = floors.get(card.id);
    return floor === undefined ? card : raiseEvidenceTo(card, { convoUses: floor });
  });
}

/**
 * Fold a free conversation's new phrases into the deck.
 *
 * Same merge contract as `addFromSummary`: identity is the French line itself,
 * so a phrase the learner is already reviewing keeps its scheduling when a
 * later conversation surfaces it again. `phraseKeyOf` is core's one rule for
 * that id, and the topics a session banks are keyed with it too — two copies of
 * it is how a topic ends up pointing at cards that do not exist.
 *
 * `stagger` spaces a session's genuinely-new cards (core's rule: the first
 * few due now, the rest tomorrow) so one conversation never builds a wall of
 * due cards. Cards already in the deck keep their scheduling either way —
 * that is `mergeCards`' contract, not this function's choice.
 *
 * `convoUses` rides the same write on purpose. The phrases and the counts come
 * out of one conversation, and splitting them across two writes would mean two
 * acknowledgements, two ways to half-fail, and a journal that cannot say which
 * half is safe to drop. One write, one answer.
 */
export async function addPhrases(
  phrases: readonly ConvoPhrase[],
  opts: { stagger?: boolean; convoUses?: readonly PhraseUse[] } = {},
): Promise<PersistAck> {
  const now = Date.now();
  const uses = opts.convoUses ?? [];
  let incoming = phrases
    .filter((p) => p.fr.trim() !== '')
    .map((p) =>
      newCard(
        {
          id: phraseKeyOf(p.fr),
          kind: 'vocab',
          front: p.fr,
          back: p.enLiteral ? `${p.en} (literally: ${p.enLiteral})` : p.en,
          context: p.note ?? '',
          ipa: '',
        },
        now,
      ),
    );
  // Nothing to merge and nothing to raise is nothing at risk, so the honest
  // answer is durable: no disk was asked for anything and none refused.
  if (incoming.length === 0 && uses.length === 0) return 'durable';
  if (opts.stagger) incoming = staggerNewCards(incoming, now);
  return serialized(async (key) => {
    const existing = await loadDeckFor(key);
    return saveDeck(key, foldConvoUses(mergeCards(existing, incoming), uses), 'local');
  });
}

/**
 * What earned a grade, alongside the grade.
 *
 * Core's `GradeContext` rather than a shape of this store's own: the review
 * screen knows whether an attempt came before the answer, a drill knows whether
 * it changed the situation, and only core decides what either is worth. Every
 * field is optional, so a caller that knows neither claims neither and grades
 * exactly as this store always has.
 */
export type CardGrade = { id: string; grade: ReviewGrade } & GradeContext;

/** Apply one grade to one card, persist, and return the updated deck. */
export function gradeCard(id: string, grade: ReviewGrade, context: GradeContext = {}): Promise<ReviewCard[]> {
  return gradeCards([{ id, grade, ...context }]);
}

/**
 * Apply a whole sitting in one read and one compact write.
 *
 * Deliberately not acknowledged. An ordinary review sitting must never wait on
 * a disk — the screen moves on the beat the learner tapped, and a card that
 * failed to persist is one card asked again, not a session lost. Durability
 * acknowledgements are for the outbox, where the alternative is deleting the
 * only copy of a conversation.
 */
export function gradeCards(grades: readonly CardGrade[]): Promise<ReviewCard[]> {
  return serialized(async (key) => {
    let updated = await loadDeckFor(key);
    const now = Date.now();
    for (const { id, grade, ...context } of grades) {
      updated = updated.map((card) => (card.id === id ? applyGrade(card, grade, now, context) : card));
    }
    await saveDeck(key, updated, 'local');
    return updated;
  });
}

// ─────────────────────────────────────── acknowledged practice grades (compare-and-set)

/**
 * One practice grade, frozen with the card it was decided against.
 *
 * `before` and `after` are fingerprints of the card's schedule (reps, lapses,
 * due, interval, ease) read off the DISK, never the optimistic cache: a cache
 * that holds a grade whose write failed is not a state anyone can resume from.
 * `after` is what `applyGrade` produces from `before` at the plan's fixed
 * instant, so a replay can tell "not yet applied" from "already applied" from
 * "moved by somebody else" without any receipt riding on the card itself.
 * `before: null` means the deck had no such card when the plan was made.
 */
export interface PlannedPracticeGrade {
  id: string;
  grade: ReviewGrade;
  transfer?: true;
  before: string | null;
  after: string | null;
}

export interface PracticeGradeReport {
  ack: PersistAck;
  /** Applied by this call. */
  applied: string[];
  /** Found already in the planned `after` state, so applied by an earlier try. */
  alreadyApplied: string[];
  /** Neither before nor after: the card moved for another reason, or is gone. Never forced. */
  skipped: string[];
}

function scheduleFingerprint(card: ReviewCard): string {
  return `${card.reps}|${card.lapses}|${card.due}|${card.intervalDays}|${card.ease}`;
}

/** The deck exactly as the disk holds it, or null when the disk cannot be read. */
async function durableDeck(key: string): Promise<ReviewCard[] | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCard) : [];
  } catch {
    return [];
  }
}

/**
 * Freeze a practice sitting's grades against the durable deck at a fixed
 * instant. Null when the deck cannot be read, in which case nothing may be
 * planned. Pure with respect to the deck: nothing is written.
 */
export function planPracticeGrades(grades: readonly CardGrade[], at: number): Promise<PlannedPracticeGrade[] | null> {
  return serialized(async (key) => {
    const deck = await durableDeck(key);
    if (deck === null) return null;
    return grades.map(({ id, grade, transfer }) => {
      const card = deck.find((c) => c.id === id);
      const context: GradeContext = transfer === true ? { transfer: true } : {};
      return {
        id,
        grade,
        ...(transfer === true ? { transfer: true as const } : {}),
        before: card ? scheduleFingerprint(card) : null,
        after: card ? scheduleFingerprint(applyGrade(card, grade, at, context)) : null,
      };
    });
  });
}

/**
 * Apply a frozen practice plan, at most once per card, and say whether it landed.
 *
 * A card still in its `before` state is graded at the plan's own instant, so the
 * result is exactly the planned `after`. A card already in `after` is counted as
 * applied and left alone. Anything else is skipped and reported: a replay never
 * grades a card twice, and never grades one that moved for another reason.
 *
 * The write is acknowledged, bound to the account at enqueue, and refused if the
 * account changed or its data was reset in between. Ordinary `gradeCards` is
 * untouched by this and still unacknowledged.
 */
export function applyPracticeGrades(plan: readonly PlannedPracticeGrade[], at: number): Promise<PracticeGradeReport> {
  const generation = scopeGeneration();
  return serialized(async (key) => {
    const report: PracticeGradeReport = { ack: 'durable', applied: [], alreadyApplied: [], skipped: [] };
    const deck = await durableDeck(key);
    if (deck === null) return { ...report, ack: 'failed' };
    const graded = new Map<string, ReviewCard>();
    const next = deck.map((card) => {
      const planned = plan.find((p) => p.id === card.id);
      if (!planned || graded.has(card.id)) return card;
      const print = scheduleFingerprint(card);
      if (planned.before !== null && print === planned.before) {
        const updated = applyGrade(card, planned.grade, at, planned.transfer === true ? { transfer: true } : {});
        graded.set(card.id, updated);
        return updated;
      }
      return card;
    });
    for (const planned of plan) {
      if (graded.has(planned.id)) report.applied.push(planned.id);
      else {
        const card = deck.find((c) => c.id === planned.id);
        if (card && planned.after !== null && scheduleFingerprint(card) === planned.after) report.alreadyApplied.push(planned.id);
        else report.skipped.push(planned.id);
      }
    }
    if (graded.size === 0) return report;
    if (scopeGeneration() !== generation) return { ...report, ack: 'failed', applied: [], skipped: [...report.skipped, ...report.applied] };
    try {
      await AsyncStorage.setItem(key, JSON.stringify(next));
    } catch {
      // The cache is deliberately NOT given these grades. A cached grade the
      // disk never took would be persisted by the next ordinary write, outside
      // this plan, and the replay could no longer tell applied from skipped.
      return { ack: 'failed', applied: [], alreadyApplied: report.alreadyApplied, skipped: [...report.skipped, ...report.applied] };
    }
    // Landed: the cache keeps serving what it held with exactly these cards
    // replaced, so an ordinary grade made this launch is not rolled back on screen.
    const cached = caches.get(key);
    const held = cached ? await cached : deck;
    caches.set(key, Promise.resolve(held.map((card) => graded.get(card.id) ?? card)));
    if (scopeGeneration() === generation) markDirty('review');
    return report;
  });
}

/** How many cards are waiting right now. Capped upstream at one calm sitting. */
export async function dueCount(now = Date.now()): Promise<number> {
  return dueCards(await loadDeck(), now).length;
}

/**
 * Fold the account's deck into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished deck, and the difference
 * is a learner's work. The engine read this key, spent a network round trip on
 * the pull, and only then adopted; a grade the learner applied in between was
 * written over by a deck computed before it existed, and — because the grade
 * left its dirty flag up — pushed to the account and lost on every device. So
 * the fold is called *here*, inside the chain, between the read and the write,
 * with the deck this store holds at that instant. Nothing is awaited between
 * the two, because the chain is the only place in this store where that is
 * true. Folding is safe rather than clever: core's `mergeDecks` is commutative
 * and idempotent, so folding a merge into a newer deck cannot lose either side.
 *
 * Scheduling is never recomputed here. Whatever due dates and intervals the
 * merge preserved are written down exactly as they arrived; deciding which of
 * two cards' scheduling survives is core's job, not this store's.
 */
function adoptDeck(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key) => {
    const folded = fold(await persistedDeck(key));
    // Validated the way anything off disk is: the fold merged in a payload
    // another device wrote, on a build this one has never seen.
    if (!Array.isArray(folded)) return 'declined';
    await saveDeck(key, folded.filter(isCard), 'adopted');
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('review', adoptDeck);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
