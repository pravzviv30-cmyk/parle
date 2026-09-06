import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, newCard, phraseKeyOf, type ConversationPack, type ReviewCard } from '@luvani/core';

import {
  archiveFrom,
  sessionsUnder,
  ARCHIVE_LABEL,
  CLOSING,
  FEED,
  FILTERS_EARN_THEIR_PLACE,
  OPENING,
  VAULT,
} from './archive.ts';
import { guiltIn } from '../copy/guilt.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 8, 2, 12, 0, 0).getTime();

function pack(id: string, daysAgo: number, over: Partial<Parameters<typeof buildConversationPack>[0]> = {}): ConversationPack {
  return buildConversationPack({
    id,
    sessionId: id,
    learnerId: 'learner-1',
    createdAt: new Date(NOW - daysAgo * DAY).toISOString(),
    state: 'ready',
    title: { fr: `Titre ${id}`, en: `Title ${id}` },
    summary: 'A short conversation.',
    keyPhrases: [{ fr: `ligne ${id}`, frWritten: null, en: `line ${id}` }],
    ...over,
  });
}

/** A deck card carrying evidence that the learner said it in conversation. */
function retained(fr: string): ReviewCard {
  const base = newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - DAY);
  return { ...base, evidence: { retrievals: 0, convoUses: 1, transfers: 0 } } as ReviewCard;
}

/** Six conversations, spread so some are inside the recent window and some are not. */
function six(): ConversationPack[] {
  return [
    pack('a', 1),
    pack('b', 3),
    pack('c', 5),
    pack('d', 12),
    pack('e', 20),
    pack('f', 40),
  ];
}

