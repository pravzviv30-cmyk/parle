/**
 * What a learner has actually shown they can do with one phrase.
 *
 * Before this module the same question had four answers. The scheduler knew a
 * card was due, the phrasebook decided a phrase had "settled" from reps and
 * interval, the path projected a node from dueness, and the brain called a
 * phrase "mastered" from a count it kept on the other side of the wire. Four
 * verdicts, four thresholds, four files. Nothing joined them, so a phrase could
 * be mastered in a profile, new in the phrasebook and due in the deck on the
 * same afternoon, and none of the four was lying.
 *
 * So: one record, and every verdict is a projection of it. The record is three
 * monotone counters on the review card, because the card is the thing that
 * already exists once per phrase, already syncs, and already survives a
 * reinstall. Counters only ever climb, which is what makes two devices
 * reconcilable without an operation log and what stops a bad week erasing a
 * good month.
 *
 * ## What each counter is allowed to claim
 *
 * `retrievals` counts answers the learner produced with the answer hidden. Not
 * "saw the card", not "pressed good on a card that was showing its own back" —
 * a required attempt came first, which is the gate the review screen enforces.
 * A recognition format where the French is on screen, played aloud, or sitting
 * among four options is not a retrieval and must never be counted as one.
 *
 * `convoUses` counts correct natural uses in live conversation, as counted by
 * the brain. It is the strongest thing this record holds, because nobody asked
 * for the phrase: it came out because the moment needed it.
 *
 * `transfers` counts correct answers to drills marked as transfer, meaning the
 * same phrase asked in a changed situation. Knowing a line and knowing when to
 * use it are different, and only the second one travels.
 *
 * What is deliberately absent is anything the learner did not produce. Cards
 * shown, minutes spent, XP earned and a model's praise are all evidence of a
 * session happening, and none of them is evidence of French.
 *
 * ## The states
 *
 * Four, ordered by how much the evidence is worth, and a phrase sits at the
 * highest rung it has evidence for. They are NOT the support ladder in
 * `ladder/ladder.ts`; that one is about how much help a turn gets, this one is
 * about what has been shown. Nothing here decays: dueness expires, evidence
 * does not, because a thing that happened stays happened.
 *
 * `mastered` is not on the list. It used to be a stored boolean in the brain
 * profile, which meant a flag could disagree with the count that produced it.
 * It is now a projection, `isMastered`, and the count is the only fact.
 */

import type { ReviewCard } from './scheduler.ts';

/**
 * The record. Absent on a card means all zero, so a deck written before any of
 * this still reads as itself and needs no migration.
 */
export interface PhraseEvidence {
  /** Good or easy grades that followed a required retrieval attempt. */
  retrievals: number;
  /** Lifetime correct natural uses in live conversation, from the brain's count. */
  convoUses: number;
  /** Correct answers to transfer-marked drills, where the situation changed. */
  transfers: number;
}

/** What every reader sees when a card carries no record. */
export const NO_EVIDENCE: PhraseEvidence = Object.freeze({ retrievals: 0, convoUses: 0, transfers: 0 });

export type EvidenceState = 'introduced' | 'recalled' | 'used' | 'transferred';

/** The states in climbing order, so a caller can compare two without a switch. */
export const EVIDENCE_STATES = ['introduced', 'recalled', 'used', 'transferred'] as const;

/**
 * Correct natural uses before the brain projects a phrase as mastered.
 *
 * Lived in `packages/brain/src/profile/profile.ts` until the record moved here.
 * Brain imports it rather than keeping its own, because a second copy of a
 * threshold is a second opinion about what a learner knows.
 */
export const MASTERY_USES = 3;

/**
 * When a card has settled: long enough between meetings to be a habit rather
 * than a lucky guess. The phrasebook's own thresholds, moved here beside the
 * rest so the shelf and the deck cannot drift apart.
 */
export const SETTLED_REPS = 2;
export const SETTLED_DAYS = 7;

/**
 * A count off a card, off the wire, or off a disk an older build wrote.
 *
 * Junk reads as zero rather than throwing. A corrupt counter should cost the
 * learner one claim about one phrase, never the screen it was rendering.
 */
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/**
 * The record on a card, with the zeros filled in. The only way to read it, and
 * the reason every other reader here goes through it.
 *
 * The guard is "is this an object with counts in it", not "is it missing",
 * because missing is not the only shape that carries none. `JSON.stringify`
 * renders `NaN` and `Infinity` as `null`, so a counter that ever went
 * non-finite comes back off the wire as a null block rather than an absent
 * one, and that is a routine arrival rather than a corrupt-file edge case. An
 * array, a string or a number is what a half-written file looks like. None of
 * them holds a count, all of them read as zero, and none of them may take down
 * the screen that was rendering a learner's own phrases.
 */
