import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAILY_SCENARIOS, seedTopicOf } from '@luvani/core';
import { progressRows } from './progressRows.ts';

test('Progress counts kept material and leaves empty shelves absent', () => {
  assert.deepEqual(progressRows({ phrases: 0, sounds: false, conversations: 0, goals: [], saved: [] }), []);
  const rows = progressRows({ phrases: 1, sounds: true, conversations: 3, goals: [], saved: [] });
  assert.deepEqual(rows.map((row) => row.kind), ['phrases', 'sounds', 'conversations']);
  assert.equal(rows[0]?.detail, '1 phrase kept');
  assert.equal(rows[2]?.detail, '3 conversations kept');
  assert.doesNotMatch(JSON.stringify(rows), /streak|days|mastered|score|points/i);
});

test('Progress keeps each goal and saved scene attached to its own destination', () => {
  const scene = DAILY_SCENARIOS[0]!;
  const rows = progressRows({ phrases: 0, sounds: false, conversations: 0, goals: [{ goal: 'Order lunch', line: 'Try the café' }], saved: [{ scenario: scene }] });
  assert.deepEqual(rows[0], { id: 'goal:Order lunch', kind: 'goal', title: 'Order lunch', detail: 'Try the café' });
  assert.equal(rows[1]?.title, scene.titleFr);
  assert.deepEqual(rows[1]?.seedTopic, seedTopicOf(scene));
});
