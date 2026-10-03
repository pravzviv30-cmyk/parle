import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missionStates } from '@luvani/core';
import { firstEarnedFinish, recapCanDo, earnedPostcards } from './evidence.ts';
const id='mission:premier-cafe';
const at=new Date(2026,9,2,12).getTime();
test('a postcard celebrates a first independent finish, never help, an unknown scene or an unread history',()=>{
 assert.equal(firstEarnedFinish(null,{id,rung:4}),false);
 assert.equal(firstEarnedFinish([],{id:'unknown',rung:4}),false);
 for(const rung of [1,2,3])assert.equal(firstEarnedFinish([],{id,rung}),false);
 assert.equal(firstEarnedFinish([],{id,rung:4}),true);
 assert.equal(firstEarnedFinish([{id,rung:4,at}],{id,rung:4}),false);
 assert.equal(firstEarnedFinish([{id,rung:2,at}],{id,rung:4}),true);
});
test('recap evidence and the postcard shelf use the earned can-do rule and show no unearned collection slots',()=>{
 const helped=missionStates([{id,rung:3,at}],[],at);
 assert.equal(recapCanDo(helped,id),null); assert.equal(earnedPostcards(helped).length,0);
 const earned=missionStates([{id,rung:4,at},{id,rung:2,at:at+1}],[],at);
 assert.equal(recapCanDo(earned,id),earned.find(r=>r.mission.id===id)!.mission.earnedEn);
 assert.deepEqual(earnedPostcards(earned).map(r=>r.mission.id),[id]);
 assert.equal(recapCanDo(earned),null);
});
