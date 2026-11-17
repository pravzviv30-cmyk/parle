import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transcriptTail,replyAnnouncement,readsAsFrench} from './transcriptTail.ts';
import type {TurnLine} from '../live/turns.ts';
const turn=(id:string,who:TurnLine['who'],recasts?:TurnLine['recasts']):TurnLine=>({id,who,fr:'Bonjour.',en:'Hello.',frWritten:null,recasts});
test('transcript tail finds separate latest replay and correction rows without mutating history',()=>{
 const old=turn('old','tutor');const tutor=turn('latest','tutor');const correction=turn('correction','learner',[{quote:'je veut',better:'je veux',betterEn:'I want',why:'verb'}]);
 const rows=Object.freeze([old,tutor,correction,turn('narration','narration'),turn('learner','learner')]);
 const tail=transcriptTail(rows);assert.equal(tail.tutor,tutor);assert.equal(tail.correctionId,'correction');assert.equal(rows[0],old);assert.equal(rows[rows.length-1]?.id,'learner');
 assert.deepEqual(transcriptTail([]),{tutor:null,correctionId:null});assert.deepEqual(transcriptTail([turn('only','learner')]),{tutor:null,correctionId:null});
});
test('the typed reply announcement contains one tutor line and its gloss',()=>{
 assert.equal(replyAnnouncement(turn('latest','tutor'),'Marie'),'Marie: Bonjour.\nHello.');
 assert.equal(replyAnnouncement({...turn('latest','tutor'),en:null},'Tutor'),'Tutor: Bonjour.');
});
test('the spoken coach line is read as English, other tutor lines as French', async () => {
 // F988: on an English reach the coach line is spoken in English, so a screen
 // reader must not read it with a French voice.
 const {sceneTurns}=await import('../live/roleLine.ts');
 const {readFileSync}=await import('node:fs');
 const view={textTurnId:'c1',narration:null,coachLine:'You can say: un café.',coachSpoken:true,sceneReply:{speaker:'Karim',fr:'Et avec ceci ?',frWritten:null,en:'Anything else?'}} as never;
 const [coach,reply]=sceneTurns(view,null).map(t=>({...t.line,id:t.id!}));
 assert.equal(readsAsFrench(coach!),false);
 assert.equal(readsAsFrench(reply!),true);
 assert.equal(readsAsFrench(turn('learner','learner')),true);
 assert.equal(readsAsFrench(turn('tutor:coach','tutor')),true,'only the coach id prefix is English');
 const source=readFileSync(new URL('./Transcript.tsx',import.meta.url),'utf8');
 assert.match(source,/<Text \{\.\.\.\(readsAsFrench\(turn\) \? frenchText : \{\}\)\} accessibilityLiveRegion/,'the bubble text is tagged French whatever it says');
});
