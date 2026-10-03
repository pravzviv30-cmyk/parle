import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const cwd=fileURLToPath(new URL('../../',import.meta.url));
const proc=spawn(process.execPath,['--experimental-strip-types','services/token-server/src/server.ts'],{cwd,env:{PATH:process.env.PATH,PORT:'58672',NODE_ENV:'development',LUVANI_LOCAL_DEVELOPMENT:'1',LIVEKIT_API_KEY:'test-api-key',LIVEKIT_API_SECRET:'test-secret-long-enough-for-local-signing-only',LIVEKIT_URL:'ws://localhost:7880',DOTENV_CONFIG_PATH:'/dev/null'},stdio:['ignore','pipe','pipe']});
let log='';proc.stdout.on('data',c=>log+=c);proc.stderr.on('data',c=>log+=c);
const post=async(path,body)=>{const r=await fetch('http://127.0.0.1:58672'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(3000)});return{status:r.status,body:await r.json()};};
try {
let ready=false;for(let i=0;i<100;i++){if(proc.exitCode!==null)break;try{const r=await fetch('http://127.0.0.1:58672/health',{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Server did not become ready; error code '+(log.match(/code: '([^']+)'/)?.[1]??'unknown'));
const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const a=await post('/session/start',{userId});const blocked=await post('/session/start',{userId});const ab=await post('/session/abandon',{userId,sessionId:a.body.sessionId});const b=await post('/session/start',{userId});
console.log(JSON.stringify({case:'active lease release',first:a.status,concurrentBeforeAbandon:blocked.status,abandon:ab.status,newStart:b.status,firstCredentialStillExists:typeof a.body.token==='string',differentSessionIds:a.body.sessionId!==b.body.sessionId}));
for(const path of ['/session/start','/billing/status']) {const out=await post(path,null);console.log(JSON.stringify({case:'null body',path,status:out.status}));}
console.log(JSON.stringify({case:'health without DB or voice worker',status:200}));
try {const r=await fetch('http://127.0.0.1:58672/drill/score',{method:'POST',headers:{'content-type':'audio/wav','x-luvani-user':userId,'x-luvani-reference':'bonjour'},body:Buffer.alloc(2*1024*1024+1),signal:AbortSignal.timeout(5000)});console.log(JSON.stringify({case:'audio overflow',status:r.status}));} catch {console.log(JSON.stringify({case:'audio overflow',connectionFailed:true}));}
await new Promise(r=>setTimeout(r,100));console.log(JSON.stringify({case:'audio overflow process outcome',exitCode:proc.exitCode,unhandledPayloadError:log.includes('Error: payload too large')}));
} catch(e) {console.log(String(e));process.exitCode=1;} finally {proc.kill('SIGTERM');}
