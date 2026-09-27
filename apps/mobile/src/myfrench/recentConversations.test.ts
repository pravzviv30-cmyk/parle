import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, type ConversationPack } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { EVIDENCE_LINE, RECENT_LIMIT, allConversations, progressStatement, recentConversations, type HistoryItem } from './recentConversations.ts';
import { isPracticeEvent, legacyMarkItems, type PracticeEvent } from '../practice/history.ts';

const NOW = Date.UTC(2026, 8, 24, 12);
const pack = (id: string, daysAgo: number, state: ConversationPack['state'] = 'ready'): ConversationPack =>
  buildConversationPack({
    id, sessionId: id, learnerId: 'l', createdAt: new Date(NOW - daysAgo * 86_400_000).toISOString(), state,
    title: { fr: `Titre ${id}`, en: `Title ${id}` }, summary: 's',
    keyPhrases: [
      { fr: `Un ${id}`, frWritten: null, en: 'one' },
      { fr: `Deux ${id}`, frWritten: null, en: 'two' },
      { fr: `Trois ${id}`, frWritten: null, en: 'three' },
    ],
  });

/**
 * A completed sitting in the store's own shape, proven valid by the store's own
 * validator so these tests can never pass on a row the store would refuse.
 */
const sitting = (id: string, at: number, targets: { packId: string | null; outcome: 'recalled' | 'practised' | 'unresolved' }[]): PracticeEvent => {
  const event: PracticeEvent = {
    kind: 'session-completed', id, at, packId: targets.find((t) => t.packId !== null)?.packId ?? null,
    targets: targets.map((t, i) => ({
      phraseKey: `phrase:k${i}`,
      source: t.packId === null ? { kind: 'review' } : { kind: 'pack', packId: t.packId },
      outcome: t.outcome,
      attempts: t.outcome === 'unresolved' ? 2 : 1,
    })),
  };
  assert.ok(isPracticeEvent(event), `test fixture ${id} is not a valid stored event`);
  return event;
};
const legacyMarks = (packId: string, at: number, label: 'practised' | 'continued'): HistoryItem[] =>
  legacyMarkItems([{ packId, practisedAt: label === 'practised' ? at : null, continuedAt: label === 'continued' ? at : null }]);

