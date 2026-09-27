import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  answerCurrent,
  buildConversationPack,
  buildPracticeSession,
  newCard,
  phraseKeyOf,
  type ConversationPack,
  type DrillExercise,
  type ReviewCard,
} from '@luvani/core';

import { practiceOpening, resumableOf, withoutDeletedSources } from './opening.ts';
import { practiceCardGrades, practiceOutcomes } from './completion.ts';
import { restorePracticeSession } from './sessionStore.ts';
import { toSessionRecord } from './sessionStore.ts';
import { packSelection } from './recommendation.ts';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

const card = (fr: string, dueIn: number): ReviewCard =>
  ({ ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - 10 * DAY), due: NOW + dueIn, reps: 2 });
const enFr = (fr: string): DrillExercise =>
  ({ id: `t:${phraseKeyOf(fr)}`, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'translate', fr, en: `meaning ${fr}`, direction: 'en-fr', accepted: [fr] });
const pack = (id: string, lines: string[]): ConversationPack =>
  buildConversationPack({
    id, sessionId: id, learnerId: 'l', createdAt: new Date(NOW - DAY).toISOString(),
    title: { fr: 'T', en: 'T' }, summary: 's', keyPhrases: lines.map((fr) => ({ fr, frWritten: null, en: fr })),
  });

const LINES = ['Je voudrais un café', 'Sur place', 'Ça fait combien'];
const deck = LINES.map((fr) => card(fr, 3 * DAY));
const bank = LINES.map(enFr);
const packs = [pack('p1', LINES)];

/** A pack sitting partly answered, saved exactly as the screen saves it. */
function savedMidSitting(exposed: boolean) {
  const selection = packSelection({ packId: 'p1', deck, bank, packs, now: NOW })!;
  const built = buildPracticeSession(selection.targets, bank, deck, NOW);
  const first = built.state.queue[0]!;
  const answered = answerCurrent(built.state, first.kind === 'translate' ? first.fr : '').state;
  const record = toSessionRecord({
    sittingId: 'sMidSitting.1', startedAt: NOW, origin: 'pack', packId: 'p1', exposed, micSuppressed: false,
    targets: built.targets, state: answered,
  });
  return { built, answered, record };
}

