/**
 * What the direction B Practice tab shows, decided here so the tab file is
 * only layout (B3, 2026-10-20, artboards B-Practice and B-Empty-Practice).
 *
 * Every line is read from something that already ships: the learner's own
 * conversation packs, the one review deck, the drill bank, the saved sitting,
 * the topics store and the brain's error tags. Nothing is stored and nothing
 * is guessed. A design line with no data behind it is not drawn:
 *
 * - no minutes on a practice step, the mix or a mistake pattern, because no
 *   estimate exists for them;
 * - no "You asked for less help this time" on a revisit, because nothing
 *   records the help a revisit used (Phase C);
 * - no "Used in n conversations", because nothing counts distinct
 *   conversations; a phrase says "Used n times" from its own counter;
 * - no "Works offline once unlocked", because conversation practice reads the
 *   server on Supabase builds (KNOWN_ISSUES F855);
 * - no count beside a mistake pattern, ever.
 *
 * Lock badges come only from `access/featureAccess.ts`, passed in so a test
 * can ask what a locked seam would draw.
 */

import {
  CAFE_LESSON,
  dueCards,
  evidenceOf,
  evidenceStateOf,
  phraseKeyOf,
  type ConversationPack,
  type ConversationPackCorrection,
  type DrillExercise,
  type PracticeTopic,
  type ReviewCard,
} from '@luvani/core';

import { featureAccess, type FeatureAccess, type LockedFeature } from '../access/featureAccess.ts';
import { LESSON_MINUTES } from '../copy/access.ts';
import { orderedConversationPacks } from '../conversationPacks/model.ts';
import { normaliseBetter, revisionEvidence } from '../conversationPacks/revision.ts';
import { EXPLORE_TOPICS, topicsOfText, type ExploreTopic } from '../main/exploreCatalogue.ts';
import { conversationStateLine } from './library.ts';
import { offersMix, topicGroups } from './mix.ts';
import { resumableOf, withoutDeletedSources } from './opening.ts';
import { practiceDoors } from './practiceCard.ts';
import { practiceRouteParams, type PracticeRouteParams } from './practiceRoute.ts';
import { packSelection, recommendation } from './recommendation.ts';
import { relativeDay, spokenLine } from './sessionCard.ts';
import { restorePracticeSession, type PracticeSessionRecord } from './sessionStore.ts';
import { sittingProgress } from './sittingProgress.ts';

export type Access = (feature: LockedFeature) => FeatureAccess;
const isLocked = (access: Access, feature: LockedFeature): boolean => access(feature) === 'locked';

const DAY = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────── the header

export const PRACTICE_SUBTITLE = 'Go back to your conversations';
export const EMPTY_SUBTITLE = 'Revisit French you’ve already met';

// ─────────────────────────────────────────────────────────────── navigation

/** Every place the tab and the Fixes screen open, as plain data a test can read. */
export type DrillNode = { id: string; title: string; phraseKeys: readonly string[]; moment?: { quote: string; better: string; why: string } };
export type PracticeRoute =
  | { screen: 'Drill'; params: PracticeRouteParams | { node: DrillNode } | { mix: true } }
  | { screen: 'Fixes'; params: { packId: string } }
  | { screen: 'ConversationPractice'; params: { packId: string; stage?: 'listen' } }
  | { screen: 'Convo'; params: { continuationPackId: string } }
  | { screen: 'SavedConversationText' }
  | { screen: 'SoundCheck' }
  | { screen: 'Phrasebook' };

// ─────────────────────────────────────────────────────────────── topic chips

/** Short chip words for the Explore buckets, as the artboard writes them. */
export const TOPIC_CHIP: Record<ExploreTopic, string> = {
  food: 'Cafés',
  friends: 'Friends',
  travel: 'Getting around',
  work: 'Work',
  shops: 'Shops',
  home: 'Home',
  health: 'Health',
  admin: 'Paperwork',
  out: 'Going out',
  culture: 'Days off',
};

export const ALL_TOPICS = 'All';

export interface TopicChip {
  key: ExploreTopic | null;
  label: string;
}

/** The Explore buckets a pack's own topics name. A pack with no topics names none. */
export function packTopics(pack: Pick<ConversationPack, 'topics'>): ExploreTopic[] {
  const text = (pack.topics ?? []).flatMap((topic) => [topic.en, topic.fr]).join(' ');
  return text.trim() === '' ? [] : topicsOfText(text);
}

/**
 * All, then each bucket that holds at least one conversation on this page, in
 * Explore's order. No chips at all when no bucket holds one, so "All" never
 * stands alone over nothing to filter.
 */