describe('My French recent conversations, from recorded evidence only', () => {
  test('each conversation shows a small preview and its truest recorded outcome', () => {
    const recent = recentConversations({
      packs: [pack('a', 1), pack('b', 2), pack('c', 3)],
      events: [
        sitting('s1', NOW, [{ packId: 'a', outcome: 'recalled' }]),
        { kind: 'warmup-completed', id: 'w1', at: NOW, packId: 'b' },
        { kind: 'revisit-started', id: 'r1', at: NOW, packId: 'c' },
      ],
    });
    assert.deepEqual(recent.map((r) => r.line), [EVIDENCE_LINE.recalled, EVIDENCE_LINE.warmup, EVIDENCE_LINE['revisit-started']]);
    assert.deepEqual(recent[0]!.preview, ['Un a', 'Deux a'], 'the preview is not the conversation\'s own first lines');
  });

  test('each row names itself whole to a screen reader: title, French preview, then outcome — whole-app phase 2', () => {
    // Three lines on glass are three separate nodes to assistive technology
    // unless the row names them together. The French preview used to be left
    // out, so a screen reader heard the title and the outcome and none of the
    // French the row was showing.
    const [done, fresh] = recentConversations({
      packs: [pack('a', 1), pack('b', 2)],
      events: [sitting('s1', NOW, [{ packId: 'a', outcome: 'practised' }])],
    });
    assert.equal(done!.accessibilityLabel, 'Title a. Un a, Deux a. Practised these phrases.');
    assert.equal(fresh!.accessibilityLabel, 'Title b. Un b, Deux b.', 'a row with no outcome invents one, or trails a separator');
    // No preview at all: the title alone, never a dangling separator.
    const bare = buildConversationPack({
      id: 'z', sessionId: 'z', learnerId: 'l', createdAt: new Date(NOW).toISOString(),
      title: { fr: 'Z', en: 'Title z' }, summary: 's', keyPhrases: [],
    });
    assert.equal(recentConversations({ packs: [bare], events: [] })[0]!.accessibilityLabel, 'Title z.');
  });

  test('French lines that already end in punctuation are read as sentences, never ".," — whole-app phase 2', () => {
    // Browser proof caught "Je voudrais un café., Sur place, merci." on the
    // real sample conversation: each saved line ends with its own full stop or
    // question mark, and joining them with a comma doubled the punctuation.
    const spoken = buildConversationPack({
      id: 'p', sessionId: 'p', learnerId: 'l', createdAt: new Date(NOW).toISOString(),
      title: { fr: 'P', en: 'Title p' }, summary: 's',
      keyPhrases: [
        { fr: 'Je voudrais un café.', frWritten: null, en: 'I would like a coffee.' },
        { fr: 'Vous avez des croissants ?', frWritten: null, en: 'Do you have croissants?' },
      ],
    });
    const label = recentConversations({ packs: [spoken], events: [] })[0]!.accessibilityLabel;
    assert.equal(label, 'Title p. Je voudrais un café. Vous avez des croissants ?');
    assert.doesNotMatch(label, /[.!?],/, 'a sentence mark is followed by a comma');
  });

  test('the page shows at most three recent conversations, newest first', () => {
    const recent = recentConversations({ packs: [pack('a', 4), pack('b', 1), pack('c', 3), pack('d', 2)], events: [] });
    assert.deepEqual(recent.map((r) => r.pack.id), ['b', 'd', 'c'], 'the recent rows are not the newest three');
  });

  test('nothing recorded says nothing, and nothing is ever said about speaking or mastery', () => {
    const [only] = recentConversations({ packs: [pack('a', 1)], events: [] });
    assert.equal(only!.evidence, null);
    assert.equal(only!.line, null);
    for (const line of Object.values(EVIDENCE_LINE)) {
      assert.doesNotMatch(line, /speak|mastered|fluent|level|A1|A2|B1|%|\d/i, `"${line}" claims more than the history records`);
      assert.equal(guiltIn(line), undefined);
      assert.ok(!line.includes('—'));
    }
  });

  test('unrelated review in the same sitting does not count as practising the conversation', () => {
    const [a] = recentConversations({ packs: [pack('a', 1)], events: [sitting('s1', NOW, [{ packId: null, outcome: 'recalled' }])] });
    assert.equal(a!.evidence, null, 'review recall was attributed to a conversation it did not come from');
  });

  test('a room opening or a warm-up never outranks real practice, and legacy marks are never promoted', () => {
    const [a] = recentConversations({
      packs: [pack('a', 1)],
      events: [
        sitting('s1', NOW - 5000, [{ packId: 'a', outcome: 'practised' }]),
        { kind: 'revisit-started', id: 'r1', at: NOW, packId: 'a' },
        ...legacyMarks('a', NOW + 1, 'practised'),
      ],
    });
    assert.equal(a!.evidence, 'practised');

    const [legacy] = recentConversations({ packs: [pack('a', 1)], events: legacyMarks('a', NOW, 'practised') });
    assert.equal(legacy!.line, EVIDENCE_LINE['legacy-practised'], 'an old phone-only mark was read as a new outcome');
    const [continued] = recentConversations({ packs: [pack('a', 1)], events: legacyMarks('a', NOW, 'continued') });
    assert.equal(continued!.line, 'Revisit opened earlier', 'a room-open mark is described as a conversation that happened');
  });

  test('the newest practice decides the line, so an old recall never hides what happened last', () => {
    const [a] = recentConversations({
      packs: [pack('a', 1)],
      events: [
        sitting('old', NOW - 86_400_000, [{ packId: 'a', outcome: 'recalled' }]),
        sitting('new', NOW, [{ packId: 'a', outcome: 'practised' }]),
      ],
    });
    assert.equal(a!.evidence, 'practised', 'a recall from yesterday hid today\'s practice');

    // Attempted and unresolved is said as what comes next, not as a failure.
    const [missed] = recentConversations({
      packs: [pack('a', 1)],
      events: [sitting('old', NOW - 1000, [{ packId: 'a', outcome: 'recalled' }]), sitting('new', NOW, [{ packId: 'a', outcome: 'unresolved' }])],
    });
    assert.equal(missed!.line, 'Ready to revisit');
    assert.doesNotMatch(missed!.line!, /fail|wrong|miss/i);
  });

  test('a deleted or unready conversation is not resurrected by its history', () => {
    const recent = recentConversations({
      packs: [pack('kept', 1), pack('writing', 2, 'generating')],
      events: [sitting('s1', NOW, [{ packId: 'gone', outcome: 'recalled' }]), sitting('s2', NOW, [{ packId: 'writing', outcome: 'recalled' }])],
    });
    assert.deepEqual(recent.map((r) => r.pack.id), ['kept']);
  });

  test('the progress sentence comes only from completed practice, about the conversation it was from', () => {
    const packs = [pack('a', 1), pack('b', 2)];
    assert.equal(progressStatement(recentConversations({ packs, events: [{ kind: 'warmup-completed', id: 'w', at: NOW, packId: 'a' }] })), null, 'a warm-up earned a progress sentence');
    assert.equal(progressStatement(recentConversations({ packs, events: [{ kind: 'revisit-started', id: 'r', at: NOW, packId: 'a' }] })), null, 'a room opening earned a progress sentence');
    assert.equal(progressStatement(recentConversations({ packs, events: [sitting('s', NOW, [{ packId: 'a', outcome: 'unresolved' }])] })), null, 'an unresolved sitting earned a progress sentence');
    // Singular when one phrase is behind the claim.
    assert.equal(
      progressStatement(recentConversations({ packs, events: [sitting('s', NOW, [{ packId: 'b', outcome: 'practised' }])] })),
      'You practised a phrase from Title b.',
    );
    assert.equal(
      progressStatement(recentConversations({ packs, events: [sitting('s', NOW, [{ packId: 'a', outcome: 'recalled' }, { packId: 'a', outcome: 'practised' }])] })),
      'You recalled a phrase from Title a without choices.',
      'one recalled phrase was reported as several',
    );
    assert.equal(
      progressStatement(recentConversations({ packs, events: [sitting('s', NOW, [{ packId: 'a', outcome: 'recalled' }, { packId: 'a', outcome: 'recalled' }])] })),
      'You recalled phrases from Title a without choices.',
    );
    for (const s of ['You practised a phrase from X.', 'You recalled phrases from X without choices.']) {
      assert.doesNotMatch(s, /\d/);
    }
  });

  test('the progress sentence reaches past the three rows drawn — whole-app phase 2 review', () => {
    // Fable observation: practice on the fourth-newest conversation earned no
    // sentence, because the sentence only read the rows the page draws. The
    // page still draws three; the sentence reads every ready conversation.
    const packs = [pack('a', 1), pack('b', 2), pack('c', 3), pack('d', 4)];
    const events = [sitting('s', NOW, [{ packId: 'd', outcome: 'practised' }])];
    assert.equal(recentConversations({ packs, events }).length, RECENT_LIMIT, 'the page no longer caps its rows');
    assert.equal(progressStatement(recentConversations({ packs, events })), null, 'the fixture does not reproduce the three-row blind spot');
    assert.equal(progressStatement(allConversations({ packs, events })), 'You practised a phrase from Title d.');
  });
});
