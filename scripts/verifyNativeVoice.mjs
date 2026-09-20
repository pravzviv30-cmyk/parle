/** Paid, synthetic-input transport smoke. Does not use or grant a microphone. */
import assert from 'node:assert/strict';
import { AudioFrame, AudioSource, AudioStream, LocalAudioTrack, TrackPublishOptions, TrackSource, Room, RoomEvent, dispose } from '@livekit/rtc-node';
import { setTimeout as delay } from 'node:timers/promises';
if (process.env.LUVANI_NATIVE_EVAL !== '1') throw new Error('This smoke uses paid voice. Set LUVANI_NATIVE_EVAL=1 explicitly.');
const origin='http://localhost:8890';
const denied=await fetch(`${origin}/session`,{method:'POST'});
assert.equal(denied.status,403,'cross-origin/nonce-free starts must be refused');
const html=await (await fetch(origin)).text();
const nonce=html.match(/'x-lab-nonce':'([a-f0-9]+)'/)?.[1];
assert.ok(nonce);
const response=await fetch(`${origin}/session`,{method:'POST',headers:{origin,'x-lab-nonce':nonce}});
if(!response.ok)throw new Error(`admission refused (${response.status})`);
const admission=await response.json();
const room=new Room();
let timer,reader,pumping=true,pump;
const source=new AudioSource(24000,1);
try {
  const audible=new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(new Error('No non-silent voice audio within 30 seconds')),30000);
    room.on(RoomEvent.TrackSubscribed,(track)=>{
      if(reader)return;
      reader=new AudioStream(track,{sampleRate:24000,numChannels:1}).getReader();
      void (async()=>{
        try {
          for(;;){const {value,done}=await reader.read();if(done)return;
            if(value.data.some(sample=>Math.abs(sample)>200)){resolve();return;}}
        }catch(error){reject(error);}
      })();
    });
  });
  await room.connect(admission.url,admission.token);
  const track=LocalAudioTrack.createAudioTrack('synthetic-silence',source);
  await room.localParticipant.publishTrack(track,new TrackPublishOptions({source:TrackSource.SOURCE_MICROPHONE}));
  // GPT-Live's media clock needs incoming frames. Synthetic silence is not a
  // recording and contains no human speech; never open the system microphone.
  pump=(async()=>{while(pumping){await source.captureFrame(AudioFrame.create(24000,1,480));await delay(20);}})();
  await audible;
  console.log('PASS: protected local admission, named worker dispatch and non-silent native voice audio. No microphone, grading or conversational quality was tested.');
} finally {
  clearTimeout(timer);
  pumping=false;
  if(pump)await pump;
  if(reader)await reader.cancel();
  await source.close();
  await room.disconnect();
  await dispose();
}
