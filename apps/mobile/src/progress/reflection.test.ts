/**
 * The weekly reflection (Stage 4, item 6, 2026-09-25).
 *
 * One improvement, one focus, one next, each from recorded evidence in the
 * learner's last seven local days, or nothing. No comparison with an earlier
 * week, so anything older than the week cannot change what is said; no count
 * of days, no percentage; and a week with nothing in it draws nothing.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildConversationPack, missionStates, type ConversationPack, type StoredSession } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { recentConversations, type HistoryItem } from '../myfrench/recentConversations.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { storyFrom } from './story.ts';
import { REFLECTION_COPY, hasReflection, reflectionFrom } from './reflection.ts';

const NOW = new Date(2026, 8, 25, 18, 0, 0).getTime();
const DAY = 86_400_000;
const LONG_AGO = NOW - 40 * DAY;
const PROGRESS = missionStates([], [], NOW);

function pack(id: string, createdAt: number, corrections: { quote: string; better: string }[] = []): ConversationPack {
  return buildConversationPack({
    id,
    sessionId: id,
    learnerId: 'learner-1',
    createdAt: new Date(createdAt).toISOString(),
    title: { fr: 'Au café', en: 'At the café' },
    summary: 'Ordered a coffee.',
    keyPhrases: [{ fr: 'Un café, s’il vous plaît', frWritten: null, en: 'A coffee, please' }],
    corrections: corrections.map((c) => ({ ...c, betterEn: 'a coffee', why: 'politer' })),
  });
}

const practised = (packId: string, at: number): HistoryItem => ({
  kind: 'session-completed',
  id: `s-${packId}-${at}`,
  at,
  packId,
  targets: [{ phraseKey: 'phrase:un café', source: { kind: 'pack', packId }, outcome: 'practised', attempts: 2 }],
});

const focusCheck = (at: number, focus: string | null = 'The r sits further back'): SoundCheckEvidence =>
  ({ missionId: 'mission:cafe', reference: 'Un café', at, kind: 'assessed-focus', focus, phoneme: 'ʁ' }) as SoundCheckEvidence;

const EMPTY_STORY = { sentences: [] as string[] };

describe('the weekly reflection — Stage 4', () => {
  test('a week with nothing recorded draws nothing at all', () => {
    const reflection = reflectionFrom({ story: EMPTY_STORY, recent: [], checks: [], progress: PROGRESS, now: NOW });
    assert.deepEqual(reflection, { improvement: null, focus: null, next: null });
    assert.equal(hasReflection(reflection), false, 'an empty reflection is drawn as a slot, which reads as a quota');
    // App opens are activity with no evidence: the story says a quiet line, the reflection still says nothing.
    const opens = storyFrom({ sessions: [], activity: [{ at: NOW - DAY }, { at: NOW - 2 * DAY }], packs: [], completions: [], now: NOW });
    assert.deepEqual(reflectionFrom({ story: opens, recent: [], checks: [], progress: PROGRESS, now: NOW }), { improvement: null, focus: null, next: null });
  });

  test('improvement is this week\'s practice sentence, and the next place comes only with something to reflect on', () => {
    const packs = [pack('pack-a', NOW - DAY)];
    const recent = recentConversations({ packs, events: [practised('pack-a', NOW - DAY)] });
    const reflection = reflectionFrom({ story: EMPTY_STORY, recent, checks: [], progress: PROGRESS, now: NOW });
    assert.equal(reflection.improvement, 'You practised a phrase from At the café.');
    assert.ok(reflection.next, 'a week with something in it offers no next place');
    assert.equal(reflection.next.missionId, 'mission:cafe', 'the next place is not the one core suggests');
    assert.equal(reflection.next.title, 'Order at a café');
    assert.equal(reflection.next.place, 'cafe', 'the row cannot draw the place it opens');
  });

  test('without practice, improvement is the story\'s independence or sound sentence, never its counts', () => {
    const session = (at: number, rate: number, wins: string[] = []): StoredSession =>
      ({
        endedAt: at,
        summary: { unassistedRate: rate, wordsProduced: ['un', 'café', 'merci'], pronunciation: { wins: wins.map((ipa) => ({ ipa, meanScore: 90 })) } },
      }) as unknown as StoredSession;
    const independent = storyFrom({ sessions: [session(NOW - DAY, 0.9)], activity: [], packs: [], completions: [], now: NOW });
    assert.ok(independent.sentences.some((s) => /\d/.test(s)), 'the story has no count to leave out, so this proves nothing');
    const first = reflectionFrom({ story: independent, recent: [], checks: [], progress: PROGRESS, now: NOW });
    assert.equal(first.improvement, 'This week you mostly found the words on your own.');

    const sound = storyFrom({ sessions: [session(NOW - DAY, 0.2, ['y'])], activity: [], packs: [], completions: [], now: NOW });
    const second = reflectionFrom({ story: sound, recent: [], checks: [], progress: PROGRESS, now: NOW });
    assert.equal(second.improvement, 'Your /y/ came out clearly this week.');

    const countsOnly = storyFrom({ sessions: [session(NOW - DAY, 0.2)], activity: [], packs: [], completions: [], now: NOW });
    assert.equal(reflectionFrom({ story: countsOnly, recent: [], checks: [], progress: PROGRESS, now: NOW }).improvement, null, 'a count became the improvement');
  });

  test('focus is this week\'s measured sound, else the newest conversation\'s curated correction', () => {
    const measured = reflectionFrom({ story: EMPTY_STORY, recent: [], checks: [focusCheck(NOW - DAY)], progress: PROGRESS, now: NOW });
    assert.equal(measured.focus, 'The r sits further back');
    // A dated or counted assessor sentence is not repeated later; the timeless line stands in.
    const dated = reflectionFrom({ story: EMPTY_STORY, recent: [], checks: [focusCheck(NOW - DAY, 'Today your r was 3 times off')], progress: PROGRESS, now: NOW });
    assert.equal(dated.focus, 'One sound is ready to revisit');
    // A clear check, a self-guided one or an unavailable one is not a focus.
    const clear = { ...focusCheck(NOW - DAY), kind: 'assessed-clear', phoneme: null, focus: null } as SoundCheckEvidence;
    const selfGuided = { ...focusCheck(NOW - DAY), kind: 'self-guided' } as SoundCheckEvidence;
    assert.equal(reflectionFrom({ story: EMPTY_STORY, recent: [], checks: [clear, selfGuided], progress: PROGRESS, now: NOW }).focus, null);

    const packs = [
      pack('pack-old', NOW - 3 * DAY, [{ quote: 'un café', better: 'Un café, s’il vous plaît' }]),
      pack('pack-new', NOW - DAY, [{ quote: 'je veux', better: 'Je voudrais un croissant' }]),
    ];
    const recent = recentConversations({ packs, events: [] });
    assert.equal(reflectionFrom({ story: EMPTY_STORY, recent, checks: [], progress: PROGRESS, now: NOW }).focus, 'Je voudrais un croissant');
  });

  test('identical for any earlier history: nothing older than the week changes what is said', () => {
    const weekPacks = [pack('pack-a', NOW - DAY)];
    const weekEvents = [practised('pack-a', NOW - DAY)];
    const base = reflectionFrom({
      story: EMPTY_STORY,
      recent: recentConversations({ packs: weekPacks, events: weekEvents }),
      checks: [focusCheck(NOW - DAY)],
      progress: PROGRESS,
      now: NOW,
    });
    const oldPacks = [...weekPacks, pack('pack-old', LONG_AGO, [{ quote: 'x', better: 'Une autre phrase' }])];
    const withPast = reflectionFrom({
      story: EMPTY_STORY,
      recent: recentConversations({ packs: oldPacks, events: [...weekEvents, practised('pack-old', LONG_AGO)] }),
      checks: [focusCheck(NOW - DAY), focusCheck(LONG_AGO, 'An older focus')],
      progress: PROGRESS,
      now: NOW,
    });
    assert.deepEqual(withPast, base, 'an earlier week changed this week\'s reflection');
    // And only the past, nothing in the week: nothing.
    const onlyPast = reflectionFrom({
      story: EMPTY_STORY,
      recent: recentConversations({ packs: [pack('pack-old', LONG_AGO, [{ quote: 'x', better: 'Une phrase' }])], events: [practised('pack-old', LONG_AGO)] }),
      checks: [focusCheck(LONG_AGO)],
      progress: PROGRESS,
      now: NOW,
    });
    assert.deepEqual(onlyPast, { improvement: null, focus: null, next: null });
  });

  test('every line passes the guilt list, and nothing counts days or shows a percentage', () => {
    const guilty = reflectionFrom({
      story: { sentences: ['This week you mostly found the words on your own.'] },
      recent: [],
      checks: [focusCheck(NOW - DAY, 'Do not lose the r')],
      progress: PROGRESS,
      now: NOW,
    });
    assert.equal(guilty.focus, null, 'a focus carrying a banned word was drawn');
    for (const line of Object.values(REFLECTION_COPY)) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.doesNotMatch(line, /\d|%|—/, `"${line}" counts, shows a share or carries a dash`);
    }
    // Stage 4 browser proof (2026-09-25): "Your week in three lines" sat over
    // two lines. Any of the three can be absent, so the heading counts none.
    assert.doesNotMatch(REFLECTION_COPY.label, /\b(one|two|three)\b/i, `"${REFLECTION_COPY.label}" counts lines that may not all be there`);
    const source = readFileSync(fileURLToPath(new URL('./reflection.ts', import.meta.url)), 'utf8');
    assert.match(source, /guiltIn\(/, 'the reflection does not hold its lines to the guilt list');
    // F233: the story has exactly two importers, and this module is not one.
    assert.doesNotMatch(source, /from '\.\/story\.ts'|progress\/story\.ts'/, 'reflection.ts imports the weekly story module');
  });
});
