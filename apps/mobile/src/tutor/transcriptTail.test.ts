import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transcriptTail,replyAnnouncement} from './transcriptTail.ts';
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
