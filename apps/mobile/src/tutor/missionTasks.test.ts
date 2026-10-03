import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMission } from '@luvani/core';
import { visibleMissionTasks } from './missionTasks.ts';
import { NO_WIN, winAfterTurn } from './missionWin.ts';

const valid = () => ({ missionId: 'mission:premier-cafe', items: getMission('mission:premier-cafe')!.beatIds.map(id => ({ id, goalEn: `Practise ${id}`, achieved: true })) });
test('task-aware wins gate the card and durable completion together and do not mark an unfinished session seen', () => {
  for (const missionTasks of [null, { ...valid(), items: [] }, { ...valid(), items: valid().items.slice(1) },
    { ...valid(), items: valid().items.map((item, index) => ({ ...item, achieved: index !== 1 })) },
    { ...valid(), items: [valid().items[0]!, valid().items[0]!, valid().items[2]!] },
  ]) {
    assert.deepEqual(winAfterTurn(NO_WIN, { missionDone: true, rung: 2, missionTasks }, 'mission:premier-cafe'), { state: NO_WIN, record: null });
  }
  const earned = winAfterTurn(NO_WIN, { missionDone: true, rung: 2, missionTasks: valid() }, 'mission:premier-cafe');
  assert.equal(earned.state.showing, true); assert.deepEqual(earned.record, { id: 'mission:premier-cafe', rung: 2 });
  assert.equal(winAfterTurn(earned.state, { missionDone: true, rung: 2, missionTasks: valid() }, 'mission:premier-cafe').record, null);
  assert.equal(winAfterTurn(NO_WIN, { missionDone: true, rung: 2 }, 'mission:premier-cafe').state.showing, true, 'truly old worker behavior retained');
  assert.equal(winAfterTurn(NO_WIN, { missionDone: true, rung: 2, missionTasks: valid() }, 'mission:cafe').record, null);
});

test('visible task projection is authored whole-list only and does not fabricate old-worker or wrong-mission ticks', () => {
  assert.deepEqual(visibleMissionTasks({ missionTasks: valid() }, 'mission:premier-cafe'), valid().items);
  assert.deepEqual(visibleMissionTasks({}, 'mission:premier-cafe'), []);
  assert.deepEqual(visibleMissionTasks({ missionTasks: valid() }, 'mission:cafe'), []);
  assert.deepEqual(visibleMissionTasks({ missionTasks: valid() }, null), []);
});
