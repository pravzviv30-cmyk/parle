/**
 * What the Practice tab shows, at every stage of a learner's life in the app.
 *
 * The founder's mockup is drawn full: six recorded sessions, a stat rail, four
 * filters. This module is what stands between that drawing and a learner who
 * opened the app twenty minutes ago. It answers one question, whole: given the
 * packs, the deck and the clock, which blocks exist at all?
 *
 * The rule it follows is the one `progress/momentum.ts` already settled. A
 * count is `null`, never `0`, when there is nothing true to say, and the block
 * that would have drawn the nought is absent instead. The founder was asked
 * directly whether Practice should show its frame from day one the way Home
 * now does, and chose the quieter answer: the vault, the stats and the feed
 * arrive when there is something real in them.
 *
 * Nothing here reads a clock of its own or touches storage. It is a pure fold,
 * so the ladder below can be tested at nought, one, three and six sessions
 * without a device.
 */

import { dueCards, type ConversationPack, type ReviewCard } from '@luvani/core';
import { orderedConversationPacks } from '../conversationPacks/model.ts';
import { isRetained } from '../progress/momentum.ts';
import { dueKeySet, sessionCardOf, type SessionCard } from './sessionCard.ts';

/**
 * How many recorded sessions it takes before the filter row earns its place.
 *
 * Below this the row is furniture: four controls over three cards, every one
 * of which is already on screen. The mockup draws the row over four cards, so
 * four is where it starts.
 */
export const FILTERS_EARN_THEIR_PLACE = 4;

/** A session counts as recent for this many days. */
export const RECENT_DAYS = 7;

/** The caps line over the whole block. */
export const ARCHIVE_LABEL = 'Archive and memory';

/** The vault card's words. Sentence case, because chrome is plain English. */
export const VAULT = {
  title: 'Your spoken journeys',
  blurb: 'Every conversation with your tutor becomes gentle, focused practice here.',
  recorded: 'Recorded',
  topics: 'Topics active',
  retained: 'Phrases retained',
} as const;

/** The heading over the feed, and the quiet line beside it. */
export const FEED = {
  label: 'Recorded sessions',
  order: 'Ordered by recency',
} as const;

/**
 * What a learner with no conversations reads instead of an empty archive.
 *
 * It says where the archive comes from, because that is the product's whole
 * argument, and it promises nothing it cannot deliver.
 */
export const OPENING = {
  title: 'Practice is written from your conversations.',
  body: 'Talk with your tutor and this fills with what you said, the phrases worth keeping, and short drills built from them.',
} as const;

/** The closing note at the foot of the tab. */
export const CLOSING = {
  title: 'No hurry, and nothing to protect',
  body: 'Come back to any conversation when you feel ready, whether you whisper it or say it out loud.',
} as const;

export type FilterKey = 'all' | 'recent' | 'attention' | 'ideas';

export interface ArchiveFilter {
  key: FilterKey;
  label: string;
}

export interface VaultStat {
  /** Already a string, so the screen never formats a number. */
  value: string;
  label: string;
}

export interface Vault {
  title: string;
  blurb: string;
  /**
   * Only the counts with something to say. One at first, three once the
   * learner has been talking, which is the growth happening inside the card
   * rather than being announced.
   */
  stats: readonly VaultStat[];
}

export interface Archive {
  /** The summary card, or null before the first conversation is on record. */
  vault: Vault | null;
  /** Every card, newest first. Empty on day one. */
  sessions: readonly SessionCard[];
  /** The filter row. Empty until it would do real work. */
  filters: readonly ArchiveFilter[];
  /** The quiet line beside the feed heading, or null while order says nothing. */
  order: string | null;
  /** The words that stand in for an empty archive, or null once there is one. */
  opening: { title: string; body: string } | null;
  /**
   * The ids inside the recent window, carried rather than recomputed.
   *
   * `sessionsUnder` needs it and would otherwise have to be handed the packs
   * and the clock a second time, which is two chances for the count in the
   * Recent pill and the feed under it to disagree.
   */
  recent: readonly string[];
}

export interface ArchiveInput {
  packs: readonly ConversationPack[];
  deck: readonly ReviewCard[];
  now: number;
}

