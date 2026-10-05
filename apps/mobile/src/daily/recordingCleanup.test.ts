import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recorderUri } from './recorderUri.ts';

for (const [kind, path, start, end] of [
  ['daily', './DailyPracticeScreen.tsx', '    const stop = () => {', '\n    if (!focused)'],
  ['recap', '../recap/PrivatePractice.tsx', '    const exit = () => {', '\n    if (!focused)'],
] as const) {
  test(`${kind} practice exit deletes its held take even after Expo releases the recorder`, async () => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const body = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    const removed: (string | null)[] = [];
    const recorder = { get isRecording(): boolean { throw new Error('released native object'); }, get uri(): string { throw new Error('released native object'); }, stop: () => { throw new Error('released native object'); } };
    const env = {
      generation: {current:0}, timer: {current:null}, player: {}, recorder,
      recorderUri,
      held: {current:'file://held.m4a'}, active: {current:true}, playback: {current:0},
      clip: {exit:()=>removed.push('file://held.m4a')}, setUri:()=>{}, setRecording:()=>{},
      preparedUri: {current:'file://held.m4a'}, stopping: {current:null},
      releaseDailyPlayback:()=>{}, discardRecording:(uri:string|null)=>removed.push(uri),
      setAudioModeAsync:async()=>{}, stopRecorder:async()=>{throw new Error('released native object');},
      // Both exits leave recording through the audio session now (F723, F724).
      resetRecordingAudio:async()=>{},
    };
    const cleanup = new Function(...Object.keys(env), `${body}; return ${kind === 'daily' ? 'stop' : 'exit'};`)(...Object.values(env));
    assert.doesNotThrow(()=>cleanup());
    for(let i=0;i<8;i++) await Promise.resolve();
    assert.ok(removed.includes('file://held.m4a'));
  });
}

test('a late native URI read retains the prepared recording path after release', () => {
  assert.equal(recorderUri({get uri():string {throw new Error('released');}}, 'file://prepared.m4a'), 'file://prepared.m4a');
  assert.equal(recorderUri({uri:'file://new.m4a'}, 'file://old.m4a'), 'file://new.m4a');
});

test('both private practice cleanups run before Expo passive recorder release', () => {
  for (const path of ['./DailyPracticeScreen.tsx', '../recap/PrivatePractice.tsx']) {
    const source=readFileSync(new URL(path,import.meta.url),'utf8');
    assert.match(source,/useLayoutEffect\(\(\) => \{\n    (?:live|active)\.current = focused/);
    assert.doesNotMatch(source,/recorder\.isRecording|discardRecording\(recorder\.uri\)|uri: \(\) => recorder\.uri/);
    assert.match(source,/const work = \(async \(\) => \{ await recorder\.stop\(\); \}\)\(\)\.finally/);
  }
});