describe('what a practice screen opens on', () => {
  test('a reload of the same sitting resumes the same queue, position, answers and id, and deals nothing new', () => {
    const { answered, record } = savedMidSitting(false);
    const opening = practiceOpening({ route: { origin: 'pack', packId: 'p1', exposed: false }, record, deck, bank, packs, now: NOW + 60_000 });

    assert.equal(opening.kind, 'resume', 'a reload dealt a fresh sitting instead of resuming');
    if (opening.kind !== 'resume') return;
    assert.equal(opening.record.sittingId, 'sMidSitting.1', 'the resumed sitting has a new id, which would let it complete twice');
    assert.deepEqual(opening.restored.state.queue.map((e) => e.id), answered.queue.map((e) => e.id), 'the queue order or position changed on resume');
    assert.deepEqual(opening.restored.state.answered, answered.answered, 'an answer given before the reload was lost or changed');
    // The answered exercise is found again, so its outcome can still be read.
    assert.deepEqual(opening.answeredExercises.map((e) => e.id), answered.answered.map((a) => a.id));
    const outcomes = practiceOutcomes({ state: opening.restored.state, targets: opening.restored.targets, exercises: opening.answeredExercises, exposed: false });
    assert.equal(outcomes[0]?.outcome, 'recalled', 'a recall answered before the reload was lost');
  });

  test('a resumed warm-up sitting keeps its warm-up flag from the record, whatever the link says', () => {
    const { record } = savedMidSitting(true);
    const opening = practiceOpening({ route: { origin: 'pack', packId: 'p1', exposed: false }, record, deck, bank, packs, now: NOW });
    assert.equal(opening.kind === 'resume' ? opening.record.exposed : null, true, 'a reload turned a warm-up sitting into one that can claim recall');
  });

  test('a different sitting is started fresh, and the saved one is left alone', () => {
    const { record } = savedMidSitting(false);
    // Another conversation.
    const other = practiceOpening({ route: { origin: 'pack', packId: 'p2', exposed: false }, record, deck, bank, packs: [...packs, pack('p2', ['Bonsoir'])], now: NOW });
    assert.equal(other.kind, 'fresh');
    // The recommended card, when the saved one is a pack sitting.
    assert.equal(practiceOpening({ route: { origin: 'recommended', packId: null, exposed: false }, record, deck, bank, packs, now: NOW }).kind, 'fresh');
  });

  test('resume opens the saved sitting, and one that cannot resume is said, never replaced', () => {
    const { record } = savedMidSitting(false);
    assert.equal(practiceOpening({ route: { origin: 'resume', packId: null, exposed: false }, record, deck, bank, packs, now: NOW }).kind, 'resume');
    assert.deepEqual(practiceOpening({ route: { origin: 'resume', packId: null, exposed: false }, record: null, deck, bank, packs, now: NOW }), { kind: 'cannot-resume', sittingId: null });

    // Every exercise gone from the bank, and nothing answered: it cannot resume.
    const untouched = toSessionRecord({ ...record, targets: record.targets, state: { queue: bank, missesById: {}, answered: [], startedAt: NOW, finished: false } });
    assert.deepEqual(
      practiceOpening({ route: { origin: 'resume', packId: null, exposed: false }, record: untouched, deck, bank: [], packs, now: NOW }),
      { kind: 'cannot-resume', sittingId: record.sittingId },
    );
  });

  test('the Practice card is offered a resume only for a sitting with something in it', () => {
    const { record } = savedMidSitting(false);
    assert.deepEqual(resumableOf(record, packs, bank), { packId: 'p1', remaining: record.queue.length });
    assert.equal(resumableOf(null, packs, bank), null);
    assert.equal(resumableOf({ ...record, queue: [], answered: [] }, packs, bank), null, 'an empty record was offered as a resume');
    // Answered but nothing left: opening it finishes it, so it is still offered.
    assert.deepEqual(resumableOf({ ...record, queue: [] }, packs, bank), { packId: 'p1', remaining: 1 });
  });

  test('a deleted conversation is not brought back by resume, even though its exercises stay in the bank', () => {
    const { record } = savedMidSitting(false);
    // The pack is gone from the cache; its exercises are still in the bank,
    // which is what deletion intentionally leaves.
    const opening = practiceOpening({ route: { origin: 'resume', packId: null, exposed: false }, record, deck, bank, packs: [], now: NOW });
    assert.deepEqual(opening, { kind: 'cannot-resume', sittingId: record.sittingId }, 'a sitting about a deleted conversation was resumed');
    assert.equal(resumableOf(record, [], bank), null, 'the Practice card offered to resume a deleted conversation');
    // A same-kind link starts fresh from what is left, and that is nothing from the gone pack.
    const fresh = practiceOpening({ route: { origin: 'pack', packId: 'p1', exposed: false }, record, deck, bank, packs: [], now: NOW });
    assert.deepEqual(fresh, { kind: 'fresh', targets: [] }, 'a deleted conversation was practised again from its leftover exercises');
  });

  test('in a mixed sitting, only the deleted conversation is dropped: review targets and their answers stay, uncredited to it', () => {
    const due = enFr('Merci');
    const reviewTarget = { phraseKey: due.phraseKey, source: { kind: 'review' as const }, exerciseId: due.id, scheduled: true };
    const { record } = savedMidSitting(false);
    const mixed = { ...record, origin: 'recommended' as const, targets: [reviewTarget, ...record.targets], queue: [due.id, ...record.queue] };
    const { record: kept, removed } = withoutDeletedSources(mixed, [], [...bank, due]);
    assert.equal(removed, true);
    assert.deepEqual(kept.targets.map((t) => t.source.kind), ['review'], 'a deleted conversation kept a target, or review was dropped');
    assert.deepEqual(kept.queue, [due.id]);
    assert.deepEqual(kept.answered, [], 'an answer to a deleted conversation is still carried into completion');
    assert.equal(kept.packId, null, 'the sitting still links to a deleted conversation');
    const opening = practiceOpening({ route: { origin: 'recommended', packId: null, exposed: false }, record: mixed, deck: [...deck, card('Merci', -DAY)], bank: [...bank, due], packs: [], now: NOW });
    assert.equal(opening.kind, 'resume', 'the review part of a mixed sitting was lost with the deleted conversation');
    // Nothing is touched when every source is still here.
    assert.equal(withoutDeletedSources(record, packs, bank).removed, false);
  });

  test('help survives a reload, and a right answer after help is practised with no success grade', () => {
    // Asked for the phrase, then reloaded before answering.
    const selection = packSelection({ packId: 'p1', deck, bank, packs, now: NOW })!;
    const built = buildPracticeSession(selection.targets, bank, deck, NOW);
    const head = built.state.queue[0]!;
    const saved = toSessionRecord({
      sittingId: 'sHelped.1', startedAt: NOW, origin: 'pack', packId: 'p1', exposed: false, micSuppressed: false,
      targets: built.targets, state: built.state, assisted: [head.id],
    });
    const opening = practiceOpening({ route: { origin: 'pack', packId: 'p1', exposed: false }, record: saved, deck, bank, packs, now: NOW });
    assert.equal(opening.kind, 'resume');
    if (opening.kind !== 'resume') return;
    assert.deepEqual(opening.record.assisted, [head.id], 'the help mark was lost on reload');

    // Then answered right, first time, and the sitting finished.
    let state = opening.restored.state;
    for (const exercise of [...state.queue]) state = answerCurrent(state, exercise.kind === 'translate' ? exercise.fr : '').state;
    const outcomes = practiceOutcomes({ state, targets: opening.restored.targets, exercises: bank, exposed: false, assisted: opening.record.assisted });
    assert.equal(outcomes.find((o) => o.phraseKey === head.phraseKey)?.outcome, 'practised', 'a right answer after seeing the phrase was called recall');
    assert.ok(outcomes.some((o) => o.outcome === 'recalled'), 'the unhelped targets lost their recall, so this test proves nothing');
    // A due card helped and answered right moves no schedule.
    const dueDeck = deck.map((c) => (c.id === head.phraseKey ? { ...c, due: NOW - DAY } : c));
    const dueTargets = restorePracticeSession({ ...opening.record, targets: opening.record.targets.map((t) => (t.phraseKey === head.phraseKey ? { ...t, scheduled: true } : t)) }, bank, dueDeck, NOW)!.targets;
    const grades = practiceCardGrades(state, dueTargets, false, opening.record.assisted);
    assert.ok(!grades.some((g) => g.id === head.phraseKey && g.grade !== 'again'), 'a helped answer was graded as a spaced success');
  });
});
