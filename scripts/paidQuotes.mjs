/**
 * Staging paid-quote generator. Owner-run output only: this script never
 * connects to a database, never reads a key and never calls a vendor.
 *
 * Every component identity (kind/provider/model/voice/configurationSha256) is
 * captured from the code the services run, by driving the real request
 * builders against a capture boundary that records the descriptor and refuses
 * before anything is dispatched:
 *
 *   - brain calls: brainClientFromEnv(TUTOR_LLM=openai) with a capture fetch,
 *     run through describePaidHttp, exactly as paidProviderFetch does;
 *   - the Deepgram take: transcribeFrenchTake with a capture fetch;
 *   - phrase audio: generatePhraseAudio with fake DB answers and a capture fetch;
 *   - the live voice pipeline: the installed LiveKit OpenAI/ElevenLabs/Deepgram
 *     plugins against the real createPaidVoiceProxy, whose gate records the
 *     descriptor and throws quote-mismatch, so the proxy never opens an upstream.
 *
 * Envelopes are priced worst case from the cost model (packages/core metering
 * DEFAULT_COST_MODEL), the LLM price table (packages/brain pricing.ts) and the
 * vendor list prices in docs/cogs-evidence/rates.md (VOICE-008). They are NOT
 * vendor quotes. See ENVELOPES below for every number's derivation.
 *
 * Usage (from the repo root):
 *   node scripts/paidQuotes.mjs --reviewed-by "<name>" [--out DIR] [--voices all|alexandre,marie]
 *     [--evidence-url https://...] [--global-usd 21] [--account-usd 7]
 * Writes into --out (default: a fresh directory under the OS temp dir, never the repo):
 *   paid-quotes.sql            owner-run SQL (one transaction)
 *   paid-quote-bindings.json   the LUVANI_PAID_QUOTE_BINDINGS value
 *   paid-budget-contract.json  the same configuration in deployment/paid-budget-contract.json format
 *   paid-quote-evidence.json   the evidence document whose sha256 every quote carries
 */
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));

/**
 * The founder's staging configuration the hashes are derived for. Every knob
 * below changes a request body, so a staging service whose env differs from
 * this will refuse its paid calls as quote-mismatch. The generator pins these
 * in process.env while it captures (some builders read process.env directly).
 */
export const STAGING_ENV=Object.freeze({
 NODE_ENV:'production',TUTOR_LLM:'openai',
 // Unset on staging: defaults gpt-5.6-luna (turn), gpt-6-luna (live/drills/curation), gpt-5.6-terra (analyst).
 OPENAI_TURN_MODEL:undefined,OPENAI_LIVE_MODEL:undefined,OPENAI_ANALYST_MODEL:undefined,OPENAI_DRILLS_MODEL:undefined,OPENAI_CURATION_MODEL:undefined,
 OPENAI_LIVE_SERVICE_TIER:undefined,BRAIN_EFFORT:undefined,
 LUVANI_STREAM_TURN:undefined,            // streamed spoken convo turns stay on (default)
 LUVANI_TTS_VENDOR:undefined,             // elevenlabs
 LUVANI_CONVERSATION_TTS_MODEL:undefined, // eleven_multilingual_v2 only, no flash tier
 LUVANI_CONVO_ASR_EXPERIMENT:undefined,   // nova-3, not flux
 LUVANI_AUDIO_SCORING:undefined,          // no scoring component in lesson/convo
 TYPESAFE_API_KEY:undefined,              // Jev is off in production anyway
});
const KNOBS=Object.keys(STAGING_ENV);

/** Founder caps (staging, 2026-10-26). */
export const CAPS=Object.freeze({
 sessionSeconds:600,            // max_session_seconds: the free plan's whole allowance (PLANS.trial.secondsPerPeriod)
 accountDailySeconds:1200,      // max_account_daily_seconds
 accountDailySessions:3,        // max_account_daily_sessions
 dailyIssuedSeconds:3600,       // max_daily_issued_seconds (6 full sessions)
 activeSessions:3,              // max_active_sessions
});
export const QUOTE_DAYS=6;       // paid_review_v1 refuses an expiry more than 7 days out

/** Vendor list prices behind the envelopes. Sources cited per line; none is a negotiated quote. */
const RATES=Object.freeze({
 // rates.md: eleven_multilingual_v2 $0.08 per 1k characters = 80 microUSD a character.
 // A UTF-8 byte count is never smaller than the character count, so pricing bytes as characters over-covers.
 elevenMicroUsdPerChar:80,
 // rates.md: emilie and sarah bill twice per character; the other four once (alexandre measured).
 voiceMultiplier:{emilie:2,sarah:2},
 // DEFAULT_COST_MODEL.sttPerMin (0.009) = Nova-3 monolingual streaming $0.0077 + keyterm prompting ~$0.0013.
 // rates.md: Nova-3 multilingual streaming regular $0.0092/min. Plain monolingual $0.0077.
 deepgramUsdPerMin:{fr:0.0077,multi:0.0092,keyterm:0.0013},
});

const BRAIN_SYNTHETIC={persona:'',request:'Synthetic capture request.'};

function setStagingEnv() {
 const saved={};for(const key of KNOBS){saved[key]=process.env[key];if(STAGING_ENV[key]===undefined)delete process.env[key];else process.env[key]=STAGING_ENV[key];}
 return ()=>{for(const key of KNOBS){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}};
}