/**
 * The whole tab, folded once.
 *
 * `orderedConversationPacks` decides the order, not this: the same total order
 * the rest of the app already uses, so a redraw cannot make a card jump.
 */
export function archiveFrom({ packs, deck, now }: ArchiveInput): Archive {
  const ordered = orderedConversationPacks(packs);
  const due = dueKeySet(dueCards(deck, now));
  const sessions = ordered.map((pack) => sessionCardOf(pack, due, now));

  if (sessions.length === 0) {
    return { vault: null, sessions: [], filters: [], order: null, opening: { ...OPENING }, recent: [] };
  }

  const recent = ordered.filter((pack) => isRecent(pack, now)).map((pack) => pack.id);

  return {
    vault: vaultFrom(ordered, deck),
    sessions,
    filters: filtersFor(recent.length, sessions),
    // One card in one order is not an ordering. The line arrives with the
    // second card, which is the first moment "newest first" tells anybody
    // anything they could not already see.
    order: sessions.length > 1 ? FEED.order : null,
    opening: null,
    recent,
  };
}

/**
 * The three counts, and only the ones that are not nought.
 *
 * `retained` is read through `isRetained` from the momentum module rather than
 * recomputed here, so Home's retained figure and this one are the same number
 * by construction.
 */
function vaultFrom(ordered: readonly ConversationPack[], deck: readonly ReviewCard[]): Vault {
  const stats: VaultStat[] = [{ value: `${ordered.length}`, label: VAULT.recorded }];

  const topics = new Set<string>();
  for (const pack of ordered) {
    for (const topic of pack.topics) {
      const named = topic.en.trim().toLowerCase();
      if (named.length > 0) topics.add(named);
    }
  }
  if (topics.size > 0) stats.push({ value: `${topics.size}`, label: VAULT.topics });

  const retained = deck.filter(isRetained).length;
  if (retained > 0) stats.push({ value: `${retained}`, label: VAULT.retained });

  return { title: VAULT.title, blurb: VAULT.blurb, stats };
}

/**
 * Which filters earn their place.
 *
 * Every one of them has to select something, and something short of the whole
 * feed, or it is a control that does nothing when tapped. `ideas` is the
 * exception and is deliberate: it selects no sessions at all, which is exactly
 * what it does in the founder's mockup, where the scenario card is what is
 * left on screen once the feed steps aside.
 */
export function filtersFor(recent: number, sessions: readonly SessionCard[]): readonly ArchiveFilter[] {
  if (sessions.length < FILTERS_EARN_THEIR_PLACE) return [];

  const filters: ArchiveFilter[] = [{ key: 'all', label: 'All sessions' }];

  if (recent > 0 && recent < sessions.length) {
    filters.push({ key: 'recent', label: `Recent (${recent})` });
  }

  const wanted = sessions.filter(needsALook).length;
  if (wanted > 0 && wanted < sessions.length) {
    filters.push({ key: 'attention', label: 'Needs a look' });
  }

  filters.push({ key: 'ideas', label: 'Ideas and scenarios' });
  return filters;
}

/** A card the deck wants back, or one carrying a sound worth working on. */
function needsALook(session: SessionCard): boolean {
  return session.standing?.key === 'ready' || session.standing?.key === 'sound';
}

function isRecent(pack: ConversationPack, now: number): boolean {
  const at = Date.parse(pack.createdAt);
  if (!Number.isFinite(at)) return false;
  return now - at <= RECENT_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The feed under one filter.
 *
 * A filter nobody chose shows everything, and so does a filter that has since
 * stopped earning its place, because a learner who tapped Recent last week
 * should not open the tab onto a feed that looks empty.
 */
export function sessionsUnder(archive: Archive, filter: FilterKey): readonly SessionCard[] {
  if (archive.filters.every((f) => f.key !== filter)) return archive.sessions;
  if (filter === 'all') return archive.sessions;
  if (filter === 'ideas') return [];
  if (filter === 'attention') return archive.sessions.filter(needsALook);

  const recent = new Set(archive.recent);
  return archive.sessions.filter((session) => recent.has(session.id));
}
