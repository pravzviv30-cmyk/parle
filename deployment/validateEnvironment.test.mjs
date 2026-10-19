/** Offline process-level environment refusal; no provider or hosted calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const contract=JSON.parse(await readFile(new URL('./environment-contract.json',import.meta.url),'utf8'));
function fixture(role){
 const env={PATH:process.env.PATH,NODE_ENV:'production',LUVANI_DURABLE_PRACTICE:'1',TUTOR_LLM:'openai',OPENAI_API_KEY:'offline-openai-fixture'};
 for(const name of contract.roles[role].secrets)env[name]=`offline-fixture-${name}`.padEnd(48,'x');
 for(const name of contract.roles[role].configuration)if(name.endsWith('_URL'))env[name]=`${name==='LIVEKIT_URL'?'wss':'https'}://fixture.test`;
 env.LUVANI_PAID_QUOTE_BINDINGS=JSON.stringify({'lesson':{quoteId:'11111111-1111-4111-8111-111111111111',configurationSha256:'123456789abcdef0'.repeat(4)}});
 env.LUVANI_DELETION_JOURNAL_KEY=Buffer.alloc(32,7).toString('base64url');
 if(role!=='maintenance')delete env.LUVANI_DELETION_JOURNAL_KEY;
 return env;
}
const run=(role,env)=>spawnSync(process.execPath,['deployment/validateEnvironment.mjs',role],{env,encoding:'utf8'});
test('API, tutor and practice use actual shared TUTOR_LLM selector and selected provider key',()=>{
 for(const role of ['api','tutor','practice']){const r=run(role,fixture(role));assert.equal(r.status,0,r.stderr);}
});
test('unused LUVANI_BRAIN cannot substitute for the real selector',()=>{
 for(const role of ['api','practice']){const env=fixture(role);delete env.TUTOR_LLM;env.LUVANI_BRAIN='openai';const r=run(role,env);assert.notEqual(r.status,0);assert.match(r.stderr,/TUTOR_LLM required/);assert.match(r.stderr,/forbidden LUVANI_BRAIN/);}
});
test('selected provider key is required before container startup',()=>{
 for(const role of ['api','tutor','practice']){const env=fixture(role);delete env.OPENAI_API_KEY;const r=run(role,env);assert.notEqual(r.status,0);assert.match(r.stderr,/missing selected provider OPENAI_API_KEY/);}
});
test('Groq is recognized but fail-closed pending reviewed degraded privacy launch policy',()=>{
 const env=fixture('practice');env.TUTOR_LLM='groq';delete env.OPENAI_API_KEY;
 let r=run('practice',env);assert.notEqual(r.status,0);assert.match(r.stderr,/degraded privacy contract/);assert.match(r.stderr,/GROQ_API_KEY/);
 env.GROQ_API_KEY='offline-groq-fixture';r=run('practice',env);assert.notEqual(r.status,0);assert.match(r.stderr,/degraded privacy contract/);
 assert.doesNotMatch(r.stderr,/missing selected provider GROQ_API_KEY/);
});
test('production refuses a non-OpenAI tutor brain',()=>{
 for(const role of ['api','tutor','practice'])for(const brain of ['anthropic','groq']){const env=fixture(role);env.TUTOR_LLM=brain;env.ANTHROPIC_API_KEY='offline-anthropic-fixture';env.GROQ_API_KEY='offline-groq-fixture';const r=run(role,env);assert.notEqual(r.status,0);assert.match(r.stderr,/OpenAI TUTOR_LLM required/);}
});
test('a short RevenueCat webhook secret fails production boot',()=>{
 const env=fixture('api');env.LUVANI_REVENUECAT_WEBHOOK_SECRET='Bearer '+'x'.repeat(24);assert.match(run('api',env).stderr,/weak LUVANI_REVENUECAT_WEBHOOK_SECRET/);
 env.LUVANI_REVENUECAT_WEBHOOK_SECRET='Bearer '+'x'.repeat(25);assert.doesNotMatch(run('api',env).stderr,/weak LUVANI_REVENUECAT_WEBHOOK_SECRET/);
});
test('maintenance requires stable source project origin independently of journal endpoint',()=>{
 const env=fixture('maintenance');delete env.OPENAI_API_KEY;delete env.TUTOR_LLM;
 assert.equal(run('maintenance',env).status,0);
 for(const value of [undefined,'http://fixture.test','https://name:secret@fixture.test']){const copy={...env};if(value===undefined)delete copy.LUVANI_DELETION_JOURNAL_PROJECT_URL;else copy.LUVANI_DELETION_JOURNAL_PROJECT_URL=value;const r=run('maintenance',copy);assert.notEqual(r.status,0);assert.match(r.stderr,/secure explicit LUVANI_DELETION_JOURNAL_PROJECT_URL required/);}
});

test('actual ingress port and scalar quote identity are enforced before startup',()=>{
 const env=fixture('api');env.PORT='9999';assert.match(run('api',env).stderr,/PORT must be8787/);delete env.PORT;
 const b=JSON.parse(env.LUVANI_PAID_QUOTE_BINDINGS);b.lesson.quoteId=[b.lesson.quoteId];env.LUVANI_PAID_QUOTE_BINDINGS=JSON.stringify(b);assert.match(run('api',env).stderr,/LUVANI_PAID_QUOTE_BINDINGS required/);
});
test('API and tutor refuse unsupported scorers and TTS credentials before accepting requests',()=>{
 for(const role of ['api','tutor']){
  for(const name of ['TONEPERFECT_API_KEY','FISH_API_KEY'])assert.match(run(role,{...fixture(role),[name]:'synthetic'}).stderr,new RegExp('forbidden '+name));
  for(const extra of [{SPEECHACE_API_KEY:'synthetic'},{LUVANI_SCORING_VENDOR:'toneperfect'}])assert.match(run(role,{...fixture(role),...extra}).stderr,/explicit supported Speechace scoring/);
  assert.equal(run(role,{...fixture(role),LUVANI_SCORING_VENDOR:'speechace',SPEECHACE_API_KEY:'synthetic'}).status,0);
 }
});