const workerRequire=createRequire(join(ROOT,'services/tutor-agent/package.json'));
const workerModule=name=>import(pathToFileURL(workerRequire.resolve(name).replace(/\.cjs$/,'.js')).href);

/** A capture boundary for fetch-shaped builders: describe, record, refuse. Nothing leaves the process. */
function captureFetch(describePaidHttp,sink) {
 return async(input,init={})=>{
  const url=new URL(String(input));
  // The phrase-audio DB calls are answered by the caller's own fake, never here.
  const descriptor=await describePaidHttp(url,init);
  sink.push({descriptor,inputBytes:descriptor.quantities.inputBytes});
  return new Response('{"error":{"message":"capture only"}}',{status:400,headers:{'content-type':'application/json'}});
 };
}

/** One WAV second of 16 kHz mono PCM, the shape the bounded decoder hands the take. */
function wavSecond() {
 const pcm=32000,b=Buffer.alloc(44+pcm);b.write('RIFF',0);b.writeUInt32LE(36+pcm,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm,40);return new Uint8Array(b);
}

class RefusingSocket extends EventEmitter {readyState=3;bufferedAmount=0;send(){throw new Error('capture only');}close(){}terminate(){}}
async function until(predicate,what){for(let n=0;n<400;n++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}throw new Error(`capture did not reach ${what}`);}

/**
 * Capture every paid request shape the staging config can send, from code.
 * Returns {name -> {descriptor, configurationSha256, measuredInputBytes}}.
 */