describe('the Practice archive grows with the learner, and draws no noughts on the way', () => {
  test('day one is quiet: no vault, no feed, no filters, and words instead', () => {
    // The founder was asked directly whether Practice should show its frame
    // from day one the way Home now does, and chose the quieter answer. This is
    // that answer, and the reason it is a test rather than a comment.
    const archive = archiveFrom({ packs: [], deck: [], now: NOW });

    assert.equal(archive.vault, null, 'a learner with no conversations was shown a summary of them');
    assert.deepEqual(archive.sessions, []);
    assert.deepEqual(archive.filters, [], 'four controls were drawn over nothing to control');
    assert.equal(archive.order, null, 'an empty feed announced its ordering');
    assert.deepEqual(archive.opening, { ...OPENING });
  });

  test('the first conversation brings the vault and the feed, and nothing else', () => {
    const archive = archiveFrom({ packs: [pack('a', 1)], deck: [], now: NOW });

    assert.equal(archive.opening, null, 'the invitation stayed up after it was accepted');
    assert.equal(archive.sessions.length, 1);
    assert.deepEqual(archive.filters, [], 'a filter row appeared over one card');
    assert.equal(archive.order, null, 'one card in one order was called an ordering');
    // One count, because one is all there is anything true to say about yet.
    assert.deepEqual(archive.vault?.stats, [{ value: '1', label: VAULT.recorded }]);
  });

  test('the ordering line arrives with the second card, which is when it means anything', () => {
    const one = archiveFrom({ packs: [pack('a', 1)], deck: [], now: NOW });
    const two = archiveFrom({ packs: [pack('a', 1), pack('b', 3)], deck: [], now: NOW });

    assert.equal(one.order, null);
    assert.equal(two.order, FEED.order);
  });

  test('a count with nothing behind it is left out of the rail rather than drawn as nought', () => {
    // Topics and retained phrases both start empty and fill later. Neither may
    // ever appear as a 0 beside a word, which is the whole rule this screen
    // inherits from the momentum block.
    const bare = archiveFrom({ packs: [pack('a', 1)], deck: [], now: NOW });
    assert.deepEqual(bare.vault?.stats.map((s) => s.label), [VAULT.recorded]);

    const full = archiveFrom({
      packs: [pack('a', 1, { topics: [{ fr: 'Le café', en: 'Ordering drinks' }] })],
      deck: [retained('un café')],
      now: NOW,
    });
    assert.deepEqual(full.vault?.stats, [
      { value: '1', label: VAULT.recorded },
      { value: '1', label: VAULT.topics },
      { value: '1', label: VAULT.retained },
    ]);
  });

  test('the same topic in two conversations is one topic active, not two', () => {
    const archive = archiveFrom({
      packs: [
        pack('a', 1, { topics: [{ fr: 'Le café', en: 'Ordering drinks' }] }),
        pack('b', 3, { topics: [{ fr: 'Le café', en: 'ordering drinks' }, { fr: 'Le train', en: 'Buying a ticket' }] }),
      ],
      deck: [],
      now: NOW,
    });

    assert.equal(archive.vault?.stats.find((s) => s.label === VAULT.topics)?.value, '2');
  });

  test('the filter row waits until there are enough cards for it to do any work', () => {
    const below = archiveFrom({ packs: six().slice(0, FILTERS_EARN_THEIR_PLACE - 1), deck: [], now: NOW });
    const at = archiveFrom({ packs: six().slice(0, FILTERS_EARN_THEIR_PLACE), deck: [], now: NOW });

    assert.deepEqual(below.filters, []);
    assert.ok(at.filters.length > 0, 'the row still had not arrived at the count the mockup draws it over');
    assert.equal(at.filters[0]?.key, 'all');
  });

  test('a filter that would select everything, or nothing, is not drawn', () => {
    // A control that changes nothing when tapped is furniture. Recent earns its
    // place only while it is a genuine subset of the feed.
    const allRecent = archiveFrom({ packs: [pack('a', 1), pack('b', 2), pack('c', 3), pack('d', 4)], deck: [], now: NOW });
    assert.ok(allRecent.filters.every((f) => f.key !== 'recent'), 'Recent was offered over a feed that is entirely recent');

    const mixed = archiveFrom({ packs: six(), deck: [], now: NOW });
    assert.deepEqual(mixed.filters.find((f) => f.key === 'recent')?.label, 'Recent (3)');
  });

  test('Needs a look is offered only when something actually needs one', () => {
    const quiet = archiveFrom({ packs: six(), deck: [], now: NOW });
    assert.ok(quiet.filters.every((f) => f.key !== 'attention'));

    const withSound = six();
    withSound[0] = pack('a', 1, { pronunciationFocus: 'r' });
    const noisy = archiveFrom({ packs: withSound, deck: [], now: NOW });
    assert.ok(noisy.filters.some((f) => f.key === 'attention'));
  });

  test('a filter narrows the feed, and Ideas steps the feed aside entirely', () => {
    // Ideas selects no sessions on purpose. That is what it does in the
    // founder's mockup: the scenario card is what is left on screen.
    const archive = archiveFrom({ packs: six(), deck: [], now: NOW });

    assert.equal(sessionsUnder(archive, 'all').length, 6);
    assert.equal(sessionsUnder(archive, 'recent').length, 3);
    assert.deepEqual(sessionsUnder(archive, 'ideas'), []);
  });

  test('a filter that has stopped earning its place shows the whole feed rather than an empty one', () => {
    // A learner who chose Recent last week must not open the tab onto a feed
    // that looks like their conversations were thrown away.
    const one = archiveFrom({ packs: [pack('a', 1)], deck: [], now: NOW });
    assert.equal(sessionsUnder(one, 'recent').length, 1);
  });

  test('every word this block says is warm, plain, and free of numbers it has not earned', () => {
    const lines = [
      ARCHIVE_LABEL, VAULT.title, VAULT.blurb, VAULT.recorded, VAULT.topics, VAULT.retained,
      FEED.label, FEED.order, OPENING.title, OPENING.body, CLOSING.title, CLOSING.body,
    ];
    for (const line of lines) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a word this app does not say to a learner`);
      assert.ok(!line.includes('—'), `"${line}" has an em dash in copy a learner reads`);
      assert.ok(!/\d/.test(line), `"${line}" has a number baked into a fixed line`);
    }
  });
});
