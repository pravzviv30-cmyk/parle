/**
 * Merging two copies of one learner's deck.
 *
 * Two devices can both hold the same deck and both be right about it: the
 * phone reviewed six cards on the train, the tablet reviewed four in the
 * evening, and neither knew about the other. When they meet, nothing may be
 * rescheduled and nothing may be recomputed. A card that has been climbing for
 * three weeks has earned that interval, and an interval is a claim about a
 * memory — regenerating it from scratch would be inventing evidence.
 *
 * So this is a union by card id, and per id the *whole card* comes from one
 * side. Never a field-wise blend: `due`, `intervalDays`, `ease`, `reps` and
 * `lapses` are one coherent scheduling state produced by `applyGrade`, and a
 * card assembled out of two of them describes a review session that never
 * happened.
 *
 * ## Which side wins, and why it is not a clock
 *
 * The obvious rule is "the side graded most recently wins". A `ReviewCard`
 * carries no last-graded timestamp, and adding one would mean a wall clock
 * deciding a learner's review history across two devices whose clocks disagree
 * — the one input this merge should never trust.
 *
 * It does carry something better. `applyGrade` increments at most one of
 * `reps` (good, easy) or `lapses` (again) on each grade, and an assisted good
 * increments neither, so `reps + lapses` counts grades applied — monotone,
 * immune to skew, and already on disk. Both copies descend from one ancestor,
 * so the copy with more grades is strictly the copy that was reviewed more
 * recently, and it holds the other's history plus its own. `gradesApplied` is
 * that number and it is the primary key here.
 *
 * The accepted loss is the same one per-item last-write-wins always carries:
 * if the phone graded a card twice and the tablet graded it once, the tablet's
 * one grade is dropped rather than replayed. Replaying it would need an
 * operation log; folding it in would need a fifth opinion about what a card is
 * worth. The learner keeps the longer review history, which is the one that
 * says more about their memory.
 *
 * ## The first exception, and why the counters are it
 *
 * The `evidence` block is not scheduling. `due`, `intervalDays` and `ease` are
 * a guess about a memory, computed together and only true together, which is
 * exactly why they travel as one card. `retrievals`, `convoUses` and
 * `transfers` are a tally of things the learner did, kept by whichever device
 * was in the room at the time, and two devices counted different halves of the
 * same week. Giving the winner's tally the whole card would delete the four
 * conversations the tablet heard because the phone graded one more flashcard —
 * and unlike a dropped grade, there is no history left to re-derive them from.
 *
 * So the `evidence` block, alone, merges field-wise: the larger of each count,
 * whichever side won the card. That is safe here for the same reason it would
 * be wrong for `ease`. The counters are monotone by construction (see
 * `evidence.ts`), so `max` over them is commutative, idempotent and
 * associative, and folding it in extends the proof below instead of holing it.
 *
 * ## The third exception: a cleared conversation name
 *
 * A card earned in a conversation carries a note naming it, and the pack id
 * behind that name (`contextPackId`). When the learner deletes the
 * conversation, the note becomes `PAST_CONVERSATION_NOTE` and the id goes. A
 * second device that reviewed the card more after that would win the whole
 * card and bring the name back, so the note, alone, follows a rule instead of
 * the winner: if either copy is cleared, the merged card is cleared and names
 * no pack (F878). "Cleared absorbs" is an OR over the copies, so commutative,
 * idempotent and associative, the same shape as "absent absorbs" for sources.
 *
 * ## Convergence
 *
 * The winner is an argmax over a total order on values, and the union is a set
 * union, so `mergeDecks` is commutative, idempotent **and** associative. Two
 * devices reconciling in any order, any number of times, with duplicates and
 * replays, land on the same deck. That is the whole reason the sync engine
 * needs no operation log, and `merge.test.ts` property-tests it rather than
 * asserting it.
 *
 * The counters, the sources and the note keep that proof honest by staying
 * out of `canonical`. An order the tiebreak reads has to be an order over
 * values this merge does not write. The note comes back only as the very last
 * tiebreak in `winner`, between copies identical in everything else, so the
 * order stays total. That is safe even though the merge rewrites the note:
 * copies that reach that tiebreak differ only in the note, so the winner
 * decides nothing but the note, and the note comes out as "cleared if any
 * copy was cleared, else the greatest uncleared note", which is a fold over
 * the set and does not depend on grouping.
 *
 * Input is `unknown` on both sides on purpose: a corrupt blob off the wire
 * contributes nothing and never takes good local data with it.
 */

import { NO_EVIDENCE, evidenceOf, type PhraseEvidence } from './evidence.ts';
import type { ReviewCard } from './scheduler.ts';
import { sourcesOf, unionSources } from './sources.ts';

/**
 * What a conversation's provenance note becomes once the conversation is
 * deleted. The card, its schedule and its evidence stay; the name goes. It wins
 * every merge by rule (`mergeCard`), not by how it sorts.
 */
export const PAST_CONVERSATION_NOTE = 'Saved from a past conversation';

