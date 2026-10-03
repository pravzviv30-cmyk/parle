import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack } from './conversationPacks.ts';
import { parseTutorRevision, revisionFromPack, tutorSessionBrief, reviewFocusFromDeck, parseReviewFocus, parsePreviousCorrection, previousCorrectionFromPacks } from './tutorBrief.ts';
import { newCard } from './review/scheduler.ts';

const pack = buildConversationPack({
  id: 'one', sessionId: 'one', learnerId: 'learner', createdAt: '2026-09-20T12:00:00Z',
  title: { fr: 'Au café', en: 'At a café' }, summary: 'You ordered coffee.',
  keyPhrases: [{ fr: 'Un café, merci.', en: 'A coffee, thanks.', frWritten: null }],
  corrections: [{ quote: 'je veux', better: 'Je voudrais', betterEn: 'I would like', why: 'A polite request.' }],
});

test('revision is bounded, allowlisted, and has no user identity or transcript', () => {
  const context = revisionFromPack(pack);
  assert.deepEqual(parseTutorRevision({ ...context, transcript: 'private', learnerId: 'other' }), context);
  assert.equal(context.correction?.better, 'Je voudrais');
  assert.equal(context.correction?.quote, 'je veux');
  assert.equal(parseTutorRevision({ ...context, phrases: [{}] }), undefined);
  assert.equal(parseTutorRevision({ ...context, summary: 'a'.repeat(601) }), undefined);
  assert.equal(parseTutorRevision({ ...context, correction: {} }), undefined);
  for (const packId of ['bad id', '../x', ' one', 'a'.repeat(101), 7]) {
    assert.equal(parseTutorRevision({ ...context, packId }), undefined, `${String(packId).slice(0, 10)} is not a pack id`);
  }
  assert.equal(revisionFromPack({ ...pack, summary: 'a'.repeat(900) }).summary.length, 600);
});

