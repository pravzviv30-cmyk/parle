import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transcriptTail,replyAnnouncement,readsAsFrench,nextReplyAnnouncement} from './transcriptTail.ts';
import {readFileSync as readSource} from 'node:fs';
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
test('an early tutor line is announced with its English once the English arrives, and only once',()=>{
 // F988: the early tutor-line carries no English; the view fills it under the same id.
 const early={...turn('t1','tutor'),en:null};
 const first=nextReplyAnnouncement(early,'Marie',null);
 assert.equal(first?.say,'Marie: Bonjour.');
 assert.equal(nextReplyAnnouncement(early,'Marie',first!.announced),null,'the French is not said twice');
 const filled=turn('t1','tutor');
 const second=nextReplyAnnouncement(filled,'Marie',first!.announced);
 assert.equal(second?.say,'Hello.','the English is said once it arrives, without the French again');
 assert.equal(nextReplyAnnouncement(filled,'Marie',second!.announced),null,'the English is said only once');
 const whole=nextReplyAnnouncement(turn('t2','tutor'),'Marie',second!.announced);
 assert.equal(whole?.say,'Marie: Bonjour.\nHello.');
 assert.equal(nextReplyAnnouncement(turn('t2','tutor'),'Marie',whole!.announced),null);
 assert.equal(nextReplyAnnouncement(null,'Marie',whole!.announced),null);
 const source=readSource(new URL('./Transcript.tsx',import.meta.url),'utf8');
 assert.match(source,/nextReplyAnnouncement\(latest\.tutor, tutorName, announcedTutor\.current\)/,'the transcript asks the helper');
});