const CARD_KINDS: readonly string[] = ['vocab', 'phoneme', 'turn'];

/**
 * How many grades this card has been through — `reps + lapses`, because
 * `applyGrade` increments exactly one of them per grade. The deck's ordering
 * primitive: more grades means more review history, with no clock involved.
 */
export function gradesApplied(card: ReviewCard): number {
  return card.reps + card.lapses;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A card off the wire, or off a disk that a previous version wrote.
 *
 * Strict about the fields the merge orders on and the scheduler dereferences,
 * because a NaN in `ease` would make the ordering itself non-deterministic and
 * a non-deterministic ordering is a divergence, not a display bug. Anything
 * that fails is dropped from that side alone — never fatal, never contagious.
 *
 * `evidence` is deliberately not among them, in either direction. A card
 * written before the counters existed carries no block and must still merge,
 * and a card whose block is nonsense must not lose the weeks of scheduling
 * sitting beside it over a bad integer. A junk block is read as zero by
 * `countersOf` and rewritten on the way out, which costs the learner one claim
 * about one phrase — the smallest thing that can go wrong here.
 */
function isReviewCard(value: unknown): value is ReviewCard {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== 'string' || c.id.length === 0) return false;
  if (typeof c.kind !== 'string' || !CARD_KINDS.includes(c.kind)) return false;
  for (const field of ['front', 'back', 'context', 'ipa']) {
    if (typeof c[field] !== 'string') return false;
  }
  for (const field of ['addedAt', 'due', 'intervalDays', 'ease', 'reps', 'lapses']) {
    if (!isFiniteNumber(c[field])) return false;
  }
  return true;
}

/** Every card on one side, keyed by id. A repeated id inside one side folds first. */
function deckOf(side: unknown): Map<string, ReviewCard> {
  const out = new Map<string, ReviewCard>();
  if (!Array.isArray(side)) return out;
  for (const entry of side) {
    if (!isReviewCard(entry)) continue;
    const held = out.get(entry.id);
    out.set(entry.id, held === undefined ? oneCopy(entry) : mergeCard(held, entry));
  }
  return out;
}

/**
 * A byte-stable rendering of a card's scheduling, used only as the last
 * tiebreak. Keys are sorted so two devices that built the same card in a
 * different field order still compare equal.
 *
 * `evidence` is left out, and the omission is load-bearing rather than tidy. A
 * tiebreak has to order values this merge does not rewrite, and the counters
 * are now the one thing it does. Fold them in and the merged block — which is
 * neither side's block — re-enters the comparison one round later, so
 * `mergeDecks(mergeDecks(a, b), c)` can keep a different card's `ipa` than
 * `mergeDecks(a, mergeDecks(b, c))`, and the merge is no longer associative.
 * Two cards that differ only in their counters therefore tie here, which is
 * the right answer: everything this tiebreak chooses between is identical.
 */
const UNORDERED = new Set(['evidence', 'sources', 'context', 'contextPackId']);

function canonical(card: ReviewCard): string {
  const rec = card as unknown as Record<string, unknown>;
  return Object.keys(rec)
    .filter((key) => !UNORDERED.has(key))
    .sort()
    .map((k) => `${k}=${JSON.stringify(rec[k]) ?? 'null'}`)
    .join(' ');
}

/**
 * The whole card from one side, chosen by a total order: more grades, then the
 * later `due`, then the canonical rendering.
 *
 * The last two only ever run when both copies have been through the same
 * number of grades, which for two copies of one card normally means they are
 * the same card. They exist so that "normally" is not load-bearing: a total
 * order is what makes the merge associative, and a merge that is only
 * *usually* deterministic is a merge that diverges on the day it matters.
 */
function winner(a: ReviewCard, b: ReviewCard): ReviewCard {
  const grades = gradesApplied(a) - gradesApplied(b);
  if (grades !== 0) return grades > 0 ? a : b;
  if (a.due !== b.due) return a.due > b.due ? a : b;
  const ca = canonical(a);
  const cb = canonical(b);
  if (ca !== cb) return ca > cb ? a : b;
  const na = noteKey(a);
  const nb = noteKey(b);
  if (na === nb) return a;
  return na > nb ? a : b;
}

/**
 * The note and its pack id as one comparable string, the order's last word.
 * For one note, a copy that knows its pack sorts above a legacy copy that does
 * not, so the merge keeps the exact match `forgetDeletedNames` needs.
 */
function noteKey(card: ReviewCard): string {
  const id = typeof card.contextPackId === 'string' ? card.contextPackId : '';
  return JSON.stringify([card.context, id === '' ? 0 : 1, id]);
}

/**
 * The counters on one card, with junk read as zero.
 *
 * `evidenceOf` is the repo's one reader of this record and already treats a
 * NaN, a negative, a string or a missing count as zero, so the counting rules
 * stay there rather than growing a second opinion here. It does dereference
 * the block to do it, though, and `isReviewCard` admits a card carrying
 * `evidence: null` — which a tampered or truncated payload can say, and which
 * must cost one claim about one phrase rather than throw on the screen reading
 * the card. Hence this guard, and only this guard.
 */
