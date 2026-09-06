/**
 * One finished conversation, drawn as one card.
 *
 * The founder's mockup asks each card for six things: when it happened, how
 * long the learner spoke, where it stands now, what it was called in both
 * languages, which topics it opened, and how many phrases it left behind.
 * Five of those were already on `ConversationPack`. The sixth, the minutes,
 * arrived with `durationSec` and is `null` on every pack written before it
 * existed, which is why nothing here ever floors an absent duration to nought:
 * `progress/momentum.ts` settled that argument once already, and a real
 * conversation reported as "0 min spoken" is a worse untruth than a card that
 * simply does not mention the time.
 *
 * Pure and clock-injected, like `progress/momentum.ts` and `practice/mix.ts`.
 * The screen holds no rule about what a card says; it holds null gates.
 */

import { localDayKey, phraseKeyOf, type ConversationPack, type ReviewCard } from '@luvani/core';

/** A day in milliseconds, for the one arithmetic this file does. */
const DAY = 24 * 60 * 60 * 1000;

/**
 * How a card stands right now, as a key and the words that go with it.
 *
 * The key is what the screen colours by, so a colour decision cannot be made
 * from a string comparison against copy that a rewrite would break.
 */
export type SessionStandingKey = 'ready' | 'sound' | 'practised' | 'writing' | 'held';

export interface SessionStanding {
  key: SessionStandingKey;
  words: string;
}

export interface SessionTopics {
  /** "4 topics unpacked". Counts, because this is not mid-session. */
  label: string;
  /** The topics themselves, in English, one line. */
  body: string;
}

export interface SessionCard {
  id: string;
  /** "Today", "Yesterday", "3 days ago", "Last week", "12 August". Never empty. */
  when: string;
  /** "8 min spoken", or null when the session carried no measured time. */
  spoken: string | null;
  /** The chip on the meta row, or null when there is nothing true to put there. */
  standing: SessionStanding | null;
  titleEn: string;
  titleFr: string;
  /** The topics box, or null when the pack opened none we can name. */
  topics: SessionTopics | null;
  /** "12 key phrases", or null when the pack left none behind. */
  phrases: string | null;
  /** What the card's one door says. */
  revisit: string;
  /** The deck keys behind that door. Empty means the door is not drawn. */
  phraseKeys: string[];
}

/** The word on every card's door. Sentence case, and it names the thing. */
export const REVISIT = 'Revisit topics';

/** The standings, spelled once so no screen invents a sixth. */
export const STANDING = {
  ready: 'Ready to review',
  sound: 'A sound to work on',
  practised: 'Practised',
  writing: 'Becoming practice',
  held: 'Needs a moment',
} as const;

/** Months spelled out, so a card never shows a learner a slash-separated date. */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * When a conversation happened, said the way a person would say it.
 *
 * Local calendar days, not elapsed milliseconds: a conversation at eleven last
 * night is "Yesterday" at nine this morning, and calling that "10 hours ago"
 * is the kind of precision nobody asked for. Past four weeks it becomes a real
 * date, because "37 days ago" is a number the learner has to do sums with.
 *
 * A timestamp the future somehow produced reads as "Today" rather than as a
 * negative count. It is a clock disagreement, not something to report.
 */
export function relativeDay(createdAt: string, now: number): string {
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) return 'Earlier';

  const days = wholeDaysBetween(at, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 28) return `${Math.floor(days / 7)} weeks ago`;

  const then = new Date(at);
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}

/**
 * Whole local days from one instant to another.
 *
 * Both ends are collapsed to their local calendar date first, so a daylight
 * saving change cannot turn yesterday into two days ago.
 */
function wholeDaysBetween(from: number, to: number): number {
  const start = startOfLocalDay(from);
  const end = startOfLocalDay(to);
  return Math.round((end - start) / DAY);
}

function startOfLocalDay(at: number): number {
  // Through `localDayKey` rather than `setHours(0,0,0,0)`, so this file and
  // every other place in the app that says "which day was that" agree.
  const parts = localDayKey(at).split('-').map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day).getTime();
}

/**
 * How long the learner spoke, or nothing at all.
 *
 * Floored, never rounded up, for the same reason the speaking goal floors:
 * this is a claim about time somebody actually spent, and the direction to be
 * wrong in is the modest one. Under a minute says so rather than saying zero.
 */
export function spokenLine(durationSec: number | null): string | null {
  if (durationSec === null || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  const minutes = Math.floor(durationSec / 60);
  if (minutes < 1) return 'Under a minute spoken';
  return `${minutes} min spoken`;
}

/**
 * Where a pack stands, decided once, in one order.
 *
 * State comes first because a pack still being written cannot also be ready.
 * Then the deck: a card the scheduler wants back is the most useful thing this
 * chip can say. Then a sound worth working on. Then the fact that the learner
 * has been here before. A ready pack with none of those gets no chip, because
 * a chip that always draws stops being read.
 *
 * There is deliberately no count of revisits. `lastPractisedAt` is a date, not
 * a tally, and "Practised 3 times" from a single date would be invented.
 */
export function standingOf(pack: ConversationPack, due: ReadonlySet<string>): SessionStanding | null {
  if (pack.state === 'generating') return { key: 'writing', words: STANDING.writing };
  if (pack.state === 'failed') return { key: 'held', words: STANDING.held };
  if (pack.state === 'archived') return null;

  const wanted = pack.keyPhrases.some((phrase) => due.has(phraseKeyOf(phrase.fr)));
  if (wanted) return { key: 'ready', words: STANDING.ready };
  if (pack.pronunciationFocus !== null) return { key: 'sound', words: STANDING.sound };
  if (pack.lastPractisedAt !== null) return { key: 'practised', words: STANDING.practised };
  return null;
}

/** The topics box, absent rather than empty. */
export function topicsOf(pack: ConversationPack): SessionTopics | null {
  const named = pack.topics.filter((topic) => topic.en.trim().length > 0);
  if (named.length === 0) return null;
  return {
    label: named.length === 1 ? '1 topic unpacked' : `${named.length} topics unpacked`,
    body: named.map((topic) => topic.en.trim()).join(', '),
  };
}

/** The phrase count, absent rather than nought. */
export function phrasesLine(pack: ConversationPack): string | null {
  const n = pack.keyPhrases.length;
  if (n === 0) return null;
  return n === 1 ? '1 key phrase' : `${n} key phrases`;
}

/** One pack, folded into everything its card draws. */
export function sessionCardOf(pack: ConversationPack, due: ReadonlySet<string>, now: number): SessionCard {
  return {
    id: pack.id,
    when: relativeDay(pack.createdAt, now),
    spoken: spokenLine(pack.durationSec),
    standing: standingOf(pack, due),
    titleEn: pack.title.en,
    titleFr: pack.title.fr,
    topics: topicsOf(pack),
    phrases: phrasesLine(pack),
    revisit: REVISIT,
    phraseKeys: pack.keyPhrases.map((phrase) => phraseKeyOf(phrase.fr)),
  };
}

/**
 * The keys the scheduler wants back, as a set.
 *
 * Built once for the whole feed rather than per card: forty cards each walking
 * the deck is the same answer computed forty times.
 */
export function dueKeySet(due: readonly ReviewCard[]): Set<string> {
  return new Set(due.map((card) => card.id));
}
