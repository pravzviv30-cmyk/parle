import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, newCard, phraseKeyOf } from '@luvani/core';
import { conversationTopics, conversationsMatching, libraryPhrases, localConversationPage } from './library.ts';

function pack(id: string, fr: string, topic = 'Plans', createdAt = '2026-10-01T10:00:00Z') {
  return buildConversationPack({ id, sessionId: id, learnerId: 'learner', createdAt, state: 'ready', title: { fr: 'Une conversation', en: `Conversation ${id}` }, summary: 'Learning notes', topics: [{ en: topic, fr: topic }], keyPhrases: [{ fr, frWritten: null, en: 'a useful reply' }] });
}

describe('My French searches only real owned learning material', () => {
  test('French search is accent-insensitive and matches all query words across the page content', () => {
    const a = pack('a', 'À quinze heures, ça te va ?');
    const b = pack('b', 'Un café, s’il vous plaît.', 'Cafés');
    assert.deepEqual(conversationsMatching([a, b], 'quinze ca', null).map(item => item.id), ['a']);
    assert.deepEqual(conversationsMatching([a, b], 'cafe', null).map(item => item.id), ['b']);
    assert.deepEqual(conversationsMatching([a, b], 'no matching words', null), []);
  });
  test('topic options are earned by the current page and a missing old filter falls back to this page', () => {
    const a = pack('a', 'Oui.', 'Cafés');
    const b = pack('b', 'D’accord.', 'Cafes');
    assert.equal(conversationTopics([a, b]).length, 1);
    assert.deepEqual(conversationsMatching([a], '', 'old-topic').map(item => item.id), ['a']);
    assert.deepEqual(conversationTopics([]), []);
  });
  test('a phrase links to its newest surviving source and a deleted source cannot return through the deck', () => {
    const a = pack('a', 'Ça me va.', 'Plans', '2026-10-01T10:00:00Z');
    const b = pack('b', 'Ça me va.', 'Plans', '2026-10-02T10:00:00Z');
    const card = newCard({ id: phraseKeyOf('Ça me va.'), kind: 'turn', front: 'Ça me va.', back: 'That works for me.', context: '', ipa: '' }, 1);
    assert.equal(libraryPhrases([card], [a, b], '')[0]?.source?.id, 'b');
    assert.equal(libraryPhrases([card], [a], '')[0]?.source?.id, 'a');
    assert.equal(libraryPhrases([card], [], '')[0]?.source, null);
    assert.equal(libraryPhrases([card], [a], 'works')[0]?.card.id, card.id);
  });
  test('local accounts can reach older real conversations without pretending to have server history', () => {
    const rows = Array.from({ length: 22 }, (_, i) => pack(`pack-${i}`, 'Bonjour.'));
    const first = localConversationPage(rows, null, 20);
    const older = localConversationPage(rows, first.nextCursor, 20);
    assert.equal(first.packs.length, 20);
    assert.equal(older.packs.length, 2);
    assert.equal(new Set([...first.packs, ...older.packs].map(item => item.id)).size, 22);
    assert.equal(older.nextCursor, null);
  });
});
