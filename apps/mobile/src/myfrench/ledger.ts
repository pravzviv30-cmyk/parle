/**
 * The lines that became the learner's, and the one worth naming.
 *
 * `PhraseEvidence.convoUses` counts phrases that came out of the learner's
 * mouth in a real conversation, unprompted, because the moment needed them. It
 * is the strongest claim this product can make and the only one that requires
 * having been in the room: no deck of flashcards can produce it, however many
 * cards were reviewed. It is also, today, drawn nowhere except as a number on
 * Home. This module is that evidence given names.
 *
 * ## One order, shared with Home
 *
 * The featured phrase is the top of `progress/momentum.ts`'s `retainedOrder`,
 * imported rather than re-sorted, so it is always the same phrase Home's first
 * chip names. Two comparators would eventually feature two different phrases
 * for one learner on one afternoon, and neither screen would be wrong.
 * `isRetained` is imported for the same reason and was exported for it.
 *
 * ## The anti-fabrication rule
 *
 * `card.context` is NOT the learner's own sentence and must never be captioned
 * as one. `review/store.ts` writes `context: p.note ?? ''` and the brain's
 * contract defines that note as a one line culture or usage note, so "you said
 * this when the waiter offered dessert" would render a usage tip, an empty
 * string, or a duplicate of the gloss. What the learner actually said is not
 * kept anywhere: transcripts live in memory for the life of one screen. So the
 * note is drawn as a note, attributed to the tutor, and only when it says
 * something neither face already said.
 *
 * ## Why no mark beside a row
 *
 * Every row here is at the same rung by construction, so a mark would carry no
 * information, and a rail of filled and hollow marks is a fraction drawn
 * instead of typed. `progress/passport.ts` refuses the same thing for the same
 * reason. The one distinction worth drawing is `transferred`, which is a
 * different claim and gets a sentence rather than a symbol.
 */

import { evidenceOf, type ReviewCard } from '@luvani/core';

import { isRetained, retainedOrder } from '../progress/momentum.ts';

/** How many rows sit under the featured phrase before the door takes over. */
export const RETAINED_ROWS = 6;

export const LEDGER = {
  featuredLabel: 'Retained expression',
  rowsLabel: 'Yours in conversation',
  rowsBlurb: 'These came out because the moment needed them.',
  /** Drawn only when a whole line is present, because it is a claim about lines. */
  cadence: 'Whole lines first. Those are the ones a French ear notices.',
  /** The tutor's note, attributed. Never the learner's own words. */
  noteLabel: 'The tutor left a note:',
  door: 'Open my phrases',
} as const;

/** What one counter licenses, and nothing more. */
export const CLAIMS = {
  transferred: 'You used this one where it was not taught.',
  used: 'This one came out in conversation. Nobody asked you for it.',
} as const;

export interface PhraseRow {
  id: string;
  /** The French, as the learner said it. */
  front: string;
  /** What it means. */
  back: string;
  /** A whole line rather than a single word. Decides the ordering, not a badge. */
  wholeLine: boolean;
  /** The extra sentence a transferred phrase earns, or null. */
  transferLine: string | null;
}

export interface FeaturedPhrase extends PhraseRow {
  /** The one claim this phrase's counters license. */
  claim: string;
  /** The tutor's note, or null when there is none worth drawing. */
  note: string | null;
  ipa: string;
}

export interface Ledger {
  featured: FeaturedPhrase | null;
  rows: readonly PhraseRow[];
  /** Present only when a whole line is among the rows. */
  cadenceLine: string | null;
  /** "+4 more", or null when the door is not hiding anything. */
  moreLine: string | null;
}

/**
 * A line the learner could deploy, rather than a word or a connector.
 *
 * Three words is the cut, and it was found by looking at the rendered lane. A
 * space alone made "en fait" and "bah oui" whole lines, which made nearly every
 * row one, which left the ordering doing nothing under a sentence that claimed
 * it was doing something. Connectors still rank high here, because they are
 * ranked by use like everything else and a learner says them constantly. What
 * this decides is narrower: which rows are clauses worth putting at the top.
 */
const WHOLE_LINE_WORDS = 3;

function isWholeLine(front: string): boolean {
  return front.trim().split(/\s+/).filter((word) => word !== '').length >= WHOLE_LINE_WORDS;
}

/** The tutor's note, when it says something neither face already said. */
function noteOn(card: ReviewCard): string | null {
  const context = card.context;
  if (context === '' || context === card.front || context === card.back) return null;
  return context;
}

function rowOf(card: ReviewCard): PhraseRow {
  const transfers = evidenceOf(card).transfers;
  return {
    id: card.id,
    front: card.front,
    back: card.back,
    wholeLine: isWholeLine(card.front),
    transferLine: transfers >= 1 ? 'It held when the situation changed.' : null,
  };
}

/**
 * The Memory Deck lane, as one projection over the deck.
 *
 * The predicate is `isRetained`, not `evidenceStateOf(card) === 'used'`. The
 * comparison looks equivalent and is not: `evidenceStateOf` answers
 * `transferred` the moment `transfers` reaches one, so a state check would
 * silently delete the learner's strongest phrases from the one section built to
 * celebrate them.
 */
export function ledgerFrom(input: { deck: readonly ReviewCard[]; now: number }): Ledger {
  const ranked = retainedOrder(input.deck.filter(isRetained));
  const head = ranked[0];
  if (head === undefined) return { featured: null, rows: [], cadenceLine: null, moreLine: null };

  const featured: FeaturedPhrase = {
    ...rowOf(head),
    claim: evidenceOf(head).transfers >= 1 ? CLAIMS.transferred : CLAIMS.used,
    note: noteOn(head),
    ipa: head.ipa,
  };

  // Whole lines first, then the order Home already read. `sort` is stable in
  // every runtime this ships on, so the second key is the rank it arrived with.
  const rest = ranked.slice(1).map(rowOf);
  const ordered = [...rest].sort((a, b) => Number(b.wholeLine) - Number(a.wholeLine));
  const rows = ordered.slice(0, RETAINED_ROWS);
  const more = ordered.length - rows.length;

  return {
    featured,
    rows,
    cadenceLine: rows.some((row) => row.wholeLine) ? LEDGER.cadence : null,
    moreLine: more === 0 ? null : `+${more} more`,
  };
}

/** False draws none of the lane, heading and all. */
export function hasLedger(ledger: Ledger): boolean {
  return ledger.featured !== null;
}
