/** Paid text-only regression probe. No microphone, saved learner data or transcripts. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { NATIVE_EVAL_TEACHING } from '../services/tutor-agent/src/nativeEvalPolicy.ts';
import { applyLanguageAgreement, nativeTeachingRequest, parseNativeTeachingReply } from '../services/tutor-agent/src/nativeEvalLanguage.ts';
if (process.env.LUVANI_NATIVE_EVAL !== '1') throw new Error('This makes paid model calls. Set LUVANI_NATIVE_EVAL=1 explicitly.');
const env={...parse(readFileSync(new URL('../services/tutor-agent/.env',import.meta.url))),...process.env};
if(!env.OPENAI_API_KEY)throw new Error('OpenAI key is not configured');
let agreement={tutor:'adaptive',learner:'free'};
const history=[{role:'assistant',content:'Bonjour ! Que souhaitez-vous commander ?'}];
const cases=[
  {text:'Can you repeat that in English?',tutor:'english',learner:'free'},
  {text:'You ask me the questions in English and I will answer in French.',tutor:'english',learner:'french'},
  {text:'Je voudrais un café, merci.',tutor:'english',learner:'french'},
  {text:'Un petit café, s’il vous plaît.',tutor:'english',learner:'french'},
  {text:'How do I pronounce the word croissant?',tutor:'english',learner:'french'},
  {text:'Now please switch back to French.',tutor:'french',learner:'french'},
];
for(const [index,item] of cases.entries()){
  const input=[...history.slice(-8),{role:'user',content:item.text}];
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},
    signal:AbortSignal.timeout(30000),body:JSON.stringify(nativeTeachingRequest(agreement,NATIVE_EVAL_TEACHING,input)),
  });
  if(!response.ok)throw new Error(`Regression provider status=${response.status}`);
  const body=await response.json();
  const text=(body.output??[]).filter(o=>o.type==='message').flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text??'').join(' ');
  const result=parseNativeTeachingReply(text);
  agreement=applyLanguageAgreement(agreement,result);
  assert.equal(agreement.tutor,item.tutor,`case ${index+1}: tutor language drifted`);
  assert.equal(agreement.learner,item.learner,`case ${index+1}: learner language drifted`);
  if(item.tutor==='english')assert.doesNotMatch(result.reply,/^(bonjour|bien sûr|d'accord|très bien|oui\b)/i,'French preamble in an English reply');
  history.push({role:'user',content:item.text},{role:'assistant',content:result.reply});
  // Synthetic fixtures only. Human review of these replies is still required;
  // the preamble check is not a general-purpose language or teaching-quality grader.
  console.log(JSON.stringify({case:index+1,agreement,reply:result.reply}));
}
console.log('PASS: six synthetic backend turns preserved or explicitly changed the language agreement. Voice delivery is not tested here.');
