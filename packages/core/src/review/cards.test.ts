import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildCardsFromSummary } from './cards.ts';
import { buildReport, type PhonemeObservation } from '../phonemes/scoring.ts';
import { CAFE_LESSON } from '../lessons/cafe.ts';
import { LESSONS } from '../lessons/index.ts';
import type { SessionSummary } from '../session/session.ts';

const NOW = 1_700_000_000_000;

/** A finished-session summary with nothing remarkable in it, ready to override. */
function makeSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    lessonId: CAFE_LESSON.id,
    durationSec: 300,
    pronunciation: buildReport([]),
    unassistedRate: 0.5,
    wordsProduced: [],
    longestTurnSec: 3,
    speakingShare: 0.3,
    turnsCompleted: 8,
    rescues: 0,
    utterancesScored: 6,
    struggledTurnIds: [],
    nextStartRung: 3,
    ...overrides,
  };
}

/** Enough weak samples of /ʁ/ to make the report produce a focus point. */
function weakRReport() {
  const obs: PhonemeObservation[] = ['bonjour', 'café', 'merci'].map((word) => ({ ipa: 'ʁ', score: 38, word, substituted: 'l' }));
  return buildReport(obs);
}

describe('vocab cards — the learner quoted back to themselves', () => {
  test('each word is backed by the sentence they said it in, not a dictionary entry', () => {
    const cards = buildCardsFromSummary(makeSummary({ wordsProduced: ['bonjour', 'café'] }), LESSONS, NOW);

    const bonjour = cards.find((c) => c.id === 'vocab:bonjour');
    assert.ok(bonjour);
    assert.equal(bonjour.kind, 'vocab');
    assert.equal(bonjour.front, 'bonjour');
    assert.equal(bonjour.back, 'Bonjour = Hello');

    // "café" was said inside a whole line, so the card carries that whole line.
    const cafe = cards.find((c) => c.id === 'vocab:café');
    assert.ok(cafe);
    assert.equal(cafe.back, "Un café, s'il vous plaît = A coffee, please");
    assert.equal(cafe.context, cafe.back);
  });

  test('new cards are due immediately with fresh scheduling', () => {
    const [card] = buildCardsFromSummary(makeSummary({ wordsProduced: ['bonjour'] }), LESSONS, NOW);
    assert.ok(card);
    assert.equal(card.due, NOW);
    assert.equal(card.addedAt, NOW);
    assert.equal(card.reps, 0);
  });

  test('a word we cannot source a phrase for is dropped rather than guessed at', () => {
    // A card with a blank back teaches nothing, and a fabricated back would
    // break the deck's one promise: everything on it is something you said.
    const cards = buildCardsFromSummary(makeSummary({ wordsProduced: ['xylophone', 'bonjour'] }), LESSONS, NOW);
    assert.deepEqual(
      cards.map((c) => c.id),
      ['vocab:bonjour'],
    );
  });
});

describe('the phoneme card — at most one, mirroring the session report', () => {
  test('a session with a pronunciation focus yields exactly one phoneme card', () => {
    const cards = buildCardsFromSummary(makeSummary({ pronunciation: weakRReport() }), LESSONS, NOW);
    const phonemeCards = cards.filter((c) => c.kind === 'phoneme');
    assert.equal(phonemeCards.length, 1);

    const card = phonemeCards[0]!;
    assert.equal(card.id, 'phoneme:ʁ');
    assert.equal(card.front, '/ʁ/');
    assert.equal(card.ipa, 'ʁ');
    // The back is the inventory's own articulation cue plus its physical trick,
    // copy that is already tested for tone. Nothing here is generated.
    assert.match(card.back, /back of the throat/);
    assert.match(card.back, /Whisper a soft "k"/);
    // Context names the word where it went worst — the concrete example.
    assert.ok(['bonjour', 'café', 'merci'].includes(card.context));
  });

  test('a session with no focus yields no phoneme card, rather than manufacturing a problem', () => {
    const cards = buildCardsFromSummary(makeSummary({ wordsProduced: ['bonjour'] }), LESSONS, NOW);
    assert.equal(cards.filter((c) => c.kind === 'phoneme').length, 0);
  });
});

