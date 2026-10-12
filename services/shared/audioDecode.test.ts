import assert from 'node:assert/strict';import {test} from 'node:test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {decodeAudio,pcmWav} from './audioDecode.ts';
import {pcmAudioMillis} from './paidExecution.ts';
test('normalized audio header has exact finite duration and rejects duration/header disagreement',()=>{const wav=pcmWav(new Uint8Array(64000));assert.equal(pcmAudioMillis(wav),2000);const altered=Buffer.from(wav);altered.writeUInt32LE(16000,28);assert.throws(()=>pcmAudioMillis(altered));assert.throws(()=>pcmAudioMillis(pcmWav(new Uint8Array(960002))));});
test('decoder refuses unknown/oversized audio, missing executable and invalid digest without provider traffic',async()=>{
 await assert.rejects(decodeAudio(new Uint8Array([1,2,3]),{env:{}}));await assert.rejects(decodeAudio(pcmWav(new Uint8Array(32000)),{env:{}}));await assert.rejects(decodeAudio(new Uint8Array(2097153),{env:{}}));await assert.rejects(decodeAudio(pcmWav(new Uint8Array(32000)),{env:{LUVANI_AUDIO_DECODER_PATH:'/missing',LUVANI_AUDIO_DECODER_SHA256:'f'.repeat(64)}}));
});
test('immutable decoder rejects an executable above 128 MiB before execution', async t => {
 const directory = await fs.mkdtemp(join(tmpdir(), 'luvani-oversized-decoder-'));
 const path = join(directory, 'decoder');
 try {
  const fixture = await fs.open(path, 'wx', 0o700);
  try {
   // A sparse file crosses the exact boundary without allocating 128 MiB.
   await fixture.truncate(128 * 1024 * 1024 + 1);
  } finally { await fixture.close(); }
  const info = await fs.stat(path);
  assert.equal(info.size, 128 * 1024 * 1024 + 1);
  assert.ok(info.isFile() && (info.mode & 0o111), 'size is the only invalid executable property');
  const read = t.mock.method(fs, 'readFile', () => { throw new Error('must not read oversized executable'); });
  const hash = t.mock.method(crypto, 'createHash', () => { throw new Error('must not hash oversized executable'); });
  const spawn = t.mock.method(childProcess, 'spawn', () => { throw new Error('must not execute oversized decoder'); });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not contact a provider'); });
  syncBuiltinESMExports();
  try {
   await assert.rejects(decodeAudio(pcmWav(new Uint8Array(32000)), { env: {
    LUVANI_AUDIO_DECODER_PATH: path, LUVANI_AUDIO_DECODER_SHA256: 'f'.repeat(64),
   } }), { message: 'invalid-audio-decoder' });
   for (const boundary of [read, hash, spawn, fetch]) assert.equal(boundary.mock.callCount(), 0);
  } finally {
   t.mock.restoreAll();
   syncBuiltinESMExports();
  }
 } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