export function topicChips(packs: readonly ConversationPack[]): TopicChip[] {
  const held = new Set(packs.flatMap(packTopics));
  const buckets = EXPLORE_TOPICS.filter((topic) => held.has(topic.key)).map((topic) => ({ key: topic.key, label: TOPIC_CHIP[topic.key] }));
  return buckets.length === 0 ? [] : [{ key: null, label: ALL_TOPICS }, ...buckets];
}

/** The chosen bucket, or All when the chosen one has left the page. */
export function chosenTopic(packs: readonly ConversationPack[], chosen: ExploreTopic | null): ExploreTopic | null {
  return chosen !== null && topicChips(packs).some((chip) => chip.key === chosen) ? chosen : null;
}

export function packsInTopic(packs: readonly ConversationPack[], chosen: ExploreTopic | null): ConversationPack[] {
  const topic = chosenTopic(packs, chosen);
  return orderedConversationPacks(packs).filter((pack) => topic === null || packTopics(pack).includes(topic));
}

// ─────────────────────────────────────────────────────────────── pick up where you stopped

export const PICK_UP_TITLE = 'Pick up where you stopped';

export interface PickUp {
  /** "Le premier café, phrase two of five", or the title alone. */
  line: string;
  route: PracticeRoute;
  locked: boolean;
}

/**
 * Only the recommendation's own resume answer. The place in the sitting comes
 * from the restored queue, in words, as the drill's own strip says it.
 */
export function pickUp(input: {
  saved: PracticeSessionRecord | null;
  packs: readonly ConversationPack[];
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  now: number;
  access?: Access;
}): PickUp | null {
  const { saved, packs, deck, bank, now, access = featureAccess } = input;
  const rec = recommendation({ resumable: resumableOf(saved, packs, bank), deck, bank, packs, now });
  if (rec.kind !== 'resume' || saved === null) return null;
  const restored = restorePracticeSession(withoutDeletedSources(saved, packs, bank).record, bank, deck, now);
  const progress = restored === null ? null : sittingProgress(restored.state, restored.targets);
  const title = rec.source?.title.en ?? 'Your practice';
  const place = progress === null ? null : progress.label.charAt(0).toLocaleLowerCase('en') + progress.label.slice(1);
  return {
    line: place === null ? title : `${title}, ${place}`,
    route: { screen: 'Drill', params: practiceRouteParams({ origin: 'resume', packId: null, exposed: false }) },
    locked: isLocked(access, 'conversationPractice'),
  };
}

// ─────────────────────────────────────────────────────────────── comes up often

export const COMES_UP_TITLE = 'Comes up often in your conversations';
export const COMES_UP_SHORT = 'Comes up often';
export const PRACTISE_THIS = 'Practise this';

/**
 * The learner's words for the brain's error tags. Only a tag written here is
 * shown: a kebab tag or an invented gloss never reaches the learner.
 */
export const PATTERN_COPY: Readonly<Record<string, { title: string; hint: string }>> = {
  'gender-agreement': { title: 'Gender agreement', hint: 'le or la, un or une' },
  'tu-vous-mixing': { title: 'Tu or vous', hint: 'pick one for each person and keep to it' },
  'verb-conjugation': { title: 'Verb endings', hint: 'the je, tu and il forms' },
};

/** The brain's stored shape, read only: its count is never passed on. */
export type ErrorPatterns = Readonly<Record<string, { count: number; lastSeen: string; example: string }>>;

export interface PatternRow {
  tag: string;
  title: string;
  hint: string;
  /** A sitting over the learner's own fixes that show this pattern, or null when no drill exists for it. */
  practise: PracticeRoute | null;
  locked: boolean;
}

const folded = (text: string): string => normaliseBetter(text);

/** Corrections whose learner quote is the pattern's own example, newest first. */
function correctionsShowing(example: string, packs: readonly ConversationPack[]): ConversationPackCorrection[] {
  const said = folded(example);
  if (said === '') return [];
  return orderedConversationPacks(packs)
    .filter((pack) => pack.state === 'ready')
    .flatMap((pack) => pack.corrections)
    .filter((correction) => {
      const quote = folded(correction.quote);
      return quote !== '' && (quote.includes(said) || said.includes(quote));
    });
}

/**
 * Mistake patterns with authored learner copy, the most recently seen first.
 * Never a count: the stored tally orders nothing and is said nowhere.
 * "Practise this" opens a drill only when the bank holds an exercise for a
 * fix that shows the pattern; otherwise the row is a name and a hint only.
 */
