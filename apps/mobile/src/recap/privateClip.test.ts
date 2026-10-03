import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrivateClip } from './privateClip.ts';

test('a recap clip arriving after exit is discarded and cannot become playable', async () => {
  const removed: string[] = [];
  const clip = new PrivateClip(uri => { if (uri) removed.push(uri); });
  const ticket = clip.ticket();
  let complete!: (uri: string) => void;
  const held = new Promise<string>(resolve => { complete = resolve; });
  const finish = clip.finish(ticket, () => held);
  clip.exit(); complete('late.m4a');
  assert.equal(await finish, null); assert.equal(clip.uri, null);
  assert.deepEqual(removed, ['late.m4a']); assert.equal(clip.current(ticket), false);
});

test('one recorder stop owns concurrent finish and replacement discards only the prior take', async () => {
  const removed: string[] = []; const clip = new PrivateClip(uri => { if (uri) removed.push(uri); });
  let stops = 0; let complete!: (uri: string) => void;
  const work = new Promise<string>(resolve => { complete = resolve; });
  const stop = () => { stops++; return work; };
  const ticket = clip.ticket(); const first = clip.finish(ticket, stop); const second = clip.finish(ticket, stop);
  complete('one.m4a'); assert.equal(await first, 'one.m4a'); assert.equal(await second, 'one.m4a'); assert.equal(stops, 1);
  clip.replace(); assert.equal(clip.uri, null); assert.deepEqual(removed, ['one.m4a']);
  await clip.finish(ticket, async () => 'two.m4a'); clip.exit(); clip.exit(); assert.deepEqual(removed, ['one.m4a', 'two.m4a']);
});

test('reset invalidates pending preparation before any recording or playback can begin', () => {
  const clip = new PrivateClip(() => {}); const before = clip.ticket(); clip.exit();
  assert.equal(clip.current(before), false); assert.equal(clip.current(clip.ticket()), true);
});
