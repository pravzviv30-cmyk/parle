import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {test} from 'node:test';
import {accountExports} from './accountExportV2.ts';
import {HttpInputError} from './requestBoundary.ts';
const owner='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const data=Buffer.from('account data');const hash=createHash('sha256').update(data).digest('hex');
const part={kind:'part',version:2,exportId:id,part:0,totalParts:1,bytes:data.length,sha256:hash,dataBase64:data.toString('base64'),nextPart:null};
const manifest={kind:'ready',version:2,exportId:id,format:'luvani-account-export-ndjson-v2',hashAlgorithm:'sha256-chain-v1',rootSha256:hash,totalBytes:data.length,totalParts:1,snapshotAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+14*60_000).toISOString()};
test('export API adapter uses fixed service RPCs with actual owner/session/export/part binding',async()=>{
  const calls:string[]=[];
  const api=accountExports('https://db.test/','private',async(url,init)=>{
    calls.push(String(url));assert.equal((init?.headers as Record<string,string>).authorization,'Bearer private');assert.equal(init?.redirect,'error');
    if(String(url).includes('/auth/'))return Response.json({last_sign_in_at:new Date(Date.now()-1000).toISOString()});
    const args=JSON.parse(String(init?.body));assert.equal(args.p_user_id,owner);assert.equal(args.p_export_id,id);
    if(String(url).includes('purge'))return Response.json({kind:'purged'});
    assert.equal(args.p_auth_session_id,session);
    if(String(url).includes('part')){assert.equal(args.p_part,0);return Response.json(part);}
    return Response.json(manifest);
  });
  assert.deepEqual(await api.prepare(owner,session,id,Date.now()),manifest);assert.deepEqual(await api.part(owner,session,id,0),part);await api.purge(owner,id);assert.equal(calls.length,4);
});
test('corrupt, noncanonical, substituted or unbounded export parts cannot be returned',async()=>{
  for(const bad of [{sha256:'0'.repeat(64)},{exportId:owner},{part:1},{bytes:65537},{dataBase64:data.toString('base64')+'='},{nextPart:1},{totalParts:2049},{dataBase64:Buffer.from('different').toString('base64')}]){
    await assert.rejects(accountExports('https://db.test','private',async()=>Response.json({...part,...bad})).part(owner,session,id,0));
  }
  let calls=0;await assert.rejects(accountExports('https://db.test','private',async()=>{calls++;return Response.json(part);}).part(owner,session,id,2048));assert.equal(calls,0);
});
test('fresh reauthentication and complete bounded manifest are required before preparation succeeds',async()=>{
  let calls=0;const stale=accountExports('https://db.test','private',async()=>{calls++;return Response.json({});});
  assert.equal(await stale.prepare(owner,session,id,Date.now()-301000),null);assert.equal(calls,0);
  for(const bad of [{version:1},{totalBytes:128*1024*1024+1},{totalParts:2},{exportId:owner},{rootSha256:'bad'},{expiresAt:manifest.snapshotAt}]){
    await assert.rejects(accountExports('https://db.test','private',async(url)=>Response.json(String(url).includes('/auth/')?{last_sign_in_at:new Date(Date.now()-1000).toISOString()}:{...manifest,...bad})).prepare(owner,session,id,Date.now()));
  }
});

// F272: the real /account/export-v2 branch of server.ts, run with stubs as sessionLessonId.test.ts does.
const source=readFileSync(new URL('./server.ts',import.meta.url),'utf8');
const start=source.indexOf("    if ((req.method === 'POST' && url.pathname === '/account/export-v2')");
const end=source.indexOf('\n    if (req.method',start+10);
assert.ok(start>0 && end>start);
const js=stripTypeScriptTypes(`async function branch() {${source.slice(start,end)}\n}`);
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
async function exportRoute(method:string,path:string,request:typeof fetch) {
  const response={status:0,body:{} as unknown};
  const world={
    req:{method,headers:{authorization:'Bearer fixture'}},res:{},url:new URL(path,'http://token.test'),
    json:(_res:unknown,status:number,value:unknown)=>{response.status=status;response.body=value;},
    withinLimits:async()=>true,ipCheck:()=>[],RATE_LIMITS:{},
    users:{resolve:async()=>({ok:true,userId:owner,authSessionId:session,authenticatedAt:Date.now()})},
    eventSink:{baseUrl:'https://db.test',serviceRoleKey:'private'},
    accountExports:(base:string,key:string)=>accountExports(base,key,request),
    readRequestJson:async()=>({exportId:id}),sessionIdPattern:/^[0-9a-f-]{36}$/i,
    withRequestSignal:(_req:unknown,_res:unknown,run:(signal?:AbortSignal)=>unknown)=>run(undefined),
  };
  try {
    await new AsyncFunction(...Object.keys(world),js.slice(js.indexOf('{')+1,js.lastIndexOf('}')))(...Object.values(world));
  } catch(error) {
    // What answerRequestError would send for this throw.
    response.status=error instanceof HttpInputError?error.status:500;response.body={error:'internal error'};
  }
  return response;
}
test('a missing export function answers 503 account export unavailable, not an internal error',async()=>{
  // PostgREST answers 404 for an RPC that is not in the schema, as on a project missing the migration.
  const missing:typeof fetch=async url=>String(url).includes('/auth/')
    ?Response.json({last_sign_in_at:new Date(Date.now()-1000).toISOString()})
    :Response.json({message:'Could not find the function'},{status:404});
  for(const [method,path] of [['POST','/account/export-v2'],['GET',`/account/export-v2/${id}?part=0`],['DELETE',`/account/export-v2/${id}`]] as const) {
    assert.deepEqual(await exportRoute(method,path,missing),{status:503,body:{error:'account export unavailable'}},`${method} ${path}`);
  }
  // Any other failure is still an internal error.
  const broken:typeof fetch=async()=>{throw new Error('socket hang up');};
  assert.equal((await exportRoute('GET',`/account/export-v2/${id}?part=0`,broken)).status,500);
});
