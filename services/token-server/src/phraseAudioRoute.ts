import type { IncomingMessage, ServerResponse } from 'node:http';
import { isTutorVoiceKey, readPhraseAudioSource } from '@luvani/core';
import type { ResolvedUser } from './auth.ts';
import { readJudgeBody } from './drillJudge.ts';
import { decodedHeader, DRILL_USER_HEADER } from './drillScore.ts';
import { generatePhraseAudio, phraseAudioManifest } from './phraseAudio.ts';

export interface PhraseAudioDeps {
  users: {resolve(authorization:string|undefined,asserted:string|null):Promise<ResolvedUser>};
  limits(req:IncomingMessage,res:ServerResponse,userId:string|null):Promise<boolean>;
  env: Record<string,string|undefined>;
  request?: typeof fetch;
  timeoutMs?: number;
}
function json(res:ServerResponse,status:number,body:unknown) {
  if (res.destroyed || res.writableEnded) return;
  const text=JSON.stringify(body); res.writeHead(status,{'content-type':'application/json','content-length':Buffer.byteLength(text),'cache-control':'no-store'}); res.end(text);
}
export async function handlePhraseAudio(req:IncomingMessage,res:ServerResponse,generate:boolean,deps:PhraseAudioDeps):Promise<void> {
  const controller=new AbortController();
  let end:()=>void=()=>{};
  const ended=new Promise<never>((_resolve,reject)=>{ end=()=>{controller.abort();reject(new Error('Audio unavailable'));}; });
  const timer=setTimeout(end,Math.max(1,Math.min(20_000,deps.timeoutMs??20_000)));
  req.once('aborted',end); res.once('close',end);
  try {
    await Promise.race([(async()=>{
      if (req.aborted || res.destroyed || new URL(req.url??'/','http://localhost').search) return json(res,400,{error:'audio accepts no query parameters'});
      if (!await deps.limits(req,res,null) || controller.signal.aborted) return;
      const asserted=decodedHeader(req,DRILL_USER_HEADER);
      if (asserted===undefined) return json(res,400,{error:'invalid account header'});
      const user=await deps.users.resolve(req.headers.authorization,asserted);
      if (controller.signal.aborted) return;
      if (!user.ok) return json(res,user.status,{error:user.message});
      if (asserted!==null && asserted!==user.userId) return json(res,403,{error:'account changed'});
      if (!await deps.limits(req,res,user.userId) || controller.signal.aborted) return;
      const body=await readJudgeBody(req);
      if (controller.signal.aborted) return;
      const keys=generate?['source','voice','fingerprint','frenchHash']:['source','voice'];
      if (!body || Object.keys(body).length!==keys.length || !keys.every(key=>Object.hasOwn(body,key)) || !readPhraseAudioSource(body.source) || !isTutorVoiceKey(body.voice)) return json(res,400,{error:'a saved source and selected voice are required'});
      if (!generate) {
        const manifest=await phraseAudioManifest(user.userId,body.source,body.voice,deps.env,controller.signal,deps.request);
        if (!controller.signal.aborted) return manifest?json(res,200,manifest):json(res,503,{error:'tutor-audio-unavailable'});
      } else {
        const wav=await generatePhraseAudio(user.userId,body.source,body.voice,body.fingerprint,body.frenchHash,deps.env,controller.signal,deps.request);
        if (controller.signal.aborted || res.destroyed || res.writableEnded) return;
        if (!wav) return json(res,503,{error:'tutor-audio-unavailable'});
        res.writeHead(200,{'content-type':'audio/wav','content-length':wav.length,'cache-control':'no-store'}); res.end(wav);
      }
    })(),ended]);
  } catch { json(res,503,{error:'tutor-audio-unavailable'}); }
  finally { clearTimeout(timer); req.removeListener('aborted',end); res.removeListener('close',end); }
}
