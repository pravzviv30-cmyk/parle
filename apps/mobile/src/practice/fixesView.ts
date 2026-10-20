/**
 * What the Your fixes screen shows, decided here so the screen is only layout
 * (B3, 2026-10-20, artboard B-Fixes).
 *
 * A fix is a stored `ConversationPack.corrections` entry: what the learner
 * said, a more natural way, its English, and why. The rule this file exists to
 * hold is attempt before reveal: a fix the learner has not tried shows the
 * English only, and its French, their own line and the reason appear only
 * after a try. "Tried" is read from the deck, never stored here: the better
 * line's card has evidence beyond its introduction, or the learner typed an
 * attempt on this screen just now. Nothing here writes anything.
 *
 * Never a count on a mistake pattern, and never "Used in n conversations":
 * phrase status is the card's own counters, said by `phraseStatus`.
 */

import {
  evidenceStateOf,
  phraseKeyOf,
  type ConversationPack,
  type ConversationPackCorrection,
  type DrillExercise,
  type ReviewCard,
} from '@luvani/core';

import { featureAccess } from '../access/featureAccess.ts';
import { orderedConversationPacks } from '../conversationPacks/model.ts';
import { phraseStatus, type Access, type PracticeRoute } from './practiceTabView.ts';
import { relativeDay } from './sessionCard.ts';

export const FIXES_TITLE = 'Your fixes';

const WEEKDAY = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/;
const DATE = /^\d{1,2} [A-Z][a-z]+$/;

/**
 * "yesterday", "3 days ago", "on 12 Oct", "on Monday": `relativeDay` set
 * inside a sentence. "on" goes only before a weekday or a date (2026-10-21,
 * sim check: "on 2 days ago" was drawn because any leading digit took it).
 */
export function inSentence(day: string): string {
  if (WEEKDAY.test(day) || DATE.test(day)) return `on ${day}`;
  return day.charAt(0).toLocaleLowerCase('en') + day.slice(1);
}

export type FixesScope = 'this' | 'all';
export const SCOPES: readonly { key: FixesScope; label: string }[] = [
  { key: 'this', label: 'This conversation' },
  { key: 'all', label: 'All conversations' },
];

export const FIX_COPY = {
  attemptLabel: 'try it first',
  sayThis: 'Say this in French',
  afterTry: 'Your line and the better version show after you try.',
  say: 'Say it',
  type: 'Type it',
  typePlaceholder: 'Write it in French',
  showAfterTyping: 'Compare',
  triedLabel: 'after your try',
  tryIt: 'Try it',
  youWrote: 'You wrote',
  natural: 'A more natural way',
  why: 'Why:',
  again: 'Say it once more',
  phrasesTitle: 'Phrases from this conversation',
  practiseAll: 'Practise all fixes, free',
  unknownTitle: 'This conversation isn’t here.',
  unknownBody: 'It may have been deleted, or it has not reached this phone yet. Your fixes from other conversations are still in Practice.',
  back: 'Back to Practice',
  none: 'No fixes were saved from this conversation.',
} as const;

export interface Fix {
  /** The better line's deck key. */
  key: string;
  packId: string;
  /** When the learner said it, "Yesterday". */
  day: string;
  correction: ConversationPackCorrection;
  /** The deck has evidence beyond an introduction for the better line. */
  tried: boolean;
  /** The bank holds an exercise for the better line, so a drill can ask for it. */
  drillable: boolean;
}

/** The pack the route names, if it is here and ready. */
export function fixesPack(packId: string, packs: readonly ConversationPack[]): ConversationPack | null {
  return packs.find((pack) => pack.id === packId && pack.state === 'ready') ?? null;
}

/**
 * This conversation's fixes, or every ready conversation's, newest first, one
 * per better line so the same fix from two conversations is one row.
 */
export function fixesFor(input: {
  pack: ConversationPack;
  packs: readonly ConversationPack[];
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  scope: FixesScope;
  now: number;
}): Fix[] {
  const { pack, packs, deck, bank, scope, now } = input;
  const cards = new Map(deck.map((card) => [card.id, card]));
  const banked = new Set(bank.map((exercise) => exercise.phraseKey));
  const sources = scope === 'this' ? [pack] : orderedConversationPacks(packs).filter((p) => p.state === 'ready');
  const seen = new Set<string>();
  const out: Fix[] = [];
  for (const source of sources) {
    for (const correction of source.corrections) {
      const key = phraseKeyOf(correction.better);
      if (seen.has(key)) continue;
      seen.add(key);
      const card = cards.get(key);
      out.push({
        key,
        packId: source.id,
        day: relativeDay(source.createdAt, now),
        correction,
        tried: card !== undefined && evidenceStateOf(card) !== 'introduced',
        drillable: banked.has(key),
      });
    }
  }
  return out;
}

/**
 * A fix as the screen draws it. Only `compared` carries the learner's line,
 * the better French and the reason: the other two kinds have nothing to
 * reveal in them, so a layout cannot show an answer before a try.
 */
export type FixRow =
  | { kind: 'attempt'; key: string; number: number; english: string; say: PracticeRoute | null }
  | { kind: 'waiting'; key: string; number: number; english: string }
  | {
      kind: 'compared';
      key: string;
      number: number;
      said: string;
      quote: string;
      /** What the learner typed here just now, when they typed. */
      wrote: string | null;
      better: string;
      english: string;
      why: string;
      again: PracticeRoute | null;
    };

