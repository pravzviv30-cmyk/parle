import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimDailyPlayback, releaseDailyPlayback, ownsDailyPlayback } from './playback.ts';
test('daily audio interrupts the previous card and invalidates its delayed playback',()=>{
 let pauses=0; const first={pause:()=>{pauses++;}}, second={pause:()=>{}};
 claimDailyPlayback(first); claimDailyPlayback(second);
 assert.equal(pauses,1); assert.equal(ownsDailyPlayback(first),false); assert.equal(ownsDailyPlayback(second),true);
 releaseDailyPlayback(first); assert.equal(ownsDailyPlayback(second),true);
 releaseDailyPlayback(second); assert.equal(ownsDailyPlayback(second),false);
});
