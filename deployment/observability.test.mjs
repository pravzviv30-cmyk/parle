import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateObservabilityConfig,decodeMetrics,prometheusMetrics,createMetricsCollector}from './observability.mjs';
const template=JSON.parse(await readFile(new URL('./observability.example.json',import.meta.url),'utf8'));
const config={...template,enabled:true,metricsUrl:'https://api.fixture-domain.org/internal/metrics'};
const secret='synthetic-secret-never-emitted-1234567890';
const payload=(n=3,boot='50000000-0000-4000-8000-000000000001')=>({http:{process:{bootId:boot,startedAt:new Date(Date.now()-60000).toISOString()},durationBoundsMs:[50,100,250,500,1000,2500,5000,15000,null],routes:{session:{requests:n,errors:n?1:0,durationBuckets:[n,0,0,0,0,0,0,0,0]}}},operations:{version:1,tutor:true,practice:false,maintenance:true,erasurePending:2,erasureOldestSeconds:120}});
test('disabled template and loopback/private bind only; exact HTTPS path and no credentials or query',()=>{
 assert.equal(validateObservabilityConfig(template).enabled,false);
 for(const bad of [{...config,listenHost:'0.0.0.0'},{...config,listenHost:'8.8.8.8'},{...config,listenHost:'10.1.1.999'},{...config,metricsUrl:'http://api.fixture-domain.org/internal/metrics'},{...config,metricsUrl:'https://key:secret@api.fixture-domain.org/internal/metrics'},{...config,metricsUrl:config.metricsUrl+'?secret=private'},{...config,apiInstance:'learner@example.com'},{...config,metricsUrl:['https://api.fixture-domain.org/internal/metrics']}])assert.throws(()=>validateObservabilityConfig(bad));
 assert.equal(validateObservabilityConfig({...config,listenHost:'10.1.2.3'}).listenHost,'10.1.2.3');
});
test('strict content-free decoder rejects labels, body data, malformed counters, unknown worker/status/version',()=>{
 for(const change of [p=>p.http.routes['/private?email=learner']={...p.http.routes.session},p=>p.http.routes.session.requests=Infinity,p=>p.http.routes.session.errors=4,p=>p.http.routes.session.durationBuckets[0]=2,p=>p.http.process.bootId=['50000000-0000-4000-8000-000000000001'],p=>p.operations.privateUser='secret',p=>p.operations.tutor='true',p=>p.operations.version=2,p=>p.http.process=undefined,p=>p.http.durationBoundsMs[0]=51]){const p=payload();change(p);assert.throws(()=>decodeMetrics(p));}
});
test('bucket conversion is cumulative seconds with count and no fabricated sum or content labels',()=>{
 const p=payload(3);p.http.routes.session.durationBuckets=[1,0,1,0,0,0,0,0,1];
 const text=prometheusMetrics(p,{apiInstance:'api-001'});
 assert.match(text,/luvani_http_duration_seconds_bucket\{api_instance="api-001",route="session",le="0.05"\} 1/);
 assert.match(text,/le="0.25"\} 2/);assert.match(text,/le="\+Inf"\} 3/);assert.match(text,/luvani_http_duration_seconds_count.* 3/);
 assert.match(text,/worker="practice"\} 0/);assert.match(text,/luvani_erasure_oldest_seconds.* 120/);assert.ok(!text.includes('_sum'));assert.ok(!text.includes('50000000-'));
});
test('one bounded pull per concurrent scrape, source reset observed, raw counters retain reset semantics',async()=>{
 let calls=0,n=3,boot='50000000-0000-4000-8000-000000000001';
 const collector=createMetricsCollector(config,secret,{request:async(url,init)=>{calls++;assert.equal(url,config.metricsUrl);assert.equal(init.headers['x-luvani-metrics'],secret);assert.equal(init.redirect,'error');return Response.json(payload(n,boot));}});
 const [a,b]=await Promise.all([collector.collect(),collector.collect()]);assert.equal(a,b);assert.equal(calls,1);
 n=1;boot='50000000-0000-4000-8000-000000000002';const reset=await collector.collect();assert.match(reset,/luvani_metrics_observed_resets_total.* 1/);assert.match(reset,/luvani_http_requests_total.* 1/);assert.ok(!reset.includes(secret));assert.ok(!reset.includes(config.metricsUrl));
});
test('uncooperative header/body hangs, oversized and unexpected payloads show source-down and omit stale counters',async()=>{
 for(const request of [async()=>new Promise(()=>{}),async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{});}}),{headers:{'content-type':'application/json'}}),async()=>Response.json({...payload(),learnerId:secret}),async()=>Response.json({text:'x'.repeat(70000)}),async()=>new Response('unauthorized private body',{status:401})]){
  const collector=createMetricsCollector(config,secret,{request,timeoutMs:10});const text=await collector.collect();assert.match(text,/luvani_metrics_source_up.* 0/);assert.ok(!text.includes('luvani_http_requests_total'));assert.ok(!text.includes(secret));assert.ok(!text.includes('unauthorized'));assert.ok(!text.includes(config.metricsUrl));
 }
 let down=false;const collector=createMetricsCollector(config,secret,{request:async()=>down?new Response('no',{status:503}):Response.json(payload())});assert.match(await collector.collect(),/luvani_http_requests_total/);down=true;assert.ok(!(await collector.collect()).includes('luvani_http_requests_total'));
});
test('rule inventory covers exporter/source/worker/erasure/error/latency and thresholds stay explicitly unreviewed',async()=>{
 const rules=JSON.parse(await readFile(new URL('./observability.rules.json',import.meta.url),'utf8'));
 const yaml=await readFile(new URL('./observability.rules.yml',import.meta.url),'utf8');
 assert.equal(rules.version,1);assert.equal(rules.thresholdsReviewed,false);assert.equal(rules.rules.length,6);assert.equal(new Set(rules.rules.map(r=>r.alert)).size,6);
 for(const r of rules.rules){assert.ok(yaml.includes('alert: '+r.alert));assert.ok(yaml.includes('expr: '+JSON.stringify(r.expr)));}
 assert.ok(rules.rules.some(r=>r.expr.includes('histogram_quantile')));assert.ok(rules.rules.some(r=>r.expr.includes('erasure_oldest_seconds')));
});