export async function captureShapes({voices}) {
 const restore=setStagingEnv();
 const cacheDir=await mkdtemp(join(tmpdir(),'luvani-quote-tts-'));const savedCache=process.env.TTS_CACHE_DIR;process.env.TTS_CACHE_DIR=cacheDir;
 try {
  const {describePaidHttp,paidConfigurationSha256}=await import('../services/shared/paidExecution.ts');
  const {PaidAdmissionError}=await import('../services/shared/paidAdmission.ts');
  const {brainClientFromEnv}=await import('../packages/brain/src/llm/factory.ts');
  const {buildSystemBlocks}=await import('../packages/brain/src/prompt/system.ts');
  const {buildOwnWordsJudgeRequest}=await import('../packages/brain/src/llm/judge.ts');
  const {buildFixLineJudgeRequest}=await import('../packages/brain/src/llm/fixLineJudge.ts');
  const {openAiLiveModel}=await import('../packages/brain/src/llm/openaiResponses.ts');
  const {transcribeFrenchTake}=await import('../services/shared/transcription.ts');
  const {generatePhraseAudio,frenchAudioHash}=await import('../services/token-server/src/phraseAudio.ts');
  const {selectedTutorSynthesisConfiguration,ELEVEN_VOICES,BEGINNER_SPEED}=await import('../services/tutor-agent/src/voiceConfiguration.ts');
  const {buildTTS}=await import('../services/tutor-agent/src/voice.ts');
  const {recognitionPlan}=await import('../services/tutor-agent/src/recognitionPlan.ts');
  const {createPaidVoiceProxy}=await import('../services/tutor-agent/src/paidVoiceProxy.ts');
  const core=await import('../packages/core/src/index.ts');
  const shapes={};
  const add=(name,descriptor,measuredInputBytes=descriptor.quantities.inputBytes)=>{
   const {quantities:_q,...identity}=descriptor;const hash=paidConfigurationSha256(identity);
   if(shapes[name] && shapes[name].configurationSha256!==hash)throw new Error(`capture ${name} produced two identities`);
   shapes[name]={descriptor,configurationSha256:hash,measuredInputBytes:Math.max(measuredInputBytes,shapes[name]?.measuredInputBytes??0)};
  };

  // 1. Brain (Responses API). The same factory the token server, practice worker and tutor call.
  const brainSink=[];const brain=brainClientFromEnv({...STAGING_ENV,OPENAI_API_KEY:'capture-only'},captureFetch(describePaidHttp,brainSink));
  const system=buildSystemBlocks();
  const brainCalls={
   'turn':()=>brain.turn({kind:'turn',system,messages:[{role:'user',text:BRAIN_SYNTHETIC.request}]}),
   'turn-stream':()=>brain.turn({kind:'turn',system,messages:[{role:'user',text:BRAIN_SYNTHETIC.request}],onSpokenFields:()=>{}}),
   'frame':()=>brain.frame({kind:'frame',system,request:BRAIN_SYNTHETIC.request}),
   'extract':()=>brain.extract({kind:'extract',system,request:BRAIN_SYNTHETIC.request}),
   'drills':()=>brain.drills({kind:'drills',system,request:BRAIN_SYNTHETIC.request}),
   'curate':()=>brain.curate({kind:'curate',system,request:BRAIN_SYNTHETIC.request}),
   'judge':()=>brain.judge(buildOwnWordsJudgeRequest({situation:'Au café',fr:'Un café, merci.',en:'A coffee, thanks.',mustKeep:['a coffee'],cefr:'A1',attempt:'Un café s’il vous plaît.'})),
   'fix-judge':()=>brain.judge(buildFixLineJudgeRequest({original:'Je suis 20 ans.',better:'J’ai 20 ans.',attempt:'J’ai 20 ans.',why:'Age uses avoir.',cefr:'A1'})),
  };
  for(const [name,call] of Object.entries(brainCalls)){brainSink.length=0;await call().catch(()=>{});if(brainSink.length!==1)throw new Error(`brain ${name} sent ${brainSink.length} requests`);add(name,brainSink[0].descriptor);}

  // 2. The Deepgram take (api-transcribe).
  const takeSink=[];await transcribeFrenchTake(wavSecond(),{key:'capture-only',request:captureFetch(describePaidHttp,takeSink)});
  if(takeSink.length!==1)throw new Error('take capture failed');add('take',takeSink[0].descriptor);

  // 3. Phrase audio, one per voice. The DB answers are the test fixture's shape.
  const userId='11111111-1111-4111-8111-111111111111',packId='33333333-3333-4333-8333-333333333333';
  const pack=core.buildConversationPack({id:packId,sessionId:packId,learnerId:userId,createdAt:new Date().toISOString(),title:{fr:'Au café',en:'At the café'},summary:'Capture.',keyPhrases:[{fr:'Un café, merci.',frWritten:null,en:'A coffee, thanks.'}]});
  const phraseEnv={...STAGING_ENV,SUPABASE_URL:'https://capture.invalid',SUPABASE_SERVICE_ROLE_KEY:'capture-only',ELEVEN_API_KEY:'capture-only',LUVANI_PHRASE_AUDIO_GENERATION:'1'};
  for(const voice of voices){
   const config=selectedTutorSynthesisConfiguration(voice,phraseEnv);const sink=[];let calls=0;const vendor=captureFetch(describePaidHttp,sink);
   const reservation={fr:pack.keyPhrases[0].fr,payload:pack,fingerprint:config.fingerprint,rateRevision:'44444444-4444-4444-8444-444444444444',bucket:'trial',globalWindowStart:new Date(Date.now()-1000).toISOString(),paidWindowStart:null};
   await generatePhraseAudio(userId,{packId,kind:'phrase',index:0},voice,config.fingerprint,frenchAudioHash(reservation.fr),phraseEnv,new AbortController().signal,
    async(url,init)=>{calls++;if(calls===1)return Response.json(reservation);if(calls===2)return Response.json(true);return vendor(url,init);}).catch(()=>{});
   if(sink.length!==1)throw new Error(`phrase audio ${voice} capture failed`);add(`phrase-${voice}`,sink[0].descriptor);
  }

  // 4. The live voice pipeline through the real paid proxy. The gate records and refuses,
  //    which the proxy treats as "nothing was spent"; no upstream request or socket is ever made.
  const [{llm,initializeLogger},openai,deepgram,{AudioFrame}]=await Promise.all([workerModule('@livekit/agents'),workerModule('@livekit/agents-plugin-openai'),workerModule('@livekit/agents-plugin-deepgram'),workerModule('@livekit/rtc-node')]);
  initializeLogger({pretty:false,level:'silent'});
  const voiceSink=[];const stop=new AbortController();
  const proxy=await createPaidVoiceProxy({maximumSessionMillis:CAPS.sessionSeconds*1000,signal:stop.signal,
   credentials:{openai:'capture-only',elevenlabs:'capture-only',deepgram:'capture-only'},
   gate:async descriptor=>{voiceSink.push(descriptor);throw new PaidAdmissionError('quote-mismatch');},
   request:async()=>{throw new Error('capture must not dispatch');},websocketConnector:()=>{throw new Error('capture must not connect');}});
  const conn={maxRetry:0,timeoutMs:5000,retryIntervalMs:1};
  try {
   // agent.ts tutorLLM(proxy), TUTOR_LLM=openai. Mirrored here; paidQuotes.test.mjs pins the agent.ts line.
   const model=new openai.LLM({model:openAiLiveModel(),baseURL:proxy.openaiBaseURL,apiKey:'proxy-only',maxCompletionTokens:3000});
   const chatCtx=new llm.ChatContext();chatCtx.addMessage({role:'user',content:BRAIN_SYNTHETIC.request});
   model.on('error',()=>{});voiceSink.length=0;const stream=model.chat({chatCtx,connOptions:conn});
   try{for await(const _ of stream){/* refused */}}catch{/* refused */}finally{await Promise.resolve().then(()=>stream.close()).catch(()=>{});await Promise.resolve().then(()=>model.aclose()).catch(()=>{});}
   if(voiceSink.length!==1)throw new Error('live chat capture failed');add('live-chat',voiceSink[0]);
   // agent.ts sessionAudio tts: buildTTS({voice, conversationTier:true, speed, baseURL, missTransport:'http'}). Speed is stripped from identity.
   for(const voice of voices){
    voiceSink.length=0;const tts=buildTTS({voice,conversationTier:true,speed:BEGINNER_SPEED,baseURL:proxy.elevenlabsBaseURL,missTransport:'http'});
    // The refused miss emits 'error' on the inner plugin TTS, which has no listener of its own.
    tts.on('error',()=>{});tts.inner.on('error',()=>{});
    // A cache miss on the http transport is exactly inner.synthesize(text, connOptions) (ttsCache.ts #passthrough).
    const synthesis=tts.inner.synthesize('Capture seulement, une phrase libre.',conn);
    const drain=(async()=>{try{for await(const _ of synthesis){/* refused */}}catch{/* refused */}})();
    await until(()=>voiceSink.length>0,`tts ${voice}`);
    // Let the refused request finish inside the plugin before the proxy closes, so nothing retries into a closed port.
    await Promise.race([drain,new Promise(r=>setTimeout(r,750))]);await Promise.resolve().then(()=>synthesis.close()).catch(()=>{});await Promise.resolve().then(()=>tts.close()).catch(()=>{});
    if(voiceSink[0].voice!==ELEVEN_VOICES[voice])throw new Error(`tts ${voice} captured the wrong voice`);add(`tts-${voice}`,voiceSink[0]);
   }
   // agent.ts sessionAudio stt: deepgram.STT({...recognition.options, keyterm?, baseUrl, apiKey, sampleRate:16000, numChannels:1, mipOptOut:true}).
   const sttShapes=[['stt-lesson-keyterm',recognitionPlan('lesson','fr',STAGING_ENV),core.lessonKeyterms(core.CAFE_LESSON)],['stt-convo-multi',recognitionPlan('convo','multi',STAGING_ENV),[]],['stt-convo-fr',recognitionPlan('convo','fr',STAGING_ENV),[]]];
   for(const [name,plan,keyterm] of sttShapes){
    if(plan.experimental)throw new Error('flux is not quoted');
    voiceSink.length=0;const stt=new deepgram.STT({...plan.options,...(keyterm.length?{keyterm}:{}),baseUrl:proxy.deepgramBaseURL,apiKey:'proxy-only',sampleRate:16000,numChannels:1,mipOptOut:true});
    stt.on('error',()=>{});const recognition=stt.stream({connOptions:conn});recognition.pushFrame(new AudioFrame(new Int16Array(3200),16000,1,3200));
    // A keyterm stream asks for the keyterm identity first, then (refused) the plain one.
    await until(()=>voiceSink.length>=(keyterm.length?2:1),name);recognition.close();
    add(name,voiceSink[0]);if(keyterm.length)add(`${name}-plain`,voiceSink[1]);
   }
  } finally {stop.abort();await proxy.close();}
  return shapes;
 } finally {restore();if(savedCache===undefined)delete process.env.TTS_CACHE_DIR;else process.env.TTS_CACHE_DIR=savedCache;}
}

