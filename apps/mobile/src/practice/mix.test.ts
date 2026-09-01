import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  mixQueue,
  newCard,
  phraseKeyOf,
  type FillBlankExercise,
  type PracticeTopic,
  type ReviewCard,
} from '@luvani/core';

import { MIX_OFFER, offersMix, sittingTitle, topicGroups } from './mix.ts';
import { guiltIn } from '../copy/guilt.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function due(fr: string): ReviewCard {
  const card = newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - DAY);
  return { ...card, due: NOW - DAY };
}

function later(fr: string): ReviewCard {
  const card = newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW);
  return { ...card, due: NOW + DAY };
}

function topic(id: string, en: string, phrases: readonly string[]): PracticeTopic {
  return {
    id,
    title: { fr: en, en },
    discussed: ['2026-08-19'],
    phraseKeys: phrases.map(phraseKeyOf),
  };
}

const CAFE = topic('topic:the-cafe', 'The cafe', ['Un café', 'Une eau']);
const JOB = topic('topic:my-job', 'My job', ['Je travaille ici', 'Mon bureau']);

describe('Today\'s mix — when a sitting across topics is worth offering', () => {
  test("today's mix is offered only when due phrases span more than one topic", () => {
    // One topic's due phrases ARE that topic's own sitting, so a mix over them
    // is the same screen under a different name. Two topics is the first point
    // at which the round robin has anything to alternate between.
    assert.equal(
      offersMix([due('Un café'), due('Une eau')], [CAFE, JOB], NOW),
      false,
      'one topic due means the mix would replay that topic and call it variety',
    );
    assert.equal(
      offersMix([due('Un café'), due('Je travaille ici')], [CAFE, JOB], NOW),
      true,
      'two topics due is exactly what the mix exists to interleave',
    );
  });

  test('a phrase that is not due yet does not put its topic in the mix', () => {
    assert.equal(
      offersMix([due('Un café'), later('Je travaille ici')], [CAFE, JOB], NOW),
      false,
      'a card the scheduler is holding back cannot be counted as spanning a topic',
    );
  });

  test('an empty deck, or no topics at all, offers nothing', () => {
    assert.equal(offersMix([], [CAFE, JOB], NOW), false, 'nothing due is nothing to mix');
    assert.equal(offersMix([due('Un café'), due('Je travaille ici')], [], NOW), false, 'no topics is no lanes');
  });

  test('the groups handed to the round robin are the topics, in order, with nothing invented', () => {
    assert.deepEqual(topicGroups([CAFE, JOB]), [CAFE.phraseKeys, JOB.phraseKeys]);
    // A topic whose phrases have not been written yet would be an empty lane
    // the round robin has to skip on every pass; it is left out instead.
    assert.deepEqual(topicGroups([topic('topic:empty', 'Empty', []), JOB]), [JOB.phraseKeys]);
  });

  test('the lanes this builds are the lanes the round robin actually alternates', () => {
    // The seam between this module and core's mixQueue, pinned end to end: the
    // sitting the tab opens comes back moving between topics rather than
    // playing one conversation's worth and then the next, which is the only
    // reason the card exists. A group shape core cannot read would be silent
    // otherwise, since mixQueue answers an unrecognised phrase by leaving it be.
    const ex = (id: string, fr: string): FillBlankExercise => ({
      kind: 'fill-blank',
      id,
      phraseKey: phraseKeyOf(fr),
      difficulty: 'recognition',
      sentence: '___ !',
      options: ['bonjour', 'bonsoir'],
      accepted: ['bonjour'],
      en: 'Hello!',
    });
    const blocked = [
      ex('c1', 'Un café'),
      ex('c2', 'Une eau'),
      ex('j1', 'Je travaille ici'),
      ex('j2', 'Mon bureau'),
    ];
    assert.deepEqual(
      mixQueue(blocked, topicGroups([CAFE, JOB])).map((e) => e.id),
      ['c1', 'j1', 'c2', 'j2'],
      'a sitting that opens with both of one topic has not mixed anything',
    );
  });

  test('a learner always knows which sitting they opened', () => {
    assert.equal(sittingTitle({ mix: true }), MIX_OFFER.title);
    assert.equal(sittingTitle(), 'Drills', 'the ordinary sitting keeps the name it has always had');
  });

  test('the offer is warm, forward, and free of numbers', () => {
    for (const line of Object.values(MIX_OFFER)) {
      assert.ok(!/\d/.test(line), `"${line}" carries a number`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      // Was four words behind a word boundary. It is now the shared union of
      // everything any surface ever banned, matched as a substring (F216), so
      // this offer is held to Home's rule as well as its own.
      const guilt = guiltIn(line);
      assert.equal(guilt, undefined, `"${line}" leans on guilt with "${guilt}"`);
    }
  });
});
