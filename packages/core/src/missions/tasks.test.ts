import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMission } from './missions.ts';
import { readMissionTasks } from './tasks.ts';
import { decodeServerMessage, encodeMessage } from '../protocol/protocol.ts';
const valid = () => ({ missionId: 'mission:premier-cafe', items: getMission('mission:premier-cafe')!.beatIds.map(id => ({ id, goalEn: `Practise ${id}`, achieved: false })) });

test('task lists validate the whole authored catalogue and active mission rather than an arbitrary passed subset', () => {
  assert.deepEqual(readMissionTasks(valid(), 'mission:premier-cafe'), valid());
  assert.equal(readMissionTasks(valid(), 'mission:cafe'), null);
  for (const malformed of [null, {}, { ...valid(), items: [] }, { ...valid(), items: valid().items.slice(1) },
    { ...valid(), items: [valid().items[0], valid().items[0], valid().items[2]] },
    { ...valid(), items: valid().items.toReversed() },
    { ...valid(), items: valid().items.map(item => ({ ...item, achieved: 'true' })) },
    { ...valid(), items: valid().items.map(item => ({ ...item, goalEn: 'x'.repeat(201) })) },
  ]) assert.equal(readMissionTasks(malformed), null);
});

test('protocol preserves absence for old workers and repairs present invalid task data to a blocking null', () => {
  const frame = { t: 'convo', view: { missionDone: true } };
  const old = decodeServerMessage(encodeMessage(frame as never));
  assert.equal(old?.t, 'convo'); if (old?.t !== 'convo') return;
  assert.equal(Object.hasOwn(old.view, 'missionTasks'), false);
  for (const missionTasks of [valid(), [], null, { ...valid(), items: [] }]) {
    const decoded = decodeServerMessage(encodeMessage({ ...frame, view: { ...frame.view, missionTasks } } as never));
    assert.equal(decoded?.t, 'convo'); if (decoded?.t !== 'convo') continue;
    assert.equal(Object.hasOwn(decoded.view, 'missionTasks'), true);
    assert.deepEqual(decoded.view.missionTasks, missionTasks === null || Array.isArray(missionTasks) || missionTasks.items.length === 0 ? null : valid());
  }
});
