/** Content-free, one-instance pull exporter. Never emits source URLs, credentials or bodies. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROUTES=Object.freeze(['health','ready','session','account','billing','drill','phrase-audio','conversation-packs','conversation-text','product-events','agent','internal','unknown']);
const BOUNDS=Object.freeze([50,100,250,500,1000,2500,5000,15000,null]);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const object=v=>v && typeof v==='object' && !Array.isArray(v);
const exact=(v,keys)=>{if(!object(v)||Object.keys(v).length!==keys.length||!keys.every(k=>Object.hasOwn(v,k)))throw new Error('metrics-contract-invalid');};
const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;
function privateHost(host){if(host==='127.0.0.1'||host==='::1')return true;const p=host.split('.').map(Number);return p.length===4&&p.every((n,i)=>String(n)===host.split('.')[i]&&n>=0&&n<=255)&&(p[0]===10||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168));}
export function validateObservabilityConfig(v){
 exact(v,['version','enabled','listenHost','listenPort','apiInstance','metricsUrl']);
 if(v.version!==1||typeof v.enabled!=='boolean'||typeof v.listenHost!=='string'||!privateHost(v.listenHost)||!Number.isInteger(v.listenPort)||v.listenPort<1024||v.listenPort>65535||typeof v.apiInstance!=='string'||!/^[a-z][a-z0-9_-]{2,63}$/.test(v.apiInstance))throw new Error('metrics-configuration-invalid');
 if(!v.enabled){if(v.metricsUrl!==null)throw new Error('disabled-metrics-target-must-be-null');return structuredClone(v);}
 let url;try{url=new URL(v.metricsUrl);}catch{throw new Error('metrics-target-invalid');}
 if(typeof v.metricsUrl!=='string'||url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/internal/metrics'||/^(?:localhost|.*\.(?:invalid|test|example))$/i.test(url.hostname)||/(?:placeholder|replace-me)/i.test(url.hostname))throw new Error('metrics-target-invalid');
 return structuredClone(v);
}
export function decodeMetrics(v,{now=Date.now()}={}){
 exact(v,['http','operations']);exact(v.http,['durationBoundsMs','routes','process']);exact(v.operations,['version','tutor','practice','maintenance','erasurePending','erasureOldestSeconds']);exact(v.http.process,['bootId','startedAt']);
 if(JSON.stringify(v.http.durationBoundsMs)!==JSON.stringify(BOUNDS)||!object(v.http.routes)||Object.keys(v.http.routes).length>ROUTES.length||Object.keys(v.http.routes).some(k=>!ROUTES.includes(k))||v.operations.version!==1||['tutor','practice','maintenance'].some(k=>typeof v.operations[k]!=='boolean')||!count(v.operations.erasurePending)||!count(v.operations.erasureOldestSeconds)||typeof v.http.process.bootId!=='string'||!UUID.test(v.http.process.bootId)||typeof v.http.process.startedAt!=='string'||!Number.isFinite(Date.parse(v.http.process.startedAt))||Date.parse(v.http.process.startedAt)>now+60000)throw new Error('metrics-contract-invalid');
 for(const r of Object.values(v.http.routes)){
  exact(r,['requests','errors','durationBuckets']);
  if(!count(r.requests)||!count(r.errors)||r.errors>r.requests||!Array.isArray(r.durationBuckets)||r.durationBuckets.length!==BOUNDS.length||r.durationBuckets.some(x=>!count(x))||r.durationBuckets.reduce((n,x)=>n+x,0)!==r.requests)throw new Error('metrics-contract-invalid');
 }
 return structuredClone(v);
}
function sample(name,labels,value){return `${name}${Object.keys(labels).length?'{'+Object.entries(labels).map(([k,v])=>`${k}=${JSON.stringify(String(v))}`).join(',')+'}':''} ${value}\n`;}
const header=(name,type,help)=>`# HELP ${name} ${help}\n# TYPE ${name} ${type}\n`;
export function prometheusMetrics(payload,{apiInstance,resetCount=0,lastSuccess=0,up=1}={}){
 if(typeof apiInstance!=='string'||!/^[a-z][a-z0-9_-]{2,63}$/.test(apiInstance)||!count(resetCount)||!Number.isFinite(lastSuccess))throw new Error('metrics-render-invalid');
 const label={api_instance:apiInstance};let out=header('luvani_metrics_source_up','gauge','One pinned API instance metrics source successful on this scrape.')+sample('luvani_metrics_source_up',label,up);
 out+=header('luvani_metrics_last_success_timestamp_seconds','gauge','Exporter last successful upstream collection epoch seconds.')+sample('luvani_metrics_last_success_timestamp_seconds',label,lastSuccess);
 out+=header('luvani_metrics_observed_resets_total','counter','Observed process identity changes or decreasing source counters; exporter restart also resets this counter.')+sample('luvani_metrics_observed_resets_total',label,resetCount);
 if(!up)return out;
 const v=decodeMetrics(payload);
 out+=header('luvani_api_process_start_timestamp_seconds','gauge','Pinned API process start epoch seconds.')+sample('luvani_api_process_start_timestamp_seconds',label,Date.parse(v.http.process.startedAt)/1000);
 out+=header('luvani_http_requests_total','counter','Completed HTTP requests since API process start; source resets preserved.');
 for(const [route,r]of Object.entries(v.http.routes).sort())out+=sample('luvani_http_requests_total',{...label,route},r.requests);
 out+=header('luvani_http_errors_total','counter','Completed HTTP 5xx or premature closes (499) since API process start.');
 for(const [route,r]of Object.entries(v.http.routes).sort())out+=sample('luvani_http_errors_total',{...label,route},r.errors);
 // These are cumulative classic bucket counters. No duration sum is available;
 // expose bucket/count families as counters, never invent a histogram sum.
 out+=header('luvani_http_duration_seconds_bucket','counter','Cumulative completed HTTP duration buckets converted from source noncumulative milliseconds.');
 for(const [route,r]of Object.entries(v.http.routes).sort()){let cumulative=0;for(let n=0;n<BOUNDS.length;n++){cumulative+=r.durationBuckets[n];out+=sample('luvani_http_duration_seconds_bucket',{...label,route,le:BOUNDS[n]===null?'+Inf':BOUNDS[n]/1000},cumulative);}}
 out+=header('luvani_http_duration_seconds_count','counter','Completed HTTP duration observation count; no measured duration sum provided.');
 for(const [route,r]of Object.entries(v.http.routes).sort())out+=sample('luvani_http_duration_seconds_count',{...label,route},r.requests);
 out+=header('luvani_backend_worker_ready','gauge','At least one ready worker for this role with DB heartbeat newer than 60 seconds.');
 for(const worker of ['tutor','practice','maintenance'])out+=sample('luvani_backend_worker_ready',{...label,worker},v.operations[worker]?1:0);
 out+=header('luvani_erasure_pending','gauge','Durable account erasure jobs not completed.')+sample('luvani_erasure_pending',label,v.operations.erasurePending);
 out+=header('luvani_erasure_oldest_seconds','gauge','Server-clock age of oldest pending account erasure, zero if none.')+sample('luvani_erasure_oldest_seconds',label,v.operations.erasureOldestSeconds);
 return out;
}
async function pullMetrics(url,secret,request,timeoutMs,maxBytes){
 const controller=new AbortController();let timer;let rejectStop;
 const stopped=new Promise((_,reject)=>{rejectStop=reject;});timer=setTimeout(()=>{controller.abort();rejectStop(new Error('metrics-source-timeout'));},timeoutMs);
 let reader;
 try{
  const work=request(url,{method:'GET',redirect:'error',headers:{'x-luvani-metrics':secret,accept:'application/json'},signal:controller.signal});
  work.then(r=>{if(controller.signal.aborted)void r.body?.cancel().catch(()=>{});},()=>{});
  const response=await Promise.race([work,stopped]);if(response.status!==200||!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new Error('metrics-source-invalid');
  if(Number(response.headers.get('content-length'))>maxBytes)throw new Error('metrics-source-too-large');
  reader=response.body?.getReader();if(!reader)throw new Error('metrics-source-invalid');let size=0;const chunks=[];
  for(;;){const r=await Promise.race([reader.read(),stopped]);if(r.done)break;size+=r.value.byteLength;if(size>maxBytes)throw new Error('metrics-source-too-large');chunks.push(Buffer.from(r.value));}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch{controller.abort();void reader?.cancel().catch(()=>{});throw new Error('metrics-source-unavailable');}finally{clearTimeout(timer);}
}
/** Collect only on Prometheus scrape; overlapping requests share one bounded pull. */
export function createMetricsCollector(config,secret,{request=fetch,now=Date.now,timeoutMs=5000,maxBytes=65536}={}){
 const c=validateObservabilityConfig(config);if(!c.enabled||typeof secret!=='string'||secret.length<32||secret.length>4096||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>65536)throw new Error('metrics-collector-configuration-invalid');
 let pending,last,resetCount=0,lastSuccess=0;
 return {collect(){return pending??=(async()=>{try{
  const v=decodeMetrics(await pullMetrics(c.metricsUrl,secret,request,timeoutMs,maxBytes),{now:now()});
  if(last && (last.http.process.bootId!==v.http.process.bootId||Object.entries(last.http.routes).some(([route,r])=>v.http.routes[route]&&(v.http.routes[route].requests<r.requests||v.http.routes[route].errors<r.errors||v.http.routes[route].durationBuckets.some((n,i)=>n<r.durationBuckets[i])))))resetCount++;
  last=v;lastSuccess=now()/1000;return prometheusMetrics(v,{apiInstance:c.apiInstance,resetCount,lastSuccess,up:1});
 }catch{return prometheusMetrics(null,{apiInstance:c.apiInstance,resetCount,lastSuccess,up:0});}finally{pending=undefined;}})();}};
}
export function metricsServer(config,secret,options={}){
 const c=validateObservabilityConfig(config),collector=createMetricsCollector(c,secret,options);
 return createServer(async(req,res)=>{if(req.method!=='GET'||req.url!=='/metrics'){res.writeHead(404);res.end();return;}
  const metrics=await collector.collect();res.writeHead(200,{'content-type':'text/plain; version=0.0.4; charset=utf-8','cache-control':'no-store'});res.end(metrics);});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)throw new Error('metrics-configuration-file-required');const bytes=await readFile(resolve(process.argv[2]));if(bytes.length>16384)throw new Error('metrics-configuration-too-large');const c=validateObservabilityConfig(JSON.parse(bytes));
  if(!c.enabled){console.log('metrics exporter disabled; no listener or collection started');}else{
   const server=metricsServer(c,process.env.LUVANI_METRICS_SECRET);server.listen(c.listenPort,c.listenHost);server.on('error',()=>{console.error('metrics exporter listener failed');process.exitCode=1;});
   process.once('SIGTERM',()=>{server.close();setTimeout(()=>process.exit(0),5500).unref();});
  }
 }catch{console.error('metrics exporter configuration refused');process.exitCode=1;}
}
