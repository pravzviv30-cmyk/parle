import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validatePaidBudgetContract} from './validatePaidBudget.mjs';
const template=JSON.parse(await readFile(new URL('./paid-budget-contract.json',import.meta.url),'utf8'));
const now=Date.parse('2026-10-04T12:00:00Z'),hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const p=structuredClone(template);p.enabled=true;for(const k of Object.keys(p.budgets))p.budgets[k]=100;
 p.review={reviewedBy:'offline-reviewer',evidenceUrl:'https://fixture.test/synthetic',evidenceSha256:hash('offline-only'),expiresAt:new Date(now+3600000).toISOString()};
 p.vendors=[{provider:'openai',enabled:true,dailyMicroUsd:100,dailyOperations:100,dailyCalls:100}];
 const id='40000000-0000-4000-8000-000000000001',configurationSha256=hash('config');
 p.quotes=[{id,enabled:true,definition:{activity:'api-judge',configurationSha256,...p.review,components:[{key:'judge',kind:'llm',provider:'openai',model:'offline-model',voice:'',configurationSha256:hash('component'),maxEffects:1,maxProviderAttempts:1,maxInputBytes:1024,maxOutputTokens:600,maxAudioMillis:0,maxTextBytes:0,microUsd:1}]}}];
 p.bindings={'api-judge':{quoteId:id,configurationSha256}};return p;
}
test('shipped zero/OFF template never claims applied configuration or verified vendor prices',()=>{const r=validatePaidBudgetContract(template,{now});assert.equal(r.enabled,false);assert.equal(r.applied,false);assert.equal(r.pricesVerified,false);});
test('complete synthetic owner contract is schema-valid but needs pricing/runtime acceptance',()=>{const r=validatePaidBudgetContract(fixture(),{now});assert.equal(r.enabled,true);assert.equal(r.pricesVerified,false);assert.equal(r.runtimeEnvelopeVerified,false);});
test('missing current review, zero/unsafe budgets, model binding and vendor mismatch refuse',()=>{
 for(const change of [p=>p.review=null,p=>p.review.expiresAt=new Date(now-1).toISOString(),p=>p.budgets.globalDailyMicroUsd=0,p=>p.budgets.globalDailyCalls=1000001,p=>p.bindings['api-judge'].configurationSha256=hash('different'),p=>p.vendors[0].enabled=false,p=>p.quotes[0].definition.components[0].kind=['llm'],p=>p.quotes[0].definition.components[0].maxProviderAttempts=0]){const p=fixture();change(p);assert.throws(()=>validatePaidBudgetContract(p,{now}));}
});
test('unquoted activity/fallback and full voice envelope without owner caps refuse',()=>{
 let p=fixture();p.bindings['api-fix-observer']=p.bindings['api-judge'];assert.throws(()=>validatePaidBudgetContract(p,{now}));
 p=fixture();p.quotes[0].definition.activity='lesson';assert.throws(()=>validatePaidBudgetContract(p,{now}),/component mismatch/);
});
test('operator JSON identities and evidence reject coercible array/object values',()=>{
 for(const change of [p=>p.review.expiresAt=[p.review.expiresAt],p=>p.review.evidenceUrl=[p.review.evidenceUrl],p=>p.review.evidenceSha256=[p.review.evidenceSha256],p=>p.quotes[0].id=[p.quotes[0].id],p=>p.bindings['api-judge'].quoteId=[p.bindings['api-judge'].quoteId],p=>p.quotes[0].definition.configurationSha256=[p.quotes[0].definition.configurationSha256]]){const p=fixture();change(p);assert.throws(()=>validatePaidBudgetContract(p,{now}));}
});
const {LESSON_SCORING_COMPONENT}=await import('../services/shared/lessonScoringQuote.ts');
function lessonFixture(scoring=true){
 const p=fixture(),q=p.quotes[0],d=q.definition;p.tutor={accountDailySessions:1,accountDailySeconds:900};
 p.vendors=['openai','deepgram','elevenlabs','speechace'].map(provider=>({provider,enabled:true,dailyMicroUsd:1000000,dailyOperations:100,dailyCalls:1000}));
 d.activity='lesson';d.components=[d.components[0],{key:'stt',kind:'stt',provider:'deepgram',model:'nova-3',voice:'',configurationSha256:hash('stt'),maxEffects:1,maxProviderAttempts:1,maxInputBytes:0,maxOutputTokens:0,maxAudioMillis:900000,maxTextBytes:0,microUsd:1},{key:'tts',kind:'tts',provider:'elevenlabs',model:'eleven_flash_v2_5',voice:'voice',configurationSha256:hash('tts'),maxEffects:1,maxProviderAttempts:1,maxInputBytes:0,maxOutputTokens:0,maxAudioMillis:0,maxTextBytes:100,microUsd:1},...(scoring?[{...LESSON_SCORING_COMPONENT}]:[])];
 p.bindings={lesson:{...p.bindings['api-judge'],kinds:scoring?['llm','scoring','stt','tts']:['llm','stt','tts']}};return p;
}
test('lesson quote scoring component must carry the reviewed Speechace identity and envelope',()=>{
 assert.equal(validatePaidBudgetContract(lessonFixture(),{now}).enabled,true);
 assert.equal(validatePaidBudgetContract(lessonFixture(false),{now}).enabled,true,'a lesson quote without scoring stays valid');
 const pricier=lessonFixture();pricier.quotes[0].definition.components[3].microUsd*=2;assert.equal(validatePaidBudgetContract(pricier,{now}).enabled,true,'only a higher price passes');
 const bigger=lessonFixture();bigger.quotes[0].definition.components[3].maxEffects=64;bigger.quotes[0].definition.components[3].microUsd*=2;assert.throws(()=>validatePaidBudgetContract(bigger,{now}),/reviewed Speechace/);
 const cheaper=lessonFixture();cheaper.quotes[0].definition.components[3].maxEffects*=10;assert.throws(()=>validatePaidBudgetContract(cheaper,{now}),/reviewed Speechace/,'10x effects at the same price lowers the price per score');
 for(const change of [c=>c.model='text-v8',c=>c.configurationSha256=hash('fr-ca'),c=>c.maxProviderAttempts=2,c=>c.maxEffects=47,c=>c.maxAudioMillis=899999,c=>c.maxAudioMillis=900001,c=>c.maxTextBytes-=1,c=>c.maxTextBytes+=1,c=>c.maxInputBytes-=1,c=>c.maxInputBytes+=1,c=>c.microUsd-=1]){const p=lessonFixture();change(p.quotes[0].definition.components[3]);assert.throws(()=>validatePaidBudgetContract(p,{now}),/reviewed Speechace|paid-operation-unavailable/);}
});
test('binding kinds must be sorted, unique and equal the bound quote kinds',()=>{
 for(const kinds of [['llm','stt','tts'],['llm','scoring','stt','tts','observer'],['scoring','llm','stt','tts'],['llm','llm','scoring','stt','tts'],[],'llm',['llm','scoring','stt','tts','voice']]){const p=lessonFixture();p.bindings.lesson.kinds=kinds;assert.throws(()=>validatePaidBudgetContract(p,{now}));}
 const p=lessonFixture();p.bindings.lesson.extra=true;assert.throws(()=>validatePaidBudgetContract(p,{now}));
});
