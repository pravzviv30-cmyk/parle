import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildConversationPack,
  newCard,
  phraseKeyOf,
  type ConversationPack,
  type DrillExercise,
  type ReviewCard,
} from '@luvani/core';

import { eligiblePacks, packSelection, practicePackOf, recommendation } from './recommendation.ts';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function card(fr: string, dueIn: number): ReviewCard {
  return { ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - 10 * DAY), due: NOW + dueIn, reps: 2 };
}

function translate(fr: string): DrillExercise {
  return { id: `ex:${fr}`, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'translate', fr, en: `meaning of ${fr}`, direction: 'en-fr', accepted: [fr] };
}

function pack(id: string, daysAgo: number, lines: string[], state: ConversationPack['state'] = 'ready'): ConversationPack {
  return buildConversationPack({
    id,
    sessionId: id,
    learnerId: 'learner-1',
    createdAt: new Date(NOW - daysAgo * DAY).toISOString(),
    state,
    title: { fr: `Titre ${id}`, en: `Title ${id}` },
    summary: 'A short conversation.',
    keyPhrases: lines.map((fr) => ({ fr, frWritten: null, en: `meaning of ${fr}` })),
  });
}

describe('the recommended practice action', () => {
  test('a saved conversation whose cards are not due can still be practised now', () => {
    // The regression this feature exists for: every card is scheduled for
    // later, so the ordinary due selector finds nothing, and the conversation
    // the learner just had used to offer an empty sitting.
    const lines = ['Je voudrais un café', 'Sur place', 'Ça fait combien'];
    const deck = lines.map((fr) => card(fr, 5 * DAY));
    const bank = lines.map(translate);
    const packs = [pack('p1', 1, lines)];

    const rec = recommendation({ resumable: null, deck, bank, packs, now: NOW });
    assert.equal(rec.kind, 'start');
    if (rec.kind !== 'start') return;
    assert.equal(rec.selection.targets.length, 3);
    assert.ok(rec.selection.targets.every((t) => t.source.kind === 'pack' && !t.scheduled), 'early rehearsal was marked as a scheduled return');
    assert.equal(rec.source?.id, 'p1');

    const direct = packSelection({ packId: 'p1', deck, bank, packs, now: NOW });
    assert.ok(direct !== null && direct.targets.length === 3, 'Practise this conversation found nothing to play before the cards were due');
  });

  test('a sitting made only of review never names a conversation', () => {
    const deck = [card('Bonjour', -DAY)];
    const bank = [translate('Bonjour')];
    // The pack has lines but nothing the bank can drill.
    const packs = [pack('p1', 1, ['Une ligne sans exercice'])];

    const rec = recommendation({ resumable: null, deck, bank, packs, now: NOW });
    assert.equal(rec.kind, 'start');
    if (rec.kind !== 'start') return;
    assert.equal(rec.selection.shape, 'review-only');
    assert.equal(rec.source, null, 'unrelated review was attributed to a conversation');
  });

  test('balanced: review and the newest playable conversation share the sitting, and attribution rides on each target', () => {
    const due = ['Merci', 'Bonsoir', 'Salut', 'Pardon'];
    const talk = ['Un thé', 'Une eau', 'Un jus', 'Un café'];
    const deck = [...due.map((fr) => card(fr, -DAY)), ...talk.map((fr) => card(fr, 3 * DAY))];
    const bank = [...due, ...talk].map(translate);
    const rec = recommendation({ resumable: null, deck, bank, packs: [pack('p1', 1, talk)], now: NOW });

    assert.equal(rec.kind, 'start');
    if (rec.kind !== 'start') return;
    assert.equal(rec.selection.shape, 'balanced');
    assert.equal(rec.selection.targets.length, 6);
    assert.equal(rec.selection.targets.filter((t) => t.source.kind === 'review').length, 3);
    assert.equal(rec.selection.targets.filter((t) => t.source.kind === 'pack').length, 3);
  });

  test('a newer conversation with nothing playable gives way to an older one that has something', () => {
    const lines = ['Au revoir'];
    const packs = [pack('newer', 1, ['Rien à jouer']), pack('older', 4, lines)];
    const rec = recommendation({ resumable: null, deck: [], bank: lines.map(translate), packs, now: NOW });
    assert.equal(rec.kind === 'start' ? rec.source?.id : null, 'older');
  });

  test('an unfinished sitting is resumed before anything new is chosen', () => {
    const lines = ['Je voudrais un café'];
    const packs = [pack('p1', 1, lines)];
    const rec = recommendation({ resumable: { packId: 'p1', remaining: 2 }, deck: [], bank: lines.map(translate), packs, now: NOW });
    assert.deepEqual(rec.kind, 'resume');
    assert.equal(rec.kind === 'resume' ? rec.source?.id : null, 'p1');

    // A resume record whose conversation has since gone names nothing, rather
    // than a title the learner deleted.
    const orphan = recommendation({ resumable: { packId: 'gone', remaining: 1 }, deck: [], bank: [], packs, now: NOW });
    assert.equal(orphan.kind === 'resume' ? orphan.source : 'wrong', null);

    // And a record with nothing left in it is not a resume.
    const spent = recommendation({ resumable: { packId: 'p1', remaining: 0 }, deck: [], bank: lines.map(translate), packs, now: NOW });
    assert.equal(spent.kind, 'start');
  });

  test('nothing playable is never an empty primary action', () => {
    assert.deepEqual(recommendation({ resumable: null, deck: [], bank: [], packs: [], now: NOW }), { kind: 'none', fallback: 'first' });
    assert.deepEqual(
      recommendation({ resumable: null, deck: [], bank: [], packs: [pack('p1', 1, ['Rien'])], now: NOW }),
      { kind: 'none', fallback: 'talk' },
    );
    assert.equal(packSelection({ packId: 'p1', deck: [], bank: [], packs: [pack('p1', 1, ['Rien'])], now: NOW }), null);
    assert.equal(packSelection({ packId: 'missing', deck: [], bank: [], packs: [], now: NOW }), null);
  });

  test('only ready conversations contribute, and corrections reach practice with their better line', () => {
    assert.deepEqual(eligiblePacks([pack('g', 1, ['x'], 'generating'), pack('r', 2, ['y'])]).map((p) => p.id), ['r']);
    const withRepair = buildConversationPack({
      id: 'c1',
      sessionId: 'c1',
      learnerId: 'learner-1',
      createdAt: new Date(NOW).toISOString(),
      title: { fr: 'T', en: 'T' },
      summary: 's',
      keyPhrases: [{ fr: 'Bonjour', frWritten: null, en: 'hello' }],
      corrections: [{ quote: 'je suis faim', better: "J'ai faim", betterEn: 'I am hungry', why: 'avoir' }],
    });
    assert.deepEqual(practicePackOf(withRepair).phraseKeys, [phraseKeyOf('Bonjour'), phraseKeyOf("J'ai faim")]);
  });
});