/** One phrase alone, asked for without the moment, so the drill reveals nothing first. */
function attemptRoute(fix: Fix): PracticeRoute | null {
  return fix.drillable ? { screen: 'Drill', params: { node: { id: `fix:${fix.packId}:${fix.key}`, title: FIXES_TITLE, phraseKeys: [fix.key] } } } : null;
}

/** After a try the moment rides along: the comparison is already on screen. */
function againRoute(fix: Fix): PracticeRoute | null {
  const { quote, better, why } = fix.correction;
  return fix.drillable ? { screen: 'Drill', params: { node: { id: `fix:${fix.packId}:${fix.key}`, title: FIXES_TITLE, phraseKeys: [fix.key], moment: { quote, better, why } } } } : null;
}

/**
 * The rows, in order. The chosen untried fix, or else the first, is the one
 * attempt; every other untried fix waits behind "Try it"; a tried fix shows
 * the comparison.
 */
export function fixRows(fixes: readonly Fix[], state: { active: string | null; typed: Readonly<Record<string, string>> }): FixRow[] {
  const triedNow = (fix: Fix): boolean => fix.tried || Object.hasOwn(state.typed, fix.key);
  const untried = fixes.filter((fix) => !triedNow(fix));
  const active = untried.find((fix) => fix.key === state.active) ?? untried[0] ?? null;
  return fixes.map((fix, i) => {
    const number = i + 1;
    if (triedNow(fix)) {
      return {
        kind: 'compared',
        key: fix.key,
        number,
        said: `You said ${inSentence(fix.day)}`,
        quote: fix.correction.quote,
        wrote: Object.hasOwn(state.typed, fix.key) ? state.typed[fix.key]! : null,
        better: fix.correction.better,
        english: fix.correction.betterEn,
        why: fix.correction.why,
        again: againRoute(fix),
      };
    }
    if (active !== null && fix.key === active.key) return { kind: 'attempt', key: fix.key, number, english: fix.correction.betterEn, say: attemptRoute(fix) };
    return { kind: 'waiting', key: fix.key, number, english: fix.correction.betterEn };
  });
}

/** "Fix 1, try it first" and the like, for the row's quiet label. */
export function fixLabel(row: FixRow): string {
  if (row.kind === 'attempt') return `Fix ${row.number}, ${FIX_COPY.attemptLabel}`;
  if (row.kind === 'compared') return `Fix ${row.number}, ${FIX_COPY.triedLabel}`;
  return `Fix ${row.number}`;
}

/** A sitting over every listed fix the bank can ask for. Null when it can ask for none. */
export function practiseAll(fixes: readonly Fix[], scope: FixesScope, packId: string): PracticeRoute | null {
  const keys = fixes.filter((fix) => fix.drillable).map((fix) => fix.key);
  return keys.length === 0 ? null : { screen: 'Drill', params: { node: { id: `fixes:${scope === 'this' ? packId : 'all'}`, title: FIXES_TITLE, phraseKeys: keys } } };
}

/** How a phrase's standing is coloured on B-Fixes: used (mint words), recalled (link), not yet (muted). */
export type PhraseTone = 'used' | 'recalled' | 'new';

export function phraseTone(status: string): PhraseTone {
  if (status.startsWith('Used')) return 'used';
  if (status.startsWith('Recalled')) return 'recalled';
  return 'new';
}

/**
 * Practise all fixes, as B-Fixes always ends (2026-10-21, sim check): the
 * drill over every fix the bank can ask for; else, when no fix has a drill
 * yet, the first untried fix's try-first card here (attempt before reveal).
 * Null only when there is nothing to practise: no fix, or every fix tried
 * with no drill behind any of them.
 */
export function practiseAllDoor(fixes: readonly Fix[], scope: FixesScope, packId: string, typed: Readonly<Record<string, string>> = {}): { kind: 'drill'; route: PracticeRoute } | { kind: 'try'; key: string } | null {
  const route = practiseAll(fixes, scope, packId);
  if (route !== null) return { kind: 'drill', route };
  const untried = fixes.find((fix) => !fix.tried && !Object.hasOwn(typed, fix.key));
  return untried === undefined ? null : { kind: 'try', key: untried.key };
}

/** The conversation's key phrases with their standing in words. */
export function phraseRows(pack: ConversationPack, deck: readonly ReviewCard[]): { fr: string; en: string; status: string; tone: PhraseTone }[] {
  const cards = new Map(deck.map((card) => [card.id, card]));
  return pack.keyPhrases.map((phrase) => {
    const status = phraseStatus(cards.get(phraseKeyOf(phrase.fr)));
    return { fr: phrase.fr, en: phrase.en, status, tone: phraseTone(status) };
  });
}

/** "Le premier café, yesterday": the header's second line. */
export function fixesSubtitle(pack: ConversationPack, now: number): string {
  return `${pack.title.en}, ${inSentence(relativeDay(pack.createdAt, now))}`;
}

/** Whether the screen draws the trial's lock, through the one seam only. */
export function fixesLocked(access: Access = featureAccess): boolean {
  return access('fixes') === 'locked';
}
