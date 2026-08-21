import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { PathNode, PracticeTopic } from '@parle/core';

import { TALK_AGAIN, offersTalkAgain, seedTopicFor, talkAgainLabel } from './talkAgain.ts';

const node = (over: Partial<PathNode> = {}): PathNode => ({
  id: 'topic:my-job',
  title: 'My job',
  sub: 'Talked about once',
  kind: 'topic',
  phraseKeys: [],
  state: 'available',
  isNext: false,
  ...over,
});

const topic = (over: Partial<PracticeTopic> = {}): PracticeTopic => ({
  id: 'topic:my-job',
  title: { fr: 'Mon travail', en: 'My job' },
  discussed: ['2026-08-19'],
  phraseKeys: ['phrase:je travaille ici'],
  ...over,
});

describe('Talk about it again — a topic card that leads back to the tutor', () => {
  test('the talk again offer says it will use minutes before anything starts', () => {
    // Before, not after: a learner finding out that a tap spent their talking
    // minutes only once the room is open has been charged for a surprise.
    assert.match(TALK_AGAIN.cost, /minutes/, 'the label must name what it spends');
    assert.match(TALK_AGAIN.cost, /live conversation/, 'and what it starts');
    assert.ok(!/\d/.test(TALK_AGAIN.cost), 'a number here would be invented: the app cannot see the balance');
    assert.match(talkAgainLabel('My job'), /minutes/, 'a learner using a screen reader hears the cost too');
    assert.match(talkAgainLabel('My job'), /My job/, 'and which topic they are opening');
  });

  test('a topic still being written offers nothing to talk about yet', () => {
    assert.equal(offersTalkAgain(node({ state: 'locked' })), false, 'a locked row is not a door');
    assert.equal(offersTalkAgain(node({ state: 'available' })), true);
    assert.equal(offersTalkAgain(node({ state: 'complete' })), true, 'a learned topic is still worth another go');
  });

  test("only the learner's own topics offer another conversation", () => {
    // The guided lesson and the authored units are not conversations the tutor
    // can be asked to resume, so the affordance would be a promise nothing keeps.
    assert.equal(offersTalkAgain(node({ kind: 'lesson' })), false);
    assert.equal(offersTalkAgain(node({ kind: 'mine' })), false);
    assert.equal(offersTalkAgain(node({ kind: 'phrases' })), false);
  });

  test('a half-written title is never sent as a hint', () => {
    // The server drops a malformed seed and starts a generic session rather
    // than refusing, but sending an empty string is still asking for nothing.
    assert.deepEqual(seedTopicFor('topic:my-job', [topic()]), { fr: 'Mon travail', en: 'My job' });
    assert.equal(seedTopicFor('topic:my-job', [topic({ title: { fr: '  ', en: 'My job' } })]), null);
    assert.equal(seedTopicFor('topic:my-job', [topic({ title: { fr: 'Mon travail', en: '' } })]), null);
    assert.equal(seedTopicFor('topic:nowhere', [topic()]), null, 'a row with no stored topic behind it seeds nothing');
  });

  test('the offer stays plain, and never counts anything', () => {
    for (const line of Object.values(TALK_AGAIN)) {
      assert.ok(!/\d/.test(line), `"${line}" carries a number`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
    }
  });
});