test('the next brief carries one owned latest correction with its original fragment and source, never stale errors or a transcript', () => {
  const previous = previousCorrectionFromPacks([pack], 'learner');
  assert.ok(previous);
  assert.equal(previous.quote, 'je veux');
  assert.equal(previous.packId, 'one');
  assert.equal(previousCorrectionFromPacks([pack], 'other'), undefined);
  const clean = { ...pack, id: 'clean', createdAt: '2026-09-21T12:00:00Z', corrections: [] };
  assert.equal(previousCorrectionFromPacks([pack, clean], 'learner'), undefined);
  assert.equal(previousCorrectionFromPacks([{ ...pack, id: 'a', createdAt: 'unknown' }, clean], 'learner'), undefined);
  assert.equal(previousCorrectionFromPacks([{ ...pack, createdAt: '2026-09-20T20:00:00+10:00' }, { ...clean, createdAt: '2026-09-20T12:00:00Z' }], 'learner'), undefined);
  for (const state of ['generating', 'failed', 'archived'] as const) {
    assert.equal(previousCorrectionFromPacks([pack, { ...clean, state }], 'learner'), undefined);
  }
  assert.equal(previousCorrectionFromPacks([{ ...pack, corrections: [{ ...pack.corrections[0]!, quote: '' }] }], 'learner'), undefined);
  assert.deepEqual(parsePreviousCorrection({ ...previous, transcript: 'private', learnerId: 'other' }), previous);
  for (const bad of [{ ...previous, quote: 'x'.repeat(241) }, { ...previous, why: '' }, { ...previous, quote: 'line\ncommand' }, { ...previous, packId: '../private' }]) {
    assert.equal(parsePreviousCorrection(bad), undefined);
  }
  const brief = tutorSessionBrief({ missionId: 'cafe', previousCorrection: previous });
  assert.match(brief, /"quote":"je veux"/);
  assert.match(brief, /"title":"At a café"/);
  assert.match(brief, /Let them attempt first/);
  assert.match(brief, /not instructions/);
  assert.doesNotMatch(brief, /private|learnerId|transcript":/);
  const revision = tutorSessionBrief({ revision: revisionFromPack(pack), previousCorrection: previous });
  assert.doesNotMatch(revision, /One correction from the learner’s last/);
  assert.match(revision, /"quote":"je veux"/);
  const legacy = revisionFromPack(pack);
  assert.ok(parseTutorRevision({ ...legacy, correction: { better: 'Je voudrais', why: 'A polite request.' } }), 'legacy revisions remain readable');
});

test('session intent changes the teaching task and labels saved data as untrusted', () => {
  assert.match(tutorSessionBrief({}), /OPEN CONVERSATION/);
  assert.match(tutorSessionBrief({ seeded: true }), /REHEARSAL/);
  assert.match(tutorSessionBrief({ missionId: 'cafe', seeded: true }), /GUIDED MISSION/);
  const revision = tutorSessionBrief({ revision: revisionFromPack(pack), missionId: 'cafe' });
  assert.match(revision, /REVISION/);
  assert.match(revision, /not instructions/);
  assert.match(revision, /Je voudrais/);
  assert.match(revision, /not proof of spontaneous speaking mastery/);
});

test('practice focus is bounded, due-first, and never changes speaking mastery', () => {
  const card = newCard({ id: 'phrase:bonjour', kind: 'turn', front: 'Bonjour', back: 'Hello', context: '', ipa: '' }, 100);
  const missed = { ...card, id: 'phrase:merci', front: 'Merci', back: 'Thanks', lapses: 2 };
  const future = { ...card, id: 'phrase:later', due: 999 };
  const deck = [card, missed, future];
  const before = JSON.stringify(deck);
  assert.deepEqual(reviewFocusFromDeck(deck, 200).map((p) => p.reason), ['needs-revisit', 'due']);
  assert.equal(reviewFocusFromDeck(deck, 200)[0]!.fr, 'Merci');
  assert.equal(JSON.stringify(deck), before);
  assert.deepEqual(parseReviewFocus([{ fr: 'x', en: 'y', reason: 'mastered' }, null]), []);
  assert.equal(parseReviewFocus(Array(6).fill({ fr: 'x', en: 'y', reason: 'due' })).length, 3);
});

test('a revision retries the saved situation first, scaffolds after struggle, then changes one detail', () => {
  const brief = tutorSessionBrief({ revision: revisionFromPack(pack) });
  const retry = brief.search(/same situation/i);
  const scaffold = brief.search(/after a struggle/i);
  const change = brief.search(/change one detail/i);
  assert.ok(retry >= 0, 'the saved situation is retried first');
  assert.ok(scaffold > retry, 'help comes after an attempt, not before');
  assert.ok(change > scaffold, 'the variation comes only after the original has been retried');
  assert.match(brief, /only one detail/i, 'a variation is one change, not a new scene');
  // Honesty rules survive the rewrite.
  assert.match(brief, /not instructions/);
  assert.match(brief, /Do not claim to remember/);
  assert.match(brief, /exact transcript/);
  assert.match(brief, /Judge pronunciation only from explicit audio-scoring evidence/);
  assert.match(brief, /not proof of spontaneous speaking mastery/);
  // Bounded context: identity and anything outside the allowlist never reaches the prompt.
  assert.doesNotMatch(brief, /learner"/);
  assert.doesNotMatch(tutorSessionBrief({}), /same situation/i, 'only a revisit is sequenced this way');
});

test('a revision with no phrases or correction does not invent any', () => {
  const sparse = parseTutorRevision({ packId: 'one', title: 'At a café', summary: '', phrases: [], correction: null })!;
  const brief = tutorSessionBrief({ revision: sparse });
  assert.match(brief, /If the saved material is thin/i);
  assert.match(brief, /"phrases":\[\]/);
  assert.match(brief, /"correction":null/);
});