/* ---------------------------------------------------------------- envelopes
 * Sizing rules, for one session of CAPS.sessionSeconds (600 s):
 *
 * LLM (all OpenAI). Price = maxInputBytes x input $/MTok + maxOutputTokens x output $/MTok,
 *   from USD_PER_MTOK (packages/brain/src/llm/pricing.ts), so microUSD = units x $/MTok.
 *   Input is priced UNCACHED and at one token per byte: a BPE token is never shorter than a byte,
 *   so this bounds the bill; real French/JSON runs about 4 bytes a token, so the envelope is ~4x real.
 *   Per-effect input = the measured body with the real system blocks (captured above) + an allowance:
 *     turn 24 KiB (40-turn history), frame 8 KiB, judge 4 KiB, live chat 24 KiB (prompt + history),
 *     curate/extract/drills 64 KiB (session transcript and errors).
 *   Output per effect = the max_output_tokens / max_completion_tokens the request itself carries.
 *   Effects: OpenAiResponsesBrainClient retries a 429 once, so each brain call is 2 effects.
 *     convo turns: 66 = two full components (100,000 / 3,000 output tokens = 33 each). That is 40 turns
 *       (4/min measured, VOICE-008) plus 26 retries or extra turns; a quote holds at most 16 components.
 *     frames: 4 scenes x 2 = 8. curate/extract/drills: once at close x 2.
 *     live chat (lesson, preemptive generation on, maxRetry 0): 60 (12-turn lesson, replays, speculative calls).
 *   A component holds at most 100,000 output tokens and 2 MiB of input (paid_quote_valid_v1),
 *   so a large budget is split over several components with the SAME identity; the gate fills them in order.
 * STT streaming (Deepgram). Each websocket claims the whole session (600,000 ms), so a component is one
 *   connection: lesson 1 (fr + keyterms), convo 2 multi (topic choice) + 2 fr (scene; each scene restarts it).
 *   Price = 10 min x the per-minute rate (fr+keyterm = DEFAULT_COST_MODEL.sttPerMin 0.009; multi 0.0092).
 * STT take (api-transcribe): one call, at most SCORING_MAX_WAV_BYTES (30 s); priced at the streaming fr rate.
 * TTS (ElevenLabs). One component per voice, because voice is identity. Per session the tutor speaks
 *   600 s x tutorSpeakingShare 0.25 x 17 chars/s (rates.md) = 2,550 chars; x1.25 for accents/headroom = 3,200 bytes.
 *   Effects 120 (one per synthesized line). Price = bytes x 80 microUSD x the voice multiplier.
 * Phrase audio: one call of at most 400 bytes (phraseAudioFrench allows 400 characters; real phrases are far shorter).
 * ------------------------------------------------------------------------- */
const KIB=1024;
const ALLOWANCE={turn:24*KIB,'turn-stream':24*KIB,frame:8*KIB,judge:4*KIB,'fix-judge':4*KIB,'live-chat':24*KIB,curate:64*KIB,extract:64*KIB,drills:64*KIB};
const EFFECTS={turn:66,'turn-stream':66,frame:8,curate:2,extract:2,drills:2,judge:2,'fix-judge':2,'live-chat':60};
const TTS_BYTES=3200,TTS_EFFECTS=120,PHRASE_BYTES=400;

