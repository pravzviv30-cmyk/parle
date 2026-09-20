/** Run from a clean, secret-free copy after the documented workspace-only npm ci. */
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const portProbe=createServer();
await new Promise(resolve=>portProbe.listen(0,'127.0.0.1',resolve));
const port=portProbe.address().port;
await new Promise(resolve=>portProbe.close(resolve));
// Fresh throwaway values, never real vendor credentials or committed key-like fixtures.
const placeholder=randomBytes(32).toString('hex');
const child=spawn(process.execPath,['--experimental-strip-types','services/token-server/src/server.ts'],{
  cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,NODE_ENV:'production',PORT:String(port),
    LIVEKIT_URL:'wss://deployment-check.example',LIVEKIT_API_KEY:placeholder,LIVEKIT_API_SECRET:placeholder,
    SUPABASE_URL:'https://deployment-check.example',SUPABASE_SERVICE_ROLE_KEY:placeholder,
    LUVANI_AGENT_SECRET:placeholder,LUVANI_ALLOWED_ORIGINS:'https://beta.example',
    UPSTASH_REDIS_REST_URL:'https://deployment-check.example',UPSTASH_REDIS_REST_TOKEN:placeholder,
    LUVANI_RATE_LIMIT_SALT:placeholder,LUVANI_DURABLE_PRACTICE:'1'},
});
let log=''; child.stdout.on('data',chunk=>{log+=chunk;});child.stderr.on('data',chunk=>{log+=chunk;});
try{
  let healthy=false;
  for(let attempt=0;attempt<50;attempt++){
    if(child.exitCode!==null)throw new Error(`Production startup failed: ${log}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(500)});
      const body=await response.json();
      assert.equal(response.status,200);assert.equal(body.ok,true);assert.equal(body.durablePractice,true);
      healthy=true;break;
    }catch{await delay(100);}
  }
  assert.equal(healthy,true,`No healthy production process: ${log}`);
  console.log('PASS: clean workspace-only install boots the production token API and serves /health. Placeholder credentials only; vendor connectivity and Linux hosting not tested.');
}finally{
  if(child.exitCode===null && child.signalCode===null){
    const exited=new Promise(resolve=>child.once('exit',resolve));
    child.kill('SIGTERM');
    await exited;
  }
}