export function comesUpOften(input: {
  patterns: ErrorPatterns | undefined;
  packs: readonly ConversationPack[];
  bank: readonly DrillExercise[];
  access?: Access;
  limit?: number;
}): PatternRow[] {
  const { patterns, packs, bank, access = featureAccess, limit = 2 } = input;
  if (patterns === undefined) return [];
  const banked = new Set(bank.map((exercise) => exercise.phraseKey));
  return Object.entries(patterns)
    // "Often" is a claim about frequency, so a tag needs the brain's stored
    // tally of at least two. The tally decides only whether; it is never shown.
    .filter(([tag, seen]) => Object.hasOwn(PATTERN_COPY, tag) && (seen.count ?? 0) >= 2)
    .sort((a, b) => (Date.parse(b[1].lastSeen) || 0) - (Date.parse(a[1].lastSeen) || 0))
    .slice(0, limit)
    .map(([tag, seen]) => {
      const copy = PATTERN_COPY[tag]!;
      const keys = [...new Set(correctionsShowing(seen.example, packs).map((c) => phraseKeyOf(c.better)))].filter((key) => banked.has(key));
      return {
        tag,
        title: copy.title,
        hint: copy.hint,
        practise: keys.length === 0 ? null : { screen: 'Drill', params: { node: { id: `pattern:${tag}`, title: copy.title, phraseKeys: keys } } },
        locked: isLocked(access, 'fixes'),
      };
    });
}

// ─────────────────────────────────────────────────────────────── your conversations

export const CONVERSATIONS_TITLE = 'Your conversations';
export const FIXES_ROW = { title: 'Your fixes from this conversation', gloss: 'Try each one first, then compare' } as const;
export const PRACTISE_CONVERSATION = 'Practise this conversation';
export const OLDER = 'Older conversations';
export const NEWEST = 'Newest conversations';

/**
 * The three steps, each opening work that exists. The warm-up's matching
 * stage, its listening stage, then recall in a drill sitting. "Try your
 * replies" on the artboard became "Catch it by ear": the listening stage asks
 * for a meaning, not a reply, so the word says what the step does.
 */
export const STEPS = {
  understand: { title: 'Understand it', gloss: 'Match each phrase to its meaning' },
  listen: { title: 'Catch it by ear', gloss: 'Hear a phrase and choose what it means' },
  remember: { title: 'Remember it', gloss: 'Say the phrases yourself, with less help each time' },
} as const;

/** "3 this week": conversations started in the last seven days. Null for none. */
export function thisWeekLine(packs: readonly ConversationPack[], now: number): string | null {
  const n = packs.filter((pack) => {
    const at = Date.parse(pack.createdAt);
    return Number.isFinite(at) && at <= now && now - at < 7 * DAY;
  }).length;
  return n === 0 ? null : `${n} this week`;
}

export interface Step {
  key: keyof typeof STEPS;
  title: string;
  gloss: string;
  route: PracticeRoute;
}

export interface ConversationCard {
  id: string;
  title: string;
  /** "Yesterday, 4 min spoken", the minutes only when the session was timed. */
  meta: string;
  /** The pack's summary, or its state line while it is not ready. */
  summary: string;
  /** Up to two kept phrases, in French. */
  kept: readonly string[];
  /** "+3 more", or null. */
  more: string | null;
  fixes: { title: string; gloss: string; route: PracticeRoute } | null;
  steps: readonly Step[] | null;
  stepsLocked: boolean;
  revisit: { label: string; uses: string; route: PracticeRoute; locked: boolean } | null;
  /** On a revisit: the conversation it came from, and the learner's own French this time. */
  revisited: { from: string; win: string | null } | null;
}

export function conversationCard(input: {
  pack: ConversationPack;
  packs: readonly ConversationPack[];
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  now: number;
  revisitAllowed: boolean;
  access?: Access;
}): ConversationCard {
  const { pack, packs, deck, bank, now, revisitAllowed, access = featureAccess } = input;
  const inDeck = new Set(deck.map((card) => card.id));
  const kept = pack.keyPhrases.filter((phrase) => inDeck.has(phraseKeyOf(phrase.fr))).map((phrase) => phrase.fr);
  const ready = pack.state === 'ready';
  const canPractise = ready && packSelection({ packId: pack.id, packs, deck, bank, now }) !== null;
  const door = practiceDoors({ deck, packs, now, revisitAllowed, revisitPackId: pack.id }).revisit;
  const revision = revisionEvidence(pack, packs, []);
  return {
    id: pack.id,
    title: pack.title.en,
    meta: [relativeDay(pack.createdAt, now), spokenLine(pack.durationSec ?? null)].filter((part) => part !== null).join(', '),
    summary: ready ? pack.summary : conversationStateLine(pack),
    kept: kept.slice(0, 2),
    more: kept.length > 2 ? `+${kept.length - 2} more` : null,
    fixes: ready && pack.corrections.length > 0 ? { ...FIXES_ROW, route: { screen: 'Fixes', params: { packId: pack.id } } } : null,
    steps: canPractise
      ? [
          { key: 'understand', ...STEPS.understand, route: { screen: 'ConversationPractice', params: { packId: pack.id } } },
          { key: 'listen', ...STEPS.listen, route: { screen: 'ConversationPractice', params: { packId: pack.id, stage: 'listen' } } },
          { key: 'remember', ...STEPS.remember, route: { screen: 'Drill', params: practiceRouteParams({ origin: 'pack', packId: pack.id, exposed: false }) } },
        ]
      : null,
    stepsLocked: isLocked(access, 'conversationPractice'),
    revisit: door === null ? null : { label: TALK_AGAIN, uses: door.uses, route: { screen: 'Convo', params: { continuationPackId: door.packId } }, locked: isLocked(access, 'continueArc') },
    revisited: revision === null ? null : { from: revision.source.title.en, win: revision.after.wins[0] ?? null },
  };
}

