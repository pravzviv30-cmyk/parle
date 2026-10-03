import {fileURLToPath} from 'node:url';
import{spawn}from'node:child_process';import{createConnection}from'node:net';
const proc=spawn(process.execPath,['--experimental-strip-types','services/token-server/src/server.ts'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),env:{PATH:process.env.PATH,PORT:'58673',NODE_ENV:'development',LUVANI_LOCAL_DEVELOPMENT:'1',LIVEKIT_API_KEY:'test-api-key',LIVEKIT_API_SECRET:'test-secret-long-enough-for-local-signing-only',LIVEKIT_URL:'ws://localhost:7880',DOTENV_CONFIG_PATH:'/dev/null'},stdio:['ignore','pipe','pipe']});
let log='';proc.stdout.on('data',c=>log+=c);proc.stderr.on('data',c=>log+=c);
try{let ready=false;for(let i=0;i<100;i++){if(proc.exitCode!==null)break;try{const r=await fetch('http://127.0.0.1:58673/health',{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('server failed to boot');
const outcome=await new Promise(resolve=>{const socket=createConnection(58673,'127.0.0.1',()=>socket.write('GET /health HTTP/1.1\r\nHost: %\r\nConnection: close\r\n\r\n'));let response='';socket.on('data',c=>response+=c);socket.on('close',()=>resolve({responseStatus:response.split('\r\n')[0]||'no HTTP response'}));socket.on('error',()=>resolve({connectionError:true}));socket.setTimeout(3000,()=>socket.destroy());});
await new Promise(r=>setTimeout(r,100));console.log(JSON.stringify({case:'unauthenticated malformed Host',...outcome,exitCode:proc.exitCode,invalidUrl:log.includes('ERR_INVALID_URL')}));
}finally{proc.kill('SIGTERM');}
