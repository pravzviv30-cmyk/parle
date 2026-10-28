/**
 * "How it’s going" (2026-10-28, LEARN-013, ledger F890 and F891): Getting
 * better at and Needs another go, decided from stored evidence only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { createProfile, IMPROVING_AFTER_SESSIONS, type LearnerProfile } from '@luvani/brain/profile';
import type { ReviewCard } from '@luvani/core';

import type { FeatureAccess, LockedFeature } from '../access/featureAccess.ts';
import {
  GETTING_BETTER,
  JOURNEY_COPY,
  JOURNEY_TEASERS,
  NEEDS_ANOTHER_GO,
  PROGRESS_HEADING,
  QUIET_LINE,
  READY_AGAIN,
  progressRowsView,
  type ProgressView,
} from './journeyView.ts';
import { PROGRESS_STATES, progressFixture } from './progressFixtures.ts';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 28, 12).getTime();
const open = (_f: LockedFeature): FeatureAccess => 'unlocked';
const free = (f: LockedFeature): FeatureAccess => (f === 'fullJourney' ? 'locked' : 'unlocked');

type Pattern = LearnerProfile['errorPatterns'][string];
const pattern = (lastSession: number, sessions = 2): Pattern => ({ count: 3, lastSeen: '2026-10-01T00:00:00Z', example: 'x', sessions, lastSession });

function brain(input: { sessions?: number; patterns?: Record<string, Pattern>; phrases?: LearnerProfile['phrases'] } = {}): LearnerProfile {
  const base = createProfile();
  return { ...base, stats: { ...base.stats, sessions: input.sessions ?? 0 }, errorPatterns: input.patterns ?? {}, phrases: input.phrases ?? {} };
}

function card(front: string, opts: { due?: number; lapses?: number; transfers?: number; id?: string } = {}): ReviewCard {
  return {
    id: opts.id ?? `phrase:${front.toLowerCase()}`, kind: 'vocab', front, back: 'en', context: '', ipa: '',
    addedAt: NOW - 30 * DAY, due: opts.due ?? NOW - DAY, intervalDays: 1, ease: 2.3, reps: 2, lapses: opts.lapses ?? 0,
    evidence: { retrievals: 1, convoUses: 0, transfers: opts.transfers ?? 0 },
  };
}

function helped(fr: string, frWritten: string | null = null, timesUsedWell = 0): LearnerProfile['phrases'][string] {
  return { fr, frWritten, en: 'en', register: 'courant', introducedAt: '2026-10-01T00:00:00Z', timesUsedWell, timesAssisted: 1, mastered: false };
}

const view = (b: LearnerProfile, deck: readonly ReviewCard[], access = open): ProgressView | null => progressRowsView({ brain: b, deck, now: NOW, access });
const row = (v: ProgressView | null, key: 'better' | 'again') => v?.rows.find((r) => r.key === key);
const allText = (v: ProgressView): string[] => v.rows.flatMap((r) => [r.label, ...r.lines, ...r.chips, r.accessibilityLabel]);

describe('Getting better at (F890)', () => {
  test('a recurring pattern quiet for three conversations shows, under its authored title', () => {
    // Last seen in conversation 2; conversations 3, 4 and 5 then finished without it.
    const v = view(brain({ sessions: 2 + 1 + IMPROVING_AFTER_SESSIONS, patterns: { 'gender-agreement': pattern(2) } }), []);
    assert.equal(v?.heading, PROGRESS_HEADING);
    const better = row(v, 'better');
    assert.equal(better?.label, GETTING_BETTER);
    assert.equal(better?.dot, 'mint');
    assert.deepEqual(better?.lines, [`Gender agreement. ${QUIET_LINE}`]);
    assert.equal(better?.route, null);
  });

  test('two quiet conversations are not enough: the boundary is the brain rule', () => {
    assert.equal(view(brain({ sessions: 2 + IMPROVING_AFTER_SESSIONS, patterns: { 'gender-agreement': pattern(2) } }), []), null);
  });

  test('an un-authored tag never reaches the learner', () => {
    const v = view(brain({ sessions: 20, patterns: { 'liaison-drop': pattern(1), 'gender-agreement': pattern(1) } }), []);
    assert.equal(row(v, 'better')?.lines.length, 1);
    for (const text of allText(v!)) assert.doesNotMatch(text, /liaison-drop/);
    assert.equal(view(brain({ sessions: 20, patterns: { 'liaison-drop': pattern(1) } }), []), null);
  });

  test('at most two patterns, newest quiet first', () => {
    const v = view(brain({ sessions: 20, patterns: { 'gender-agreement': pattern(1), 'tu-vous-mixing': pattern(5), 'verb-conjugation': pattern(3) } }), []);
    assert.deepEqual(row(v, 'better')?.lines.map((l) => l.split('.')[0]), ['Tu or vous', 'Verb endings']);
  });
});

describe('Needs another go (F891)', () => {
  test('membership through a lapse', () => {
    const again = row(view(brain(), [card('bonjour', { lapses: 1 }), card('merci')]), 'again');
    assert.deepEqual(again?.chips, ['bonjour']);
    assert.deepEqual(again?.lines, [READY_AGAIN]);
    assert.equal(again?.label, NEEDS_ANOTHER_GO);
    assert.equal(again?.dot, 'sun');
    assert.deepEqual(again?.route, { screen: 'Review' });
  });

  test('membership through help, by fr and by frWritten, and not once used well', () => {
    const deck = [card('merci'), card('à plus'), card('salut')];
    const b = brain({ phrases: { a: helped('Merci'), b: helped('a plus', 'à plus'), c: helped('salut', null, 1) } });
    assert.deepEqual(row(view(b, deck), 'again')?.chips, ['merci', 'à plus']);
  });

  test('a phrase not yet due is left out', () => {
    assert.equal(view(brain(), [card('bonjour', { lapses: 2, due: NOW + DAY })]), null);
  });

  test('a transferred phrase is left out', () => {
    assert.equal(view(brain(), [card('bonjour', { lapses: 2, transfers: 1 })]), null);
  });

  test('a non-phrase card is left out', () => {
    assert.equal(view(brain(), [card('bonjour', { lapses: 2, id: 'phoneme:y' })]), null);
  });

  test('order is oldest due first, even when lapses say otherwise, and capped at three', () => {
    const deck = [
      card('quatre', { due: NOW - 1 * DAY, lapses: 9 }),
      card('un', { due: NOW - 4 * DAY, lapses: 1 }),
      card('trois', { due: NOW - 2 * DAY, lapses: 5 }),
      card('deux', { due: NOW - 3 * DAY, lapses: 1 }),
    ];
    assert.deepEqual(row(view(brain(), deck), 'again')?.chips, ['un', 'deux', 'trois']);
  });
});

describe('How it’s going, as a section', () => {
  test('null when neither row has evidence', () => {
    assert.equal(view(brain(), []), null);
    assert.equal(view(brain({ sessions: 1, patterns: { 'gender-agreement': pattern(0, 1) } }), [card('merci')]), null);
  });

  test('locked under fullJourney: no rows, the teaser instead', () => {
    const v = view(brain({ sessions: 20, patterns: { 'gender-agreement': pattern(1) } }), [card('bonjour', { lapses: 1 })], free);
    assert.equal(v?.locked, true);
    assert.deepEqual(v?.rows, []);
    assert.equal(v?.teaser, JOURNEY_TEASERS.progress);
    assert.equal(v?.feature, 'fullJourney');
  });

  test('no digit in any row except the three conversations, and no lapse count anywhere', () => {
    const v = view(
      brain({ sessions: 20, patterns: { 'gender-agreement': pattern(1), 'tu-vous-mixing': pattern(2) } }),
      [card('bonjour', { lapses: 7 }), card('merci', { lapses: 4 })],
    )!;
    for (const text of allText(v)) {
      assert.doesNotMatch(text.replaceAll(`last ${IMPROVING_AFTER_SESSIONS} conversations`, ''), /\d/, `a number in "${text}"`);
      assert.doesNotMatch(text, /%|\bof\b \d/);
    }
  });

  test('the copy holds no em dash and is in the sweep', () => {
    for (const line of [PROGRESS_HEADING, GETTING_BETTER, NEEDS_ANOTHER_GO, QUIET_LINE, READY_AGAIN]) assert.ok(JOURNEY_COPY.includes(line), line);
    for (const line of [...JOURNEY_COPY, ...Object.values(JOURNEY_TEASERS)]) assert.doesNotMatch(line, /—/);
    assert.doesNotMatch(QUIET_LINE, /master|perfect|fixed/i, 'the absence line claims mastery');
  });

  test('every preview fixture draws its state', () => {
    const states = Object.fromEntries(PROGRESS_STATES.map((s) => [s, progressRowsView(progressFixture(s))]));
    assert.deepEqual(states.both?.rows.map((r) => r.key), ['better', 'again']);
    assert.deepEqual(states.better?.rows.map((r) => r.key), ['better']);
    assert.deepEqual(states.again?.rows.map((r) => r.key), ['again']);
    assert.equal(states.free?.teaser, JOURNEY_TEASERS.progress);
  });

  test('the tab and the preview draw the real section, and the rows never read lapses for order or display', () => {
    const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.match(src('../tabs/MyFrenchTab.tsx'), /<ProgressSection view=\{progress\}/);
    assert.match(src('../dev/YourFrenchPreview.tsx'), /<ProgressSection view=\{going\}/);
    const fn = src('./journeyView.ts');
    const body = fn.slice(fn.indexOf('export function needsAnotherGo('), fn.indexOf('export function progressRowsView('));
    assert.deepEqual(body.match(/lapses/g), ['lapses'], 'lapses is read for something other than membership');
  });
});