export const TALK_AGAIN = 'Talk about it again';

/** The learner's own French on a revisit. Nothing about the help it used: nothing records that yet. */
export function revisitedLines(revisited: NonNullable<ConversationCard['revisited']>): string[] {
  return [`Talked about again, after ${revisited.from}`, ...(revisited.win === null ? [] : [`You used “${revisited.win}” this time.`])];
}

// ─────────────────────────────────────────────────────────────── the mix

export const MIX_TITLE = 'Mix your conversations';

/** Shown only when `offersMix` says the mix spans topics; no minutes, none are estimated. */
export function mixCard(input: {
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  topics: readonly PracticeTopic[];
  now: number;
  access?: Access;
}): { line: string; route: PracticeRoute; locked: boolean } | null {
  const { deck, bank, topics, now, access = featureAccess } = input;
  const banked = new Set(bank.map((exercise) => exercise.phraseKey));
  const drillable = deck.filter((card) => banked.has(card.id));
  if (!offersMix(drillable, topics, now)) return null;
  const groups = topicGroups(topics);
  // Capped by core's DUE_CAP on purpose: the scheduler never shows the whole
  // backlog, and this says what the sitting will hold. Do not uncap it.
  const due = dueCards(drillable, now).filter((card) => groups.some((keys) => keys.includes(card.id))).length;
  return {
    line: `${due} ${due === 1 ? 'phrase' : 'phrases'} due from different talks`,
    route: { screen: 'Drill', params: { mix: true } },
    locked: isLocked(access, 'conversationPractice'),
  };
}

// ─────────────────────────────────────────────────────────────── saved

export const SAVED_PHRASES = 'Saved phrases';
export const SAVED_FIRST = 'Your first kept phrase lands here.';
export const SAVED_TEXT = { title: 'Saved conversation text', gloss: 'The words you chose to keep' } as const;

/** "8 kept, 3 used in conversation", from the deck and each card's own counter. */
export function savedPhrasesLine(deck: readonly ReviewCard[]): string {
  const kept = deck.filter((card) => card.kind !== 'phoneme');
  if (kept.length === 0) return SAVED_FIRST;
  const used = kept.filter((card) => evidenceOf(card).convoUses >= 1).length;
  return `${kept.length} kept, ${used} used in conversation`;
}

// ─────────────────────────────────────────────────────────────── phrase status

/**
 * One phrase's standing in words, from its own counters. "Used n times" is
 * its lifetime uses in conversation; nothing counts distinct conversations,
 * so nothing here says how many.
 */
export function phraseStatus(card: ReviewCard | undefined): string {
  if (card === undefined) return 'Not practised yet';
  const evidence = evidenceOf(card);
  if (evidence.convoUses >= 1) return evidence.convoUses === 1 ? 'Used once' : `Used ${evidence.convoUses} times`;
  if (evidence.retrievals >= 1) return evidence.retrievals === 1 ? 'Recalled once' : `Recalled ${evidence.retrievals} times`;
  if (evidenceStateOf(card) === 'recalled') return 'Recalled before';
  return 'Not practised yet';
}

// ─────────────────────────────────────────────────────────────── the empty page

export const EMPTY = {
  title: 'Your practice grows from here',
  body: 'Every conversation leaves a few phrases and fixes to come back to. Have your first one and they’ll appear here.',
  start: 'Start your first conversation',
  readyNow: 'Ready now, no conversation needed',
  cafe: {
    title: 'Café basics',
    /** The café lesson's own turns, counted, and the shared words for what a lesson costs. */
    line: `${CAFE_LESSON.turns.length} starter phrases`,
    cost: LESSON_MINUTES,
  },
  sounds: { title: 'Sounds of French', gloss: 'One sound at a time' },
} as const;

/** A learner with no conversation here at all: nothing on the page, nothing cached, nothing unavailable. */
export function isNewLearner(data: { page: readonly unknown[]; packs: readonly unknown[]; unavailable: readonly unknown[] }): boolean {
  return data.page.length === 0 && data.packs.length === 0 && data.unavailable.length === 0;
}
