import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeActiveDays } from './activeDays.ts';
test('active days survive detailed-log pruning, merge across devices and never count duplicates',()=>{
 const at=new Date(2026,8,19,12).getTime();
 assert.deepEqual(mergeActiveDays([{at,xp:5},{at,xp:10}],['2024-01-01'],['2024-01-01','bad']),['2024-01-01','2026-09-19']);
 assert.deepEqual(mergeActiveDays([],['2024-01-01']),['2024-01-01']);
 assert.deepEqual(mergeActiveDays([{at,xp:0},{at:NaN,xp:10}]),[]);
});
