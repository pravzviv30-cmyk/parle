import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, newCard, phraseKeyOf, type ConversationPack, type ReviewCard } from '@luvani/core';

import { dueKeySet, phrasesLine, relativeDay, sessionCardOf, spokenLine, standingOf, STANDING, topicsOf } from './sessionCard.ts';
import { guiltIn } from '../copy/guilt.ts';

const DAY = 24 * 60 * 60 * 1000;
/** Midday on a Wednesday, local. Midday so no test straddles a day boundary. */
const NOW = new Date(2026, 8, 2, 12, 0, 0).getTime();

function pack(over: Partial<Parameters<typeof buildConversationPack>[0]> & { daysAgo?: number } = {}): ConversationPack {
  const { daysAgo, ...rest } = over;
  return buildConversationPack({
    id: 'p1',
    sessionId: 'p1',
    learnerId: 'learner-1',
    createdAt: new Date(NOW - (daysAgo ?? 1) * DAY).toISOString(),
    state: 'ready',
    title: { fr: 'Commander un café au comptoir', en: 'Ordering at a Paris café' },
    summary: 'A short conversation.',
    keyPhrases: [{ fr: 'un café', frWritten: null, en: 'a coffee' }],
    ...rest,
  });
}

function card(fr: string): ReviewCard {
  return newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - DAY);
}

describe('a recorded conversation, said the way a person would say it', () => {
  test('when it happened is a calendar day, not an elapsed count of hours', () => {
    // A conversation late last night is Yesterday this morning. Reading it off
    // milliseconds would call that "13 hours ago", which is a precision nobody
    // asked for about a thing they remember doing.
    assert.equal(relativeDay(new Date(NOW - 2 * 60 * 60 * 1000).toISOString(), NOW), 'Today');
    assert.equal(relativeDay(new Date(NOW - DAY).toISOString(), NOW), 'Yesterday');
    assert.equal(relativeDay(new Date(NOW - 3 * DAY).toISOString(), NOW), '3 days ago');
    assert.equal(relativeDay(new Date(NOW - 9 * DAY).toISOString(), NOW), 'Last week');
    assert.equal(relativeDay(new Date(NOW - 20 * DAY).toISOString(), NOW), '2 weeks ago');
  });

  test('past four weeks it becomes a real date, because a big number is arithmetic', () => {
    assert.equal(relativeDay(new Date(2026, 6, 12, 9, 0, 0).toISOString(), NOW), '12 July');
  });

  test('a timestamp the app cannot read, or one from the future, still says something', () => {
    // Both are clock disagreements rather than things to report to a learner.
    // A card that refuses to draw is worse than a card that is vague.
    assert.equal(relativeDay('not a date', NOW), 'Earlier');
    assert.equal(relativeDay(new Date(NOW + 5 * DAY).toISOString(), NOW), 'Today');
  });

  test('a session nobody timed says nothing about time, rather than nought minutes', () => {
    // The rule momentum.ts settled: nothing measured is not zero minutes of
    // speaking, and a real conversation reported as "0 min spoken" tells the
    // learner it did not happen.
    assert.equal(spokenLine(null), null);
    assert.equal(spokenLine(0), null);
    assert.equal(spokenLine(-30), null);
    assert.equal(spokenLine(40), 'Under a minute spoken');
    assert.equal(spokenLine(8 * 60), '8 min spoken');
    // Floored, never rounded up. This is a claim about time somebody spent.
    assert.equal(spokenLine(8 * 60 + 59), '8 min spoken');
  });

  test('the standing chip says the most useful true thing, in one order', () => {
    const wanted = dueKeySet([card('un café')]);
    const nothing = dueKeySet([]);

    assert.deepEqual(standingOf(pack({ state: 'generating' }), wanted), { key: 'writing', words: STANDING.writing });
    assert.deepEqual(standingOf(pack({ state: 'failed' }), wanted), { key: 'held', words: STANDING.held });
    assert.equal(standingOf(pack({ state: 'archived' }), wanted), null);

    // A card the scheduler wants back outranks a sound worth working on: it is
    // the more useful of the two, and only one chip is drawn.
    assert.deepEqual(
      standingOf(pack({ pronunciationFocus: 'r' }), wanted),
      { key: 'ready', words: STANDING.ready },
    );
    assert.deepEqual(standingOf(pack({ pronunciationFocus: 'r' }), nothing), { key: 'sound', words: STANDING.sound });
  });

  test('a conversation with nothing to report carries no chip at all', () => {
    // A chip that always draws stops being read. This is the branch that keeps
    // it worth looking at.
    assert.equal(standingOf(pack(), dueKeySet([])), null);
    assert.deepEqual(
      standingOf({ ...pack(), lastPractisedAt: new Date(NOW).toISOString() }, dueKeySet([])),
      { key: 'practised', words: STANDING.practised },
    );
  });

  test('the topics box and the phrase count are absent rather than empty', () => {
    assert.equal(topicsOf(pack({ topics: [] })), null);
    assert.equal(topicsOf(pack({ topics: [{ fr: '  ', en: '   ' }] })), null, 'a topic that is only whitespace was counted');
    assert.deepEqual(topicsOf(pack({ topics: [{ fr: 'Le café', en: 'Ordering drinks' }] })), {
      label: '1 topic unpacked',
      body: 'Ordering drinks',
    });
    assert.deepEqual(
      topicsOf(pack({ topics: [{ fr: 'a', en: 'Greeting the server' }, { fr: 'b', en: 'Asking for the bill' }] })),
      { label: '2 topics unpacked', body: 'Greeting the server, Asking for the bill' },
    );

    assert.equal(phrasesLine(pack({ keyPhrases: [] })), null);
    assert.equal(phrasesLine(pack()), '1 key phrase');
  });

  test('one pack folds into one card, and its drill keys are deck keys', () => {
    // The bug this pins: handing Drill the French lines themselves rather than
    // the `phrase:` keys the deck is indexed by opens a sitting with nothing in
    // it, and nothing on screen says why.
    const folded = sessionCardOf(pack({ durationSec: 8 * 60 }), dueKeySet([card('un café')]), NOW);

    assert.equal(folded.when, 'Yesterday');
    assert.equal(folded.spoken, '8 min spoken');
    assert.equal(folded.titleEn, 'Ordering at a Paris café');
    assert.equal(folded.titleFr, 'Commander un café au comptoir');
    assert.deepEqual(folded.phraseKeys, [phraseKeyOf('un café')]);
    assert.ok(folded.phraseKeys.every((key) => key.startsWith('phrase:')), 'a drill key is not a deck key');
  });

  test('nothing a card says scolds, counts a run of days, or carries an em dash', () => {
    const lines = [
      ...Object.values(STANDING),
      relativeDay(new Date(NOW - DAY).toISOString(), NOW),
      spokenLine(8 * 60) ?? '',
      phrasesLine(pack()) ?? '',
      topicsOf(pack({ topics: [{ fr: 'a', en: 'Ordering drinks' }] }))?.label ?? '',
      sessionCardOf(pack(), dueKeySet([]), NOW).revisit,
    ];
    for (const line of lines) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a word this app does not say to a learner`);
      assert.ok(!line.includes('—'), `"${line}" has an em dash in copy a learner reads`);
    }
  });
});
