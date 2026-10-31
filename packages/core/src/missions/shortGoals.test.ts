import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MISSIONS, getMission } from './missions.ts';
import { SHORT_GOALS, shortGoalLabel } from './shortGoals.ts';
import { readMissionTasks } from './tasks.ts';

const ID = 'mission:premier-cafe';
const valid = () => ({ missionId: ID, items: getMission(ID)!.beatIds.map(id => ({ id, goalEn: `Practise ${id}`, achieved: false })) });

test('with no approved label the lookup is null and the task list carries no short label', () => {
  assert.equal(shortGoalLabel(ID, 'no-such-beat'), null);
  assert.equal(shortGoalLabel(ID, getMission(ID)!.beatIds[0]!, {}), null);
  const read = readMissionTasks(valid(), ID, {})!;
  for (const item of read.items) assert.equal('goalShortEn' in item, false);
});

test('an approved label flows through to its beat only', () => {
  const [first, second] = getMission(ID)!.beatIds;
  const table = { [`${ID}:${first}`]: 'Order a coffee' };
  assert.equal(shortGoalLabel(ID, first!, table), 'Order a coffee');
  const read = readMissionTasks(valid(), ID, table)!;
  assert.equal(read.items[0]!.goalShortEn, 'Order a coffee');
  assert.equal(read.items[0]!.goalEn, `Practise ${first}`);
  assert.equal(read.items.find(item => item.id === second)!.goalShortEn, undefined);
});

test('every short label names a real beat and reads as a short, plain label', () => {
  const ids = new Set(MISSIONS.map(mission => mission.id));
  for (const [key, label] of Object.entries(SHORT_GOALS)) {
    const at = key.lastIndexOf(':');
    const missionId = key.slice(0, at);
    const beatId = key.slice(at + 1);
    assert.ok(ids.has(missionId as never), `${key}: no such mission`);
    assert.ok(getMission(missionId)!.beatIds.includes(beatId), `${key}: no such beat`);
    assert.ok(label.trim().length > 0, `${key}: empty`);
    assert.ok(label.length <= 24, `${key}: longer than 24 characters`);
    assert.doesNotMatch(label, /[–—]/u, `${key}: dash`);
    assert.doesNotMatch(label, /\.$/u, `${key}: trailing full stop`);
  }
});

test('every beat of every mission has an approved label, and the table holds nothing else', () => {
  let beats = 0;
  for (const mission of MISSIONS) {
    for (const beatId of mission.beatIds) {
      beats += 1;
      assert.notEqual(shortGoalLabel(mission.id, beatId), null, `${mission.id}:${beatId}: no approved short label`);
    }
  }
  assert.ok(beats > 0);
  assert.equal(Object.keys(SHORT_GOALS).length, beats, 'the table has an entry that is not a beat, or a beat is missing');
});
