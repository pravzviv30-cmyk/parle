import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, missionStates, type PracticeTopic } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { withMark } from '../conversationPacks/marks.ts';
import type { ScenarioRecord } from '../missions/progressStore.ts';
import { CAME_UP, threadFrom } from './threads.ts';

const NOW = Date.parse('2026-09-12T20:00:00.000Z');

function pack(state: 'ready' | 'generating' = 'ready') {
  return buildConversationPack({
    id: 's1', sessionId: 's1', learnerId: 'l', createdAt: new Date(NOW - 60_000).toISOString(), state,
    title: { fr: 'Le code wifi', en: 'The wifi password' }, summary: 's',
    keyPhrases: [{ fr: 'Le code wifi', frWritten: null, en: 'The wifi' }],
  });
}

const TOPIC: PracticeTopic = { id: 'topic:the-wifi-password', title: { fr: 'Le code wifi', en: 'The wifi password' }, discussed: ['2026-09-10', '2026-09-12'], phraseKeys: [] };

describe('the one thread a learner can pick up (F551)', () => {
  test('the one thread is the unfinished scene, else the newest uncontinued pack, else nothing', () => {
    const progress = missionStates([], [], NOW);
    const base = { records: [] as ScenarioRecord[], progress, packs: [] as ReturnType<typeof pack>[], marks: [] as ReturnType<typeof withMark>, topics: [] as PracticeTopic[] };

    assert.equal(threadFrom(base), null, 'a learner with nothing behind them was handed a thread');

    const talked = threadFrom({ ...base, packs: [pack()] });
    assert.ok(talked !== null && talked.kind === 'pack');
    assert.equal(talked.line, 'Keep talking about the wifi password.');
    assert.deepEqual(talked.seedTopic, { fr: 'Le code wifi', en: 'The wifi password' });

    // The subject has come up before: said in words, off the topic's own dates.
    const again = threadFrom({ ...base, packs: [pack()], topics: [TOPIC] });
    assert.equal(again!.line, `Keep talking about the wifi password. ${CAME_UP.once}`);
    const often = threadFrom({ ...base, packs: [pack()], topics: [{ ...TOPIC, discussed: ['a', 'b', 'c'] }] });
    assert.equal(often!.line, `Keep talking about the wifi password. ${CAME_UP.more}`);

    // A pack still being written, or one already kept going on this phone, is no thread.
    assert.equal(threadFrom({ ...base, packs: [pack('generating')] }), null);
    assert.equal(threadFrom({ ...base, packs: [pack()], marks: withMark([], 's1', 'continuedAt', NOW) }), null);

    // A scene walked out of outranks the pack.
    const record: ScenarioRecord = { missionId: 'mission:hotel', at: NOW - 30_000, elapsedMs: 90_000, beatsDone: 1 };
    const left = threadFrom({ ...base, packs: [pack()], records: [record] });
    assert.ok(left !== null && left.kind === 'scene' && left.missionId === 'mission:hotel');

    for (const line of [talked.line, often!.line, left.line, CAME_UP.once, CAME_UP.more]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d/);
    }
  });
});