async function priceTable(){const {USD_PER_MTOK}=await import('../packages/brain/src/llm/pricing.ts');return USD_PER_MTOK;}
const base=(key,shape)=>({key,kind:shape.descriptor.kind,provider:shape.descriptor.provider,model:shape.descriptor.model,voice:shape.descriptor.voice,configurationSha256:shape.configurationSha256,maxProviderAttempts:1});
function llmComponents(prices,key,shape,{effects,lessonText=false}={}) {
 const name=shape.name,total=effects??EFFECTS[name],perInput=shape.measuredInputBytes+ALLOWANCE[name],perOutput=shape.descriptor.quantities.outputTokens;
 const price=prices[shape.descriptor.model];if(!price)throw new Error(`no price row for ${shape.descriptor.model}`);
 const perComponent=Math.min(total,Math.floor(100000/perOutput),Math.floor(2097152/perInput));if(perComponent<1)throw new Error(`${name} cannot fit one effect`);
 const count=Math.ceil(total/perComponent),out=[];let left=total;
 for(let i=0;i<count;i++){const effects=Math.ceil(left/(count-i));left-=effects;
  const maxInputBytes=effects*perInput,maxOutputTokens=effects*perOutput;
  out.push({...base(count===1?key:`${key}-${i+1}`,shape),maxEffects:effects,maxInputBytes,maxOutputTokens,maxAudioMillis:0,maxTextBytes:0,microUsd:Math.ceil(maxInputBytes*price.input+maxOutputTokens*price.output)});}
 void lessonText;return out;
}
function sttStreamComponent(key,shape,count,usdPerMin) {
 const millis=CAPS.sessionSeconds*1000,micro=Math.ceil(usdPerMin*1e6*millis/60000);
 return Array.from({length:count},(_,i)=>({...base(count===1?key:`${key}-${i+1}`,shape),maxEffects:1,maxInputBytes:0,maxOutputTokens:0,maxAudioMillis:millis,maxTextBytes:0,microUsd:micro}));
}
function ttsComponent(key,shape,voice,bytes,effects) {
 return {...base(key,shape),maxEffects:effects,maxInputBytes:0,maxOutputTokens:0,maxAudioMillis:0,maxTextBytes:bytes,microUsd:bytes*RATES.elevenMicroUsdPerChar*(RATES.voiceMultiplier[voice]??1)};
}

/** activity -> components. Which calls run inside which quote is documented in the report and evidence. */
export async function buildQuoteComponents(shapes,voices) {
 const prices=await priceTable(),s=name=>({...shapes[name],name});
 const {SCORING_MAX_WAV_BYTES}=await import('../services/shared/paidExecution.ts');
 const rate=RATES.deepgramUsdPerMin;
 const tts=(bytes,effects)=>voices.map(v=>ttsComponent(`tts-${v}`,s(`tts-${v}`),v,bytes,effects));
 const convoBrain=turn=>[...llmComponents(prices,'turn',s(turn)),...llmComponents(prices,'frame',s('frame')),...llmComponents(prices,'curate',s('curate')),...llmComponents(prices,'extract',s('extract')),...llmComponents(prices,'drills',s('drills'))];
 const takeMillis=(SCORING_MAX_WAV_BYTES-44)/32;
 return {
  // Scripted lesson: LiveKit chat (gpt-6-luna) + Deepgram fr with the lesson keyterms + ElevenLabs.
  lesson:[...llmComponents(prices,'chat',s('live-chat')),...sttStreamComponent('stt-fr-keyterm',s('stt-lesson-keyterm'),1,rate.fr+rate.keyterm),...tts(TTS_BYTES,TTS_EFFECTS)],
  // Typed lesson: llmNode stops before any model call, so nothing is spent; the quote still needs one llm
  // component (paid_quote_valid_v1). One live-chat effect, the smallest honest envelope.
  'lesson-text':llmComponents(prices,'chat',s('live-chat'),{effects:1}),
  // Spoken conversation: brain (streamed turns) + Deepgram multi/fr + ElevenLabs. The LiveKit chat model is
  // not called in a conversation (preemptive generation off; onUserTurnCompleted answers through the brain).
  convo:[...convoBrain('turn-stream'),...sttStreamComponent('stt-multi',s('stt-convo-multi'),2,rate.multi),...sttStreamComponent('stt-fr',s('stt-convo-fr'),2,rate.fr),...tts(TTS_BYTES,TTS_EFFECTS)],
  'convo-text':convoBrain('turn'),
  practice:llmComponents(prices,'drills',s('drills')),
  'api-judge':llmComponents(prices,'judge',s('judge')),
  'api-fix-judge':llmComponents(prices,'judge',s('fix-judge')),
  'api-transcribe':[{...base('take',s('take')),maxEffects:1,maxInputBytes:SCORING_MAX_WAV_BYTES,maxOutputTokens:0,maxAudioMillis:takeMillis,maxTextBytes:0,microUsd:Math.ceil(rate.fr*1e6*takeMillis/60000)}],
  'phrase-audio':voices.map(v=>ttsComponent(`tts-${v}`,s(`phrase-${v}`),v,PHRASE_BYTES,1)),
 };
}

