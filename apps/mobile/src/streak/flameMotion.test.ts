import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FLAME_LAYERS } from './flameGeometry.ts';
import { flameFrameAt, flamePath, FLAME_IGNITION_MS, FLAME_IDLE_MS } from './flameMotion.ts';

test('the resting flame loop deforms cubic contours and returns continuously to its exact still', () => {
  const first = flameFrameAt(0, false);
  const left = flameFrameAt(FLAME_IDLE_MS * .25, false);
  const right = flameFrameAt(FLAME_IDLE_MS * .75, false);
  const fullCycle = flameFrameAt(FLAME_IDLE_MS, false);
  assert.deepEqual(fullCycle, first);
  for (const layer of FLAME_LAYERS) {
    assert.notEqual(flamePath(layer.poses, first.amount), flamePath(layer.poses, left.amount));
    assert.notEqual(flamePath(layer.poses, left.amount), flamePath(layer.poses, right.amount));
    assert.equal(flamePath(layer.poses, fullCycle.amount), flamePath(layer.poses));
    for (const amount of [-1, 0, 1, 1.8]) {
      const path = flamePath(layer.poses, amount);
      assert.ok(path.endsWith(' Z'));
      assert.equal((path.match(/ C/g) ?? []).length, (layer.poses[0].length - 2) / 6);
      assert.doesNotMatch(path, /NaN|Infinity|undefined/);
    }
  }
  // Different contour points move different distances, so the path animation
  // cannot be reproduced by translating the entire static flame.
  const outer = FLAME_LAYERS[0].poses;
  assert.notEqual(outer[1][0] - outer[0][0], outer[1][26] - outer[0][26]);
});

test('ignition is finite, reaches the fully lit still and flows straight into idle', () => {
  const ember = flameFrameAt(0, true);
  assert.ok(ember.scaleY < 1 && ember.opacity < 1);
  const lit = flameFrameAt(FLAME_IGNITION_MS, true);
  assert.deepEqual(lit, flameFrameAt(0, false));
  assert.deepEqual(flameFrameAt(FLAME_IGNITION_MS + 500, true), flameFrameAt(500, false));
  assert.deepEqual(flameFrameAt(-10, true), ember);
  for (let t = 0; t <= 8000; t += 50) {
    const frame = flameFrameAt(t, true);
    assert.ok(frame.opacity >= .25 && frame.opacity <= 1);
    assert.ok(frame.scaleX > 0 && frame.scaleY > 0);
  }
});

test('the local Rive contains keyed vertices and a separate idle entry for a resumed screen', () => {
  const scene = readFileSync(new URL('../../assets/rive/source/streak/scene.rml', import.meta.url), 'utf8');
  assert.match(scene, /StateMachine name="Celebrate"/);
  assert.match(scene, /StateMachine name="Idle"/);
  assert.match(scene, /LinearAnimation loopValue="oneShot" duration="48" fps="60" name="Ignition"/);
  assert.match(scene, /LinearAnimation loopValue="loop" duration="240" fps="60" name="Idle"/);
  assert.match(scene, /KeyedObject objectId="0:100"/);
  assert.match(scene, /KeyedProperty property="inRotation"/);
  assert.match(scene, /KeyedProperty property="outDistance"/);
  assert.doesNotMatch(scene, /Script|ImageAsset|AudioAsset/);
  for (const match of scene.matchAll(/<KeyedProperty property="(?:inRotation|outRotation)">([\s\S]*?)<\/KeyedProperty>/g)) {
    const angles = [...match[1]!.matchAll(/value="([-.\d]+)"/g)].map(key => Number(key[1]));
    assert.ok(Math.max(...angles) - Math.min(...angles) < .3, 'a cubic handle crosses the atan2 wrap and spins through the flame');
  }
});