function countersOf(card: ReviewCard): PhraseEvidence {
  const held: unknown = card.evidence;
  if (held === null || typeof held !== 'object') return NO_EVIDENCE;
  return evidenceOf(card);
}

/** The larger of each count. Monotone, so neither side can be counted down. */
function higherCounts(a: PhraseEvidence, b: PhraseEvidence): PhraseEvidence {
  // Built in the one key order `addEvidence` and `raiseEvidenceTo` write, so
  // the bytes two devices push for the same counts are the same bytes.
  return {
    retrievals: Math.max(a.retrievals, b.retrievals),
    convoUses: Math.max(a.convoUses, b.convoUses),
    transfers: Math.max(a.transfers, b.transfers),
  };
}

/**
 * A card in the single shape this merge emits: no block at all when every
 * count is zero, which is precisely what `evidence.ts` means by absent, and
 * otherwise the three counts freshly written in order.
 *
 * Rewriting a block that already said the right thing looks wasteful and is
 * the point. Two devices can spell the same counts differently — a `3.7`, an
 * inherited `null`, a key nobody wrote — and a merge whose output depends on
 * which spelling arrived first has stopped converging. One shape out means
 * merging the output again cannot move it.
 */
function counted(card: ReviewCard, counters: PhraseEvidence): ReviewCard {
  if (counters.retrievals > 0 || counters.convoUses > 0 || counters.transfers > 0) {
    return { ...card, evidence: counters };
  }
  if (card.evidence === undefined) return card;
  const { evidence: _zero, ...bare } = card;
  return bare;
}

/**
 * Two copies of one card, reconciled: the whole card from `winner`, and the
 * counters, sources and cleared note from both sides. The winner doctrine and its exceptions, in one
 * expression, so no caller can apply half of it.
 */
function mergeCard(a: ReviewCard, b: ReviewCard): ReviewCard {
  const card = tagged(counted(winner(a, b), higherCounts(countersOf(a), countersOf(b))), mergedSources(a, b));
  return a.context === PAST_CONVERSATION_NOTE || b.context === PAST_CONVERSATION_NOTE ? cleared(card) : named(card);
}

/** The third exception's output: the cleared note, and no pack id. */
function cleared(card: ReviewCard): ReviewCard {
  const { contextPackId: _gone, ...bare } = card;
  return { ...bare, context: PAST_CONVERSATION_NOTE };
}

/**
 * A pack id is only kept as a string on a named card. Junk off the wire is
 * dropped rather than trusted, and a cleared card never keeps one.
 */
function named(card: ReviewCard): ReviewCard {
  if (card.contextPackId === undefined) return card;
  if (typeof card.contextPackId === 'string' && card.contextPackId !== '' && card.context !== PAST_CONVERSATION_NOTE) return card;
  const { contextPackId: _junk, ...bare } = card;
  return bare;
}

/** A card only one side has ever seen, in that same emitted shape. */
function oneCopy(card: ReviewCard): ReviewCard {
  return named(tagged(counted(card, countersOf(card)), card.sources === undefined ? undefined : sourcesOf(card)));
}

/**
 * The second field-wise exception: where the phrase came from (`sources.ts`).
 * A set union, so commutative, idempotent and associative, and left out of
 * `canonical` for the same reason the counters are. Absent absorbs: a copy
 * with no tag predates tagging, and unknown origin must stay reviewable for
 * everyone, so the merged card is untagged too. "Absent wins" is itself
 * associative, which keeps the proof whole.
 */
function mergedSources(a: ReviewCard, b: ReviewCard): readonly string[] | undefined {
  if (a.sources === undefined || b.sources === undefined) return undefined;
  return unionSources(a.sources, b.sources);
}

function tagged(card: ReviewCard, sources: readonly string[] | undefined): ReviewCard {
  if (sources === undefined) {
    if (card.sources === undefined) return card;
    const { sources: _none, ...bare } = card;
    return bare;
  }
  return { ...card, sources: sourcesOf({ sources: sources as ReviewCard['sources'] }) };
}

/**
 * Union two decks by card id. Pure, and a pure function of the two card *sets*
 * — the output order is recomputed, so it cannot smuggle in the order the
 * arrays happened to arrive in.
 */
export function mergeDecks(a: unknown, b: unknown): ReviewCard[] {
  const left = deckOf(a);
  const right = deckOf(b);
  const merged: ReviewCard[] = [];
  for (const id of [...new Set([...left.keys(), ...right.keys()])]) {
    const x = left.get(id);
    const y = right.get(id);
    if (x === undefined) {
      if (y !== undefined) merged.push(y);
      continue;
    }
    merged.push(y === undefined ? x : mergeCard(x, y));
  }
  // Oldest first, as `mergeCards` leaves a deck, with id as the tiebreak so the
  // array is fully determined by its contents on both devices.
  return merged.sort((x, y) => x.addedAt - y.addedAt || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}