const sha=value=>createHash('sha256').update(value).digest('hex');
/** The quote-level identity: deterministic over activity and its component identities and envelopes. */
export function quoteConfigurationSha256(activity,components){return sha(JSON.stringify({version:1,activity,components:components.map(c=>[c.key,c.kind,c.provider,c.model,c.voice,c.configurationSha256,c.maxEffects,c.maxInputBytes,c.maxOutputTokens,c.maxAudioMillis,c.maxTextBytes,c.microUsd])}));}
const kindsOf=components=>[...new Set(components.map(c=>c.kind))].sort();
const sum=(components,key)=>components.reduce((n,c)=>n+c[key],0);
const sqlText=value=>`'${String(value).replace(/'/g,"''")}'`;

/** Budgets sized from the quotes. Every number is printed in the evidence with its derivation. */
/**
 * BOOKING ceilings, not a spend estimate (founder decision 2026-10-27).
 *
 * Reservation books every component's whole worst-case envelope (all six voices, input priced uncached at one
 * token per byte), never refunded. Those bookings run about 4x real usage and far more where alternatives such
 * as voices are summed, so a ceiling sized to real spend would refuse sessions the admission caps allow.
 * The ceilings are therefore sized to admit what the tutor admission caps admit, and REAL spend is bounded by
 * those caps (3 sessions at once, 3,600 s/day, 1,200 s/account/day: about $3/day at VOICE-008 rates), with the
 * provider-side spend caps as the money backstop. These numbers are not a control on dollars by themselves.
 *
 *   global  = sessionsGlobal (3,600 / 600 = 6) x the dearest session booking, rounded up to a whole dollar.
 *   account = sessionsPerAccount (1,200 / 600 = 2) x the dearest session booking, rounded up to $0.10.
 *             API calls (judges, takes, Hear) share the account remainder after two spoken conversations.
 */
export function sizeBudgets(quotes,{globalDailyMicroUsd,accountDailyMicroUsd}={}) {
 const tutor=['lesson','lesson-text','convo','convo-text'],api=['practice','api-judge','api-fix-judge','api-transcribe','phrase-audio'];
 const cost=a=>sum(quotes[a],'microUsd'),calls=a=>sum(quotes[a],'maxEffects');
 const sessionCost=Math.max(...tutor.map(cost)),sessionCalls=Math.max(...tutor.map(calls));
 const sessionsPerAccount=Math.floor(CAPS.accountDailySeconds/CAPS.sessionSeconds); // 2
 const sessionsGlobal=Math.floor(CAPS.dailyIssuedSeconds/CAPS.sessionSeconds);      // 6
 // Per account per day beyond sessions: 40 judges, 20 fix judges, 20 takes, 40 Hear taps, 1 practice pack.
 const apiOps={'api-judge':40,'api-fix-judge':20,'api-transcribe':20,'phrase-audio':40,practice:1};
 const apiCost=Object.entries(apiOps).reduce((n,[a,k])=>n+k*cost(a),0),apiCalls=Object.entries(apiOps).reduce((n,[a,k])=>n+k*calls(a),0),apiCount=Object.values(apiOps).reduce((a,b)=>a+b,0);
 const roundUp=(n,step)=>Math.ceil(n/step)*step;
 const global=globalDailyMicroUsd??roundUp(sessionsGlobal*sessionCost,1_000_000);
 const account=accountDailyMicroUsd??Math.min(global,roundUp(sessionsPerAccount*sessionCost,100_000));
 const sizing={global:globalDailyMicroUsd===undefined?`${sessionsGlobal} sessions x ${sessionCost} microUSD dearest session booking, rounded up to $1`:'--global-usd override',account:accountDailyMicroUsd===undefined?`${sessionsPerAccount} sessions x ${sessionCost} microUSD dearest session booking, rounded up to $0.10; API calls share the remainder`:'--account-usd override',note:'Worst-case bookings (~4x real usage, all voices summed), not spend. Real spend is bounded by the tutor admission caps (about $3/day) and provider-side spend caps.'};
 const budgets={
  globalDailyMicroUsd:global,accountDailyMicroUsd:account,
  // Operations: one per tutor session or API call. Global: 6 sessions + 20 accounts' API use, with room.
  globalDailyOperations:sessionsGlobal+20*apiCount,accountDailyOperations:CAPS.accountDailySessions+apiCount,
  // Calls: the reserved provider-attempt envelope (sum of maxEffects) of the same mix.
  globalDailyCalls:Math.min(1000000,sessionsGlobal*sessionCalls+20*apiCalls),accountDailyCalls:Math.min(1000000,CAPS.accountDailySessions*sessionCalls+apiCalls),
 };
 const admitted=Object.fromEntries(Object.keys(quotes).map(a=>[a,Math.floor(global/cost(a))]));
 const admittedPerAccount=Object.fromEntries(Object.keys(quotes).map(a=>[a,Math.floor(account/cost(a))]));
 return {budgets,derivation:{sizing,admittedPerAccountDay:admittedPerAccount,sessionCost,sessionCalls,sessionsPerAccount,sessionsGlobal,apiOps,apiCost,apiCalls,perActivityMicroUsd:Object.fromEntries(Object.keys(quotes).map(a=>[a,cost(a)])),perActivityCalls:Object.fromEntries(Object.keys(quotes).map(a=>[a,calls(a)])),sessionsAdmittedPerDayAtGlobalBudget:admitted}};
}

