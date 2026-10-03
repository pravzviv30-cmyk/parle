import assert from 'node:assert/strict';import { test } from 'node:test';
import { encodeMessage, decodeServerMessage } from './index.ts';
import { authoredCorrectionReason, correctionSourceMatches, readCorrectionReason } from './correctionReason.ts';
const evidence = {sessionId:'11111111-1111-4111-8111-111111111111',textTurnId:'v2',correctionIndex:0,quote:'Je suis vingt ans',better:'J’ai vingt ans',reason:'verb-form'};
test('authored correction reasons require exact current learner recast provenance',()=>{
  assert.equal(readCorrectionReason(evidence)?.reason,'verb-form');
  assert.deepEqual(decodeServerMessage(encodeMessage({t:'correction-reason',evidence} as never)),{t:'correction-reason',evidence});assert.equal(authoredCorrectionReason('invented'),null);
  assert.ok(authoredCorrectionReason('verb-form'));
  assert.equal(correctionSourceMatches('Bonjour. Je suis vingt ans.',evidence.quote,evidence.better),true);
  for (const [said,quote,better] of [['une amie','ami','autre'],['invented','Je suis','J’ai'],['Je suis','Je suis','Je suis'],['Je suis','','J’ai']]) assert.equal(correctionSourceMatches(said!,quote!,better!),false);
  for (const bad of [{...evidence,reason:'none'},{...evidence,textTurnId:'unknown'},{...evidence,sessionId:'unknown'},{...evidence,correctionIndex:-1},{...evidence,correctionIndex:9},{...evidence,quote:'x'.repeat(401)}]) assert.equal(readCorrectionReason(bad),null);
});
