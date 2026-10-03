import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retainCompletions } from './retain.ts';
test('supported replays never erase earlier earned independence, locally or after sync', () => {
  const earned = {at: 1, rung: 4};
  const rows = [earned, ...Array.from({length: 45}, (_,i) => ({at: i+2, rung: 1}))];
  const kept = retainCompletions(rows, 20);
  assert.equal(kept.length, 20); assert.ok(kept.includes(earned));
  assert.equal(kept.at(-1)?.at, 46); assert.deepEqual(retainCompletions(kept,20),kept);
  assert.equal(rows.length,46);
  const next = retainCompletions([...kept,{at:47,rung:2}],20);
  assert.ok(next.includes(earned)); assert.equal(next.at(-1)?.at,47);
});
test('retention preserves the strongest valid support rung and ignores corrupt rung claims', () => {
  const best = {at:1,rung:3};
  const rows = [best,{at:2,rung:99},...Array.from({length:25},(_,i)=>({at:i+3,rung:1}))];
  assert.ok(retainCompletions(rows,20).includes(best));
  assert.deepEqual(retainCompletions(rows,0),[]);
  assert.deepEqual(retainCompletions(rows,99),rows);
});