export function evidenceOf(card: Pick<ReviewCard, 'evidence'>): PhraseEvidence {
  const held: unknown = card.evidence;
  if (typeof held !== 'object' || held === null || Array.isArray(held)) return NO_EVIDENCE;
  const record = held as Record<string, unknown>;
  return {
    retrievals: count(record.retrievals),
    convoUses: count(record.convoUses),
    transfers: count(record.transfers),
  };
}

function step(value: number | undefined): number {
  return value === undefined ? 0 : count(value);
}

function same(a: PhraseEvidence, b: PhraseEvidence): boolean {
  return a.retrievals === b.retrievals && a.convoUses === b.convoUses && a.transfers === b.transfers;
}

/**
 * Add to a card's counters. Pure, and monotone by construction: a negative or
 * nonsense delta reads as zero, so nothing here can ever take evidence away.
 *
 * A delta that moves nothing returns the very same card, which is what keeps a
 * deck that saw no evidence this sitting byte-identical to the one on disk.
 */
export function addEvidence(card: ReviewCard, by: Partial<PhraseEvidence>): ReviewCard {
  const current = evidenceOf(card);
  const next: PhraseEvidence = {
    retrievals: current.retrievals + step(by.retrievals),
    convoUses: current.convoUses + step(by.convoUses),
    transfers: current.transfers + step(by.transfers),
  };
  return same(current, next) ? card : { ...card, evidence: next };
}

/**
 * Raise a card's counters to at least these values.
 *
 * What a fold uses. The conversation count arrives as a lifetime total rather
 * than a delta, so replaying the same banked session twice — which a crash
 * between writing and clearing the journal will do — leaves the count where it
 * already was instead of doubling it.
 */
export function raiseEvidenceTo(card: ReviewCard, floor: Partial<PhraseEvidence>): ReviewCard {
  const current = evidenceOf(card);
  const next: PhraseEvidence = {
    retrievals: Math.max(current.retrievals, step(floor.retrievals)),
    convoUses: Math.max(current.convoUses, step(floor.convoUses)),
    transfers: Math.max(current.transfers, step(floor.transfers)),
  };
  return same(current, next) ? card : { ...card, evidence: next };
}

/**
 * The highest rung this phrase has evidence for.
 *
 * `reps >= 1` grandfathers `recalled` for every card that existed before the
 * counters did, so nobody's phrasebook empties itself on upgrade. Going forward
 * the counter is the truth: the review screen requires an attempt before it
 * reveals a due production card, so a rep earned there is attempt-backed by
 * construction.
 *
 * `now` is accepted so every projection in this module is called the same way,
 * and ignored on purpose. Evidence is a claim about what happened, and no
 * amount of time passing makes it not have happened. What expires is the
 * schedule, and that is `isDue`.
 */
export function evidenceStateOf(card: ReviewCard, _now?: number): EvidenceState {
  const evidence = evidenceOf(card);
  if (evidence.transfers >= 1) return 'transferred';
  if (evidence.convoUses >= 1) return 'used';
  if (evidence.retrievals >= 1 || card.reps >= 1) return 'recalled';
  return 'introduced';
}

/** The brain's projection: a phrase used well enough, often enough, unprompted. */
export function isMastered(convoUses: number): boolean {
  return count(convoUses) >= MASTERY_USES;
}

/** The scheduler wants this card back. One reading of dueness for the whole repo. */
export function isDue(card: Pick<ReviewCard, 'due'>, now: number): boolean {
  return card.due <= now;
}

/**
 * Earned, and not currently wanted back. The phrasebook's "steady" shelf.
 *
 * Due is checked first for the same reason the phrasebook checks it first: a
 * phrase the scheduler is asking for again is not one to display as settled,
 * however long its interval grew.
 */
export function isSettled(card: Pick<ReviewCard, 'due' | 'reps' | 'intervalDays'>, now: number): boolean {
  if (isDue(card, now)) return false;
  return card.reps >= SETTLED_REPS && card.intervalDays >= SETTLED_DAYS;
}

export type CardPresentation = 'introduction' | 'retrieval';

/**
 * How a card should be put in front of the learner. Decided here, never in the
 * screen, because a second copy of this rule is how a deck starts revealing
 * answers on one surface and asking for them on another.
 *
 * `retrieval` asks for the French before showing it. That is the whole reason
 * the deck works: recall is the act that strengthens a memory, and a card that
 * shows both sides at once is reading, not review.
 *
 * `introduction` is the scaffolded meeting, and three kinds of card get it.
 * A card with no successful reviews yet is genuinely new, and asking someone to
 * produce a phrase they have never recalled is a test with no teaching in it.
 * A phoneme card is always an introduction: a sound is listened to and copied,
 * not produced from an English prompt, and a listening exercise stays a
 * listening exercise. And a card seen ahead of its due date is a look rather
 * than a test, so browsing the deck early never demands an attempt.
 */
export function presentationOf(card: ReviewCard, now: number): CardPresentation {
  if (card.kind === 'phoneme') return 'introduction';
  if (card.reps < 1) return 'introduction';
  return isDue(card, now) ? 'retrieval' : 'introduction';
}
