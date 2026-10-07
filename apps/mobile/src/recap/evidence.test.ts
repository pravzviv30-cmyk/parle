import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { missionStates, type MissionCompletion } from '@luvani/core';
import { streakGuiltIn } from '../copy/guilt.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { firstEarnedFinish, postcardLine, postcardStamp, recapCanDo, earnedPostcards } from './evidence.ts';
const id='mission:premier-cafe';
const at=new Date(2026,9,2,12).getTime();
test('a postcard celebrates a first independent finish, never help, an unknown scene or an unread history',()=>{
 assert.equal(firstEarnedFinish(null,{id,rung:4}),null);
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

/**
 * F777. The conversation reads the learner's finish history strictly before
 * the scene is won, so the recap can say whether this is the first earn. When
 * that read failed, the history was null and the stamp said "You did it on
 * your own again.", a claim about an earlier finish nobody had seen.
 */
const read=(relative:string)=>readFileSync(fileURLToPath(new URL(relative,import.meta.url)),'utf8');

/** The body of the conversation's effect that reads the history, lifted as the screen writes it. */
function historyRead(convo:string):string{
 const call=convo.indexOf('loadMissionCompletions({ strict: true })');
 assert.notEqual(call,-1,'the conversation no longer reads the finish history strictly');
 const header='useEffect(() => {';
 const open=convo.lastIndexOf(header,call);
 assert.ok(open>=0,'the strict read is no longer inside an effect');
 let depth=0;
 for(let i=open+header.length-1;i<convo.length;i+=1){
  if(convo[i]==='{')depth+=1;
  else if(convo[i]==='}'){depth-=1;if(depth===0)return convo.slice(open+header.length,i);}
 }
 throw new Error('the effect that reads the history is never closed');
}

/** Run that body with a store answer the test chooses; it hands back the effect's cleanup. */
function runHistoryRead(body:string,load:()=>Promise<unknown>,priorCompletions:{current:readonly MissionCompletion[]|null}):()=>void{
 const wrapped=stripTypeScriptTypes(`function lifted() {${body}}`);
 const js=wrapped.slice(wrapped.indexOf('{')+1,wrapped.lastIndexOf('}'));
 const fn=new Function('loadMissionCompletions','missionCompletionsFrom','priorCompletions',`"use strict";\n${js}`) as (...args:unknown[])=>()=>void;
 return fn(load,missionCompletionsFrom,priorCompletions);
}

const settle=():Promise<void>=>new Promise(resolve=>setImmediate(resolve));

test('a postcard stamp never claims an earlier finish it could not read',async()=>{
 const own={id,rung:4};
 const helped={id,rung:2};

 // The rule: an unread history is unknown, said as null, never as "earned before".
 assert.equal(firstEarnedFinish(null,own),null,'an unread history was taken as an earlier finish, or as none');
 assert.equal(postcardStamp({independent:true,firstEarned:null}),'neutral');
 assert.equal(postcardLine('neutral'),'You did it on your own.');
 assert.doesNotMatch(postcardLine('neutral'),/again|first|before|\d|[—–·]/i,'the neutral line claims a first time or an earlier one');
 assert.equal(streakGuiltIn(postcardLine('neutral')),undefined);
 // Help is still help, whatever could or could not be read.
 assert.equal(firstEarnedFinish(null,helped),false);
 assert.equal(postcardStamp({independent:false,firstEarned:null}),null,'a finish with help was stamped because its history was unread');
 // And a history that was read still says first or again.
 assert.equal(postcardStamp({independent:true,firstEarned:firstEarnedFinish([],own)}),'first');
 assert.equal(postcardStamp({independent:true,firstEarned:firstEarnedFinish([{id,rung:4,at}],own)}),'again');

 // The conversation's read, run as it is written. A read that fails leaves
 // the history unknown, even where another account's history sat before it.
 const convo=read('../ConvoScreen.tsx');
 const body=historyRead(convo);
 const prior:{current:readonly MissionCompletion[]|null}={current:missionCompletionsFrom([{id,rung:4,at}])};
 runHistoryRead(body,()=>Promise.reject(new Error('unreadable')),prior);
 assert.equal(prior.current,null,'the last account\'s history stood in for this one\'s while it loaded');
 await settle();
 assert.equal(prior.current,null,'a history that could not be read was taken as read');
 assert.equal(postcardLine(postcardStamp({independent:true,firstEarned:firstEarnedFinish(prior.current,own)})),'You did it on your own.',
  'a finish after an unread history said it was done again');

 // A read that succeeds is used, and one that lands after the screen has gone is not.
 runHistoryRead(body,()=>Promise.resolve([{id,rung:4,at}]),prior);
 await settle();
 assert.equal(postcardStamp({independent:true,firstEarned:firstEarnedFinish(prior.current,own)}),'again','a history that was read was ignored');
 const cleanup=runHistoryRead(body,()=>Promise.resolve([]),prior);
 cleanup();
 await settle();
 assert.equal(prior.current,null,'a read that landed after the screen had gone was used');

 // The unknown reaches the stamp: the conversation keeps it as null, the
 // recap's prop carries it, and the stamp gives it the first earn's weight.
 assert.match(convo,/const \[firstEarned, setFirstEarned\] = useState<boolean \| null>\(false\);/,'the conversation can only say first or again');
 assert.match(convo,/setFirstEarned\(firstEarnedFinish\(priorCompletions\.current, step\.record\)\);/);
 assert.match(convo,/firstEarned=\{firstEarned\}/);
 assert.match(read('../RecapScreen.tsx'),/firstEarned\?: boolean \| null;/,'the recap turns an unread history into a known one');
 const stamp=read('../celebrate/PostcardStamp.tsx');
 assert.match(stamp,/kind: PostcardStampKind;/);
 assert.match(stamp,/const kind = given === 'neutral' \? 'first' : given;\s*const timeline = TIMELINES\[kind === 'first' \? 'postcard-first' : 'postcard-again'\];/,
  'a finish whose history could not be read does not stamp with the first earn\'s weight');
});