function evidenceUrlFromGit() {
 try{const remote=execFileSync('git',['remote','get-url','origin'],{cwd:ROOT,encoding:'utf8'}).trim();const m=remote.match(/github\.com[:/](.+?)(?:\.git)?$/);if(m)return `https://github.com/${m[1]}/blob/main/deployment/PAID_ADMISSION.md`;}catch{/* fall through */}
 return null;
}

export async function generate({reviewedBy,out,voices,evidenceUrl,globalDailyMicroUsd,accountDailyMicroUsd,now=Date.now()}) {
 for(const [flag,v] of [['--global-usd',globalDailyMicroUsd],['--account-usd',accountDailyMicroUsd]])if(v!==undefined && (!Number.isSafeInteger(v) || v<1 || v>1000000000000))throw new Error(`${flag} must be a positive amount`);
 if(typeof reviewedBy!=='string' || reviewedBy.trim().length<3 || reviewedBy.length>200)throw new Error('--reviewed-by "<who reviewed these envelopes>" is required (3 to 200 characters)');
 evidenceUrl??=evidenceUrlFromGit();
 if(!evidenceUrl || !/^https:\/\/[^/@?#\s]+([/?#]\S*)?$/.test(evidenceUrl))throw new Error('an https --evidence-url is required');
 const {ELEVEN_VOICES}=await import('../services/tutor-agent/src/voiceConfiguration.ts');
 const allVoices=Object.keys(ELEVEN_VOICES);voices??=allVoices;
 if(!voices.length || voices.some(v=>!allVoices.includes(v)))throw new Error(`--voices must name voices from: ${allVoices.join(', ')}`);
 const shapes=await captureShapes({voices});
 const components=await buildQuoteComponents(shapes,voices);
 const expiresAt=new Date(now+QUOTE_DAYS*86400000).toISOString();
 const {budgets,derivation}=sizeBudgets(components,{globalDailyMicroUsd,accountDailyMicroUsd});
 // Fail closed rather than emit a configuration that can never admit a session: booking is the whole
 // envelope of every component, every voice included, and it is not refunded.
 const blocked=['lesson','lesson-text','convo','convo-text'].filter(a=>derivation.sessionsAdmittedPerDayAtGlobalBudget[a]<1 || derivation.admittedPerAccountDay[a]<1).map(a=>[a]);
 if(blocked.length)throw Object.assign(new Error(`${blocked.map(([a])=>`${a} books ${derivation.perActivityMicroUsd[a]} microUSD`).join(', ')}, more than the global ${budgets.globalDailyMicroUsd} or account ${budgets.accountDailyMicroUsd} microUSD a day, so it could never be admitted. Quote fewer voices or raise --global-usd / --account-usd.`),{derivation});
 const quoteIds=Object.fromEntries(Object.keys(components).map(a=>[a,randomUUID()]));
 const evidence={version:1,generator:'scripts/paidQuotes.mjs',generatedAt:new Date(now).toISOString(),expiresAt,reviewedBy,evidenceUrl,
  stagingEnv:Object.fromEntries(KNOBS.map(k=>[k,STAGING_ENV[k]??null])),caps:CAPS,rates:RATES,
  shapes:Object.fromEntries(Object.entries(shapes).map(([n,v])=>[n,{kind:v.descriptor.kind,provider:v.descriptor.provider,model:v.descriptor.model,voice:v.descriptor.voice,configuration:v.descriptor.configuration,configurationSha256:v.configurationSha256,measuredInputBytes:v.measuredInputBytes}])),
  quotes:Object.fromEntries(Object.entries(components).map(([a,c])=>[a,{quoteId:quoteIds[a],components:c}])),budgets,derivation,
  notes:['Envelopes are worst-case cost-model figures (~4x real), not vendor quotes. Booking is non-refundable on the reservation day.','Budget ceilings are BOOKING ceilings sized to admit the tutor admission caps; real spend is bounded by those caps (about $3/day) and provider-side spend caps, not by these numbers.','Every activity quote books ALL its voice components, although a session speaks in one voice.']};
 const evidenceJson=JSON.stringify(evidence,null,1)+'\n';const evidenceSha256=sha(evidenceJson);
 const review={reviewedBy,evidenceUrl,evidenceSha256,expiresAt};
 const quotes=Object.entries(components).map(([activity,c])=>({id:quoteIds[activity],enabled:true,definition:{activity,components:c,configurationSha256:quoteConfigurationSha256(activity,c),...review}}));
 const bindings=Object.fromEntries(quotes.map(q=>[q.definition.activity,{quoteId:q.id,configurationSha256:q.definition.configurationSha256,kinds:kindsOf(q.definition.components)}]));
 const vendorTotals=p=>({micro:Math.max(...quotes.map(q=>sum(q.definition.components.filter(c=>c.provider===p),'microUsd'))),calls:Math.max(...quotes.map(q=>sum(q.definition.components.filter(c=>c.provider===p),'maxEffects')))});
 // Vendor caps never bind before the global cap: each is the global budget/operations/calls.
 const vendors=['deepgram','elevenlabs','openai'].map(provider=>{const t=vendorTotals(provider);if(t.micro>budgets.globalDailyMicroUsd)console.warn(`[paid-quotes] one ${provider} envelope exceeds the global budget`);return {provider,enabled:true,dailyMicroUsd:budgets.globalDailyMicroUsd,dailyOperations:budgets.globalDailyOperations,dailyCalls:budgets.globalDailyCalls};});
 const contract={version:1,enabled:true,budgets,tutor:{accountDailySessions:CAPS.accountDailySessions,accountDailySeconds:CAPS.accountDailySeconds},review,vendors,quotes,bindings,
  notes:['Generated by scripts/paidQuotes.mjs for staging. Envelopes are cost-model worst cases, not vendor quotes.',`Expires ${expiresAt}; re-run before then and redeploy the bindings, or every paid route closes.`]};
 const {validatePaidBudgetContract}=await import('../deployment/validatePaidBudget.mjs');
 const validation=validatePaidBudgetContract(contract,{now});
 const {paidBindings}=await import('../services/shared/paidBindings.ts');
 const bindingsJson=JSON.stringify(bindings);paidBindings({LUVANI_PAID_QUOTE_BINDINGS:bindingsJson});
 const b=budgets,sql=[
  '-- Owner-run staging paid admission. Generated by scripts/paidQuotes.mjs; review before running.',
  `-- Quotes expire ${expiresAt}. Envelopes are cost-model worst cases (see paid-quote-evidence.json, sha256 ${evidenceSha256}).`,
  'begin;',
  `update luvani_private.paid_admission_config set enabled=true,global_daily_micro_usd=${b.globalDailyMicroUsd},account_daily_micro_usd=${b.accountDailyMicroUsd},global_daily_operations=${b.globalDailyOperations},account_daily_operations=${b.accountDailyOperations},global_daily_calls=${b.globalDailyCalls},account_daily_calls=${b.accountDailyCalls},reviewed_by=${sqlText(reviewedBy)},evidence_url=${sqlText(evidenceUrl)},evidence_sha256=${sqlText(evidenceSha256)},expires_at=${sqlText(expiresAt)}::timestamptz where singleton;`,
  ...vendors.map(v=>`update luvani_private.paid_admission_vendors set enabled=true,daily_micro_usd=${v.dailyMicroUsd},daily_operations=${v.dailyOperations},daily_calls=${v.dailyCalls} where provider=${sqlText(v.provider)};`),
  ...quotes.map(q=>`insert into luvani_private.paid_quotes(id,enabled,definition) values(${sqlText(q.id)},true,${sqlText(JSON.stringify(q.definition))}::jsonb);`),
  `-- Tutor admission caps. enabled stays false: opening admission is a separate, deliberate step.`,
  `update public.tutor_session_admission_config set max_active_sessions=${CAPS.activeSessions},max_daily_issued_seconds=${CAPS.dailyIssuedSeconds},max_account_daily_seconds=${CAPS.accountDailySeconds},max_account_daily_sessions=${CAPS.accountDailySessions},max_session_seconds=${CAPS.sessionSeconds} where singleton;`,
  'commit;',''].join('\n');
 out??=await mkdtemp(join(tmpdir(),'luvani-paid-quotes-'));out=resolve(out);
 if((out+'/').startsWith(resolve(ROOT)+'/'))throw new Error('--out must be outside the repository');
 await mkdir(out,{recursive:true});
 const files={sql:join(out,'paid-quotes.sql'),bindings:join(out,'paid-quote-bindings.json'),contract:join(out,'paid-budget-contract.json'),evidence:join(out,'paid-quote-evidence.json')};
 await writeFile(files.sql,sql);await writeFile(files.bindings,bindingsJson+'\n');await writeFile(files.contract,JSON.stringify(contract,null,1)+'\n');await writeFile(files.evidence,evidenceJson);
 return {out,files,sql,bindings,bindingsJson,contract,evidence,evidenceSha256,validation,shapes,components,budgets,derivation};
}

function args(argv){const o={};for(let i=0;i<argv.length;i++){const a=argv[i];if(!a.startsWith('--'))throw new Error(`unexpected ${a}`);o[a.slice(2)]=argv[++i];}return o;}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try{
  const o=args(process.argv.slice(2));
  const result=await generate({reviewedBy:o['reviewed-by'],...(o['global-usd']?{globalDailyMicroUsd:Math.round(Number(o['global-usd'])*1e6)}:{}),...(o['account-usd']?{accountDailyMicroUsd:Math.round(Number(o['account-usd'])*1e6)}:{}),out:o.out,evidenceUrl:o['evidence-url'],voices:!o.voices||o.voices==='all'?undefined:o.voices.split(',').map(v=>v.trim())});
  const d=result.derivation;
  console.log(`[paid-quotes] wrote ${Object.values(result.files).join(', ')}`);
  console.log(`[paid-quotes] per-activity booking (microUSD): ${JSON.stringify(d.perActivityMicroUsd)}`);
  console.log(`[paid-quotes] admitted per day at the global budget, each alone: ${JSON.stringify(d.sessionsAdmittedPerDayAtGlobalBudget)}`);
  console.log(`[paid-quotes] admitted per account day, each alone: ${JSON.stringify(d.admittedPerAccountDay)}`);
  console.log(`[paid-quotes] sizing: ${JSON.stringify(d.sizing)}`);
  console.log(`[paid-quotes] budgets: ${JSON.stringify(result.budgets)}`);
  console.log(`[paid-quotes] validator: ${JSON.stringify(result.validation)}`);
  process.exit(0);
 }catch(error){console.error(`[paid-quotes] ${error.message}`);process.exit(1);}
}