describe('turn cards — the mistakes queue', () => {
  test('a struggled turn comes back as "say it in French"', () => {
    const cards = buildCardsFromSummary(makeSummary({ struggledTurnIds: ['t2-order'] }), LESSONS, NOW);
    const turnCards = cards.filter((c) => c.kind === 'turn');
    assert.equal(turnCards.length, 1);

    const card = turnCards[0]!;
    assert.equal(card.id, 'turn:cafe-01:t2-order');
    assert.equal(card.front, 'A coffee, please', 'the front is the English — the task is producing the French');
    assert.equal(card.back, "Un café, s'il vous plaît");
    assert.equal(card.ipa, 'œ̃ ka.fe sil vu plɛ');
    // Context is the tutor line they were answering — the situation, not a definition.
    assert.match(card.context, /Qu'est-ce que je vous sers/);
  });

  test('every struggled turn earns its own card, in lesson order', () => {
    const cards = buildCardsFromSummary(makeSummary({ struggledTurnIds: ['t1-greet', 't3-sur-place'] }), LESSONS, NOW);
    assert.deepEqual(
      cards.filter((c) => c.kind === 'turn').map((c) => c.id),
      ['turn:cafe-01:t1-greet', 'turn:cafe-01:t3-sur-place'],
    );
  });

  test('a turn id the lesson no longer has is skipped without complaint', () => {
    const cards = buildCardsFromSummary(makeSummary({ struggledTurnIds: ['t-deleted', 't1-greet'] }), LESSONS, NOW);
    assert.deepEqual(
      cards.filter((c) => c.kind === 'turn').map((c) => c.id),
      ['turn:cafe-01:t1-greet'],
    );
  });

  test('an unknown lesson drops the turn cards but never the vocab', () => {
    // Vocab resolves against every lesson we have; turn ids only make sense
    // inside the lesson that produced them.
    const summary = makeSummary({ lessonId: 'retired-lesson', wordsProduced: ['bonjour'], struggledTurnIds: ['t1-greet'] });
    const cards = buildCardsFromSummary(summary, LESSONS, NOW);
    assert.deepEqual(
      cards.map((c) => c.id),
      ['vocab:bonjour'],
    );
  });
});

describe('the whole build', () => {
  test('a rich session produces all three kinds at once, vocab first', () => {
    const summary = makeSummary({
      wordsProduced: ['bonjour', 'merci'],
      pronunciation: weakRReport(),
      struggledTurnIds: ['t2-order'],
    });
    const cards = buildCardsFromSummary(summary, LESSONS, NOW);
    assert.deepEqual(
      cards.map((c) => c.kind),
      ['vocab', 'vocab', 'phoneme', 'turn'],
    );
  });

  test('an empty session builds an empty deck without throwing', () => {
    assert.deepEqual(buildCardsFromSummary(makeSummary(), LESSONS, NOW), []);
  });

  test('no card ever carries an em dash or scolding copy', () => {
    // The deck inherits the product's copy rules. Card text is lifted from
    // content files that are already walked by copy.test.ts, and this guards
    // the seams where this module assembles those pieces.
    const summary = makeSummary({
      wordsProduced: ['bonjour', 'café'],
      pronunciation: weakRReport(),
      struggledTurnIds: ['t1-greet', 't2-order'],
    });
    for (const card of buildCardsFromSummary(summary, LESSONS, NOW)) {
      for (const text of [card.front, card.back, card.context]) {
        assert.doesNotMatch(text, /—/, `em dash in card ${card.id}: "${text}"`);
        assert.doesNotMatch(text, /\b(wrong|bad|failed|incorrect)\b/i, `scolding in card ${card.id}: "${text}"`);
      }
    }
  });
});
