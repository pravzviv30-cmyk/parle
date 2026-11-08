/**
 * Fixed conversations for the recap previews (`?preview=recap-*`). The café
 * scene, so `getMission` resolves; nothing here is sent or graded.
 */
import { sessionSettlementCopy, type RecapPayload } from '@luvani/core';
import type { GameDelta } from '../game/delta.ts';
import { END_DELTA } from './drillFixtures.ts';

export const RECAP_MISSION_ID = 'mission:cafe';

export const RECAP_DELTA: GameDelta = { ...END_DELTA, key: END_DELTA.key.replace('drill', 'convo'), source: 'convo' };

const base: RecapPayload = {
  headline: 'You ordered a coffee and asked for the bill.',
  wins: ['You asked for the bill on your own.'],
  fixes: [],
  phrases: [
    { fr: 'Un café, s’il vous plaît', frWritten: null, en: 'A coffee, please', enLiteral: null, register: 'neutral', note: null },
    { fr: 'L’addition, s’il vous plaît', frWritten: null, en: 'The bill, please', enLiteral: null, register: 'neutral', note: null },
    { fr: 'Je voudrais un croissant', frWritten: null, en: 'I would like a croissant', enLiteral: null, register: 'neutral', note: null },
  ],
  nextFocus: 'Ask what they recommend.',
  topics: [{ fr: 'Au café', en: 'At the café' }],
  cefr: { estimate: 'A1', confidence: 'low' },
  stats: { turns: 8, rescues: 1, unassistedRate: 0.75, learnerReplies: 4 },
};

export const RECAP_FULL: RecapPayload = base;
export const RECAP_NO_SOUND: RecapPayload = base;

export const RECAP_SCROLLED: RecapPayload = {
  ...base,
  fixes: [
    { kind: 'grammar', quote: 'Je veux un café', better: 'Je voudrais un café', betterWritten: null, betterEn: 'I would like a coffee', why: 'Voudrais sounds softer when you order.', weight: 'matters-now' },
    { kind: 'word', quote: 'la facture', better: 'l’addition', betterWritten: null, betterEn: 'the bill', why: 'In a café the bill is l’addition.', weight: 'minor' },
    { kind: 'grammar', quote: 'un croissant s’il vous plaît merci', better: 'un croissant, merci', betterWritten: null, betterEn: 'a croissant, thanks', why: 'One thank you is enough here.', weight: 'minor' },
  ],
  focusSound: { ipa: 'y', word: 'tu' },
};

export const RECAP_NO_REPLY: RecapPayload = { ...base, wins: [], phrases: [], stats: { turns: 1, rescues: 0, unassistedRate: 0, learnerReplies: 0 } };
export const RECAP_LEFT_EARLY: RecapPayload = { ...base, phrases: base.phrases.slice(0, 1), stats: { turns: 2, rescues: 0, unassistedRate: 1, learnerReplies: 1 } };

export const RECAP_LINES: readonly string[] = ['Un café, s’il vous plaît.', 'L’addition, s’il vous plaît.'];
export const RECAP_GOALS = [
  { id: 'order', goalEn: 'Order a drink', achieved: true },
  { id: 'bill', goalEn: 'Ask for the bill', achieved: false },
] as const;
export const RECAP_EVIDENCE_QUOTE = 'L’addition, s’il vous plaît.';
export const RECAP_NOT_CHARGED = sessionSettlementCopy({ kind: 'not-charged' } as Parameters<typeof sessionSettlementCopy>[0]);
