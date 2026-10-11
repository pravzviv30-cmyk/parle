import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
const assets = new URL('../../../assets/bold-rhythm/', import.meta.url);

test('every local scene has a compiled Rive file and a matching static fallback', () => {
  const stills = JSON.parse(readFileSync(new URL('stills.json', assets), 'utf8')) as Record<string,string>;
  const files = readdirSync(assets).filter(f => f.endsWith('.riv')).map(f => f.slice(0,-4)).sort();
  assert.equal(files.length, 24);
  assert.deepEqual(Object.keys(stills).sort(), files);
  for (const scene of files) {
    assert.equal(readFileSync(new URL(`${scene}.riv`, assets)).subarray(0,4).toString(), 'RIVE', scene);
    assert.equal(stills[scene], readFileSync(new URL(`${scene}.svg`, assets), 'utf8'), scene);
    assert.doesNotMatch(stills[scene]!, /(?:href|src)=["']https?:|api\/mcp\/asset/, 'offline artwork cannot depend on expiring URLs');
  }
});

test('continuous artwork returns to its starting pose without a loop-boundary jump', () => {
  for (const scene of readdirSync(new URL('source/', assets))) {
    const rml = readFileSync(new URL(`source/${scene}/scene.rml`, assets), 'utf8');
    assert.match(rml, /loopValue="loop"/);
    assert.match(rml, /defaultStateMachineId="0:9001"/);
    const duration = Number(/<LinearAnimation[^>]*duration="(\d+)"/.exec(rml)?.[1]);
    assert.ok(duration >= 240 && duration <= 600, scene);
    for (const [, track] of rml.matchAll(/<KeyedProperty[^>]*>([\s\S]*?)<\/KeyedProperty>/g)) {
      const keys = [...track!.matchAll(/<KeyFrameDouble[^>]*frame="(\d+)"[^>]*value="([^"]+)"/g)];
      assert.ok(keys.length > 0, scene);
      for (const key of keys) { assert.ok(Number.isFinite(Number(key[2])), scene); assert.ok(Number(key[1]) <= duration, scene); }
      if (keys.length > 1) {
        assert.equal(Number(keys[0]![1]), 0, scene);
        assert.equal(Number(keys.at(-1)![1]), duration, scene);
        assert.ok(Math.abs(Number(keys[0]![2])-Number(keys.at(-1)![2])) < 0.00001, `${scene} jumps on repeat`);
      }
    }
  }
});
