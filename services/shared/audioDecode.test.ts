import assert from 'node:assert/strict';import {test} from 'node:test';
import {decodeAudio,pcmWav} from './audioDecode.ts';
import {pcmAudioMillis} from './paidExecution.ts';
test('normalized audio header has exact finite duration and rejects duration/header disagreement',()=>{const wav=pcmWav(new Uint8Array(64000));assert.equal(pcmAudioMillis(wav),2000);const altered=Buffer.from(wav);altered.writeUInt32LE(16000,28);assert.throws(()=>pcmAudioMillis(altered));assert.throws(()=>pcmAudioMillis(pcmWav(new Uint8Array(960002))));});
test('decoder refuses unknown/oversized audio, missing executable and invalid digest without provider traffic',async()=>{
 await assert.rejects(decodeAudio(new Uint8Array([1,2,3]),{env:{}}));await assert.rejects(decodeAudio(pcmWav(new Uint8Array(32000)),{env:{}}));await assert.rejects(decodeAudio(new Uint8Array(2097153),{env:{}}));await assert.rejects(decodeAudio(pcmWav(new Uint8Array(32000)),{env:{LUVANI_AUDIO_DECODER_PATH:'/missing',LUVANI_AUDIO_DECODER_SHA256:'f'.repeat(64)}}));
});
