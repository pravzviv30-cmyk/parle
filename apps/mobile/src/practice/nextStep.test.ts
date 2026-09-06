import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, newCard, phraseKeyOf, type ConversationPack, type ReviewCard } from '@luvani/core';

import { NEXT_STEP, nextStep, packLine, reviewLine } from './nextStep.ts';
import { guiltIn } from '../copy/guilt.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

/** A card the scheduler wants back right now. */
function due(fr: string): ReviewCard {
  const card = newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - DAY);
  return { ...card, due: NOW - DAY };
}

/** A finished conversation, with the two fields each test actually cares about. */
function pack(over: {
  id: string;
  daysAgo: number;
  state?: ConversationPack['state'];
  phrases?: number;
  practised?: boolean;
}): ConversationPack {
  const phrases = over.phrases ?? 2;
  // `lastPractisedAt` is not a build input: the tutor never writes it, the app
  // sets it when the learner comes back. So it is stamped on afterwards here,
  // which is exactly how it arrives in life.
  const built = buildConversationPack({
    id: over.id,
    sessionId: over.id,
    learnerId: 'learner-1',
    createdAt: new Date(NOW - over.daysAgo * DAY).toISOString(),
    state: over.state ?? 'ready',
    title: { fr: `Titre ${over.id}`, en: `Title ${over.id}` },
    summary: 'A short conversation.',
    keyPhrases: Array.from({ length: phrases }, (_, i) => ({ fr: `ligne ${over.id} ${i}`, frWritten: null, en: `line ${i}` })),
  });
  return over.practised === true ? { ...built, lastPractisedAt: new Date(NOW).toISOString() } : built;
}

describe("The Practice tab's next step — what to do now, decided in one rule", () => {
  test('a due deck outranks a conversation waiting to be practised', () => {
    // Both branches are available. The rule is that a phrase slipping away
    // beats new ground, so the step is the review and its count is exactly the
    // due count rather than the deck size.
    const deck = [due('Un café'), due('Une eau')];
    const packs = [pack({ id: 'a', daysAgo: 1 })];

    assert.deepEqual(nextStep(deck, packs, NOW), { kind: 'review', due: 2 });
  });

  test('with a quiet deck the step is the newest conversation nobody has come back to', () => {
    const packs = [pack({ id: 'older', daysAgo: 5 }), pack({ id: 'newer', daysAgo: 1 })];

    const step = nextStep([], packs, NOW);
    assert.equal(step?.kind, 'pack');
    assert.equal(step?.kind === 'pack' ? step.pack.id : null, 'newer');
  });

  test('a conversation already practised is not offered again as the next step', () => {
    // The whole point of the branch is the conversation still warm enough to be
    // worth revisiting. One the learner has already drilled is not that, and
    // offering it back would make the step a loop rather than a step.
    const packs = [pack({ id: 'done', daysAgo: 1, practised: true })];

    assert.equal(nextStep([], packs, NOW), null);
  });

  test('a conversation still being written, or carrying no phrases, is not a step', () => {
    assert.equal(nextStep([], [pack({ id: 'writing', daysAgo: 1, state: 'generating' })], NOW), null);
    assert.equal(nextStep([], [pack({ id: 'empty', daysAgo: 1, phrases: 0 })], NOW), null);
  });

  test('a learner with nothing at all gets no step, and no cheerful message', () => {
    // Drawing nothing is the deliberate branch. A screen that congratulates
    // somebody for having no work is a screen that has to keep finding words.
    assert.equal(nextStep([], [], NOW), null);
  });

  test('the step counts a card and a phrase, singular at one, and never scolds', () => {
    assert.equal(reviewLine(1), '1 card is ready');
    assert.equal(reviewLine(3), '3 cards are ready');
    assert.equal(packLine(pack({ id: 'one', daysAgo: 1, phrases: 1 })), '1 phrase from this conversation, ready when you are');
    assert.match(packLine(pack({ id: 'many', daysAgo: 1, phrases: 4 })), /^4 phrases from this conversation/);

    for (const line of [NEXT_STEP.label, NEXT_STEP.review, reviewLine(1), reviewLine(9), packLine(pack({ id: 'g', daysAgo: 1 }))]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a word this app does not say to a learner`);
      assert.ok(!line.includes('—'), `"${line}" has an em dash in copy a learner reads`);
    }
  });
});
