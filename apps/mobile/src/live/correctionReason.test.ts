import assert from 'node:assert/strict';import { test } from 'node:test';import { readFileSync } from 'node:fs';
import { attachCorrectionReason } from './correctionReason.ts';import type { TurnLine } from './turns.ts';
const sessionId='11111111-1111-4111-8111-111111111111';
const lines:TurnLine[]=[{id:'learner-1',who:'learner',fr:'Je suis vingt ans.',frWritten:null,en:null,recasts:[{textTurnId:'v2',correctionIndex:0,quote:'Je suis vingt ans',better:'J’ai vingt ans',betterEn:'I am twenty',why:'Unverified generated explanation.'}]}];
const evidence={sessionId,textTurnId:'v2',correctionIndex:0,quote:'Je suis vingt ans',better:'J’ai vingt ans',reason:'verb-form' as const};
test('authored correction reasons require exact current learner recast provenance',()=>{
  const updated=attachCorrectionReason(lines,evidence,sessionId);assert.equal(updated[0]?.recasts?.[0]?.reason,'verb-form');assert.equal(lines[0]?.recasts?.[0]?.reason,undefined);
  for (const bad of [{...evidence,textTurnId:'v3'},{...evidence,correctionIndex:1},{...evidence,quote:'Je suis'},{...evidence,better:'J’avais vingt ans'},{...evidence,sessionId:'other'}]) assert.equal(attachCorrectionReason(lines,bad,sessionId)[0]?.recasts?.[0]?.reason,undefined);
  assert.equal(attachCorrectionReason(lines,evidence,null)[0]?.recasts?.[0]?.reason,undefined);
  const tutor=[{...lines[0]!,who:'tutor' as const}];assert.equal(attachCorrectionReason(tutor,evidence,sessionId)[0]?.recasts?.[0]?.reason,undefined);
  const noSource=[{...lines[0]!,fr:'An invented bubble.'}];assert.equal(attachCorrectionReason(noSource,evidence,sessionId)[0]?.recasts?.[0]?.reason,undefined);
  const screen=readFileSync(new URL('../tutor/Transcript.tsx',import.meta.url),'utf8');assert.ok(screen.includes('authoredCorrectionReason(reason)'));assert.ok(screen.includes('accessibilityState={{expanded}}'));assert.ok(!screen.includes('{why}</Text>'));
});
