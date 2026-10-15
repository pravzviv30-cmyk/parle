import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { c2SvgForInstance } from '../../art/flat/c2SvgNamespace.ts';

const assets = new URL('../../../assets/c2/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', assets), 'utf8')) as {
  assets: Record<string, { width: number; height: number; sha256: string }>;
  scenes: Record<string, { width: number; height: number; layers: { asset: string; x: number; y: number; rotation: number; scaleX: number; scaleY: number }[] }>;
  goals: Record<string, string>;
  tutors: Record<string, string>;
  brand: { width: number; height: number; layers: { asset: string; spin?: boolean }[] };
};
const bundled = JSON.parse(readFileSync(new URL('svg.json', assets), 'utf8')) as Record<string, string>;

test('every C2 design layer is a complete, local, unmodified SVG export', () => {
  const files = readdirSync(new URL('svg/', assets)).sort();
  assert.equal(files.length, 127, 'all authored scene layers, goals, portraits, brand, and three orb sizes are present');
  assert.deepEqual(Object.keys(manifest.assets).sort(), files);
  assert.deepEqual(Object.keys(bundled).sort(), files);
  for (const file of files) {
    const original = readFileSync(new URL(`svg/${file}`, assets), 'utf8');
    const info = manifest.assets[file]!;
    assert.ok(original.length > 100, file);
    assert.equal(bundled[file], original, `the runtime altered ${file}`);
    assert.equal(createHash('sha256').update(original).digest('hex'), info.sha256, file);
    assert.doesNotMatch(original, /(?:href|src)=["']https?:|api\/mcp\/asset/, file);
    const root = /<svg\b[^>]*>/.exec(original)?.[0] ?? '';
    assert.equal(Number(/width="([^"]+)"/.exec(root)?.[1]), info.width, file);
    assert.equal(Number(/height="([^"]+)"/.exec(root)?.[1]), info.height, file);
    assert.ok(info.width > 0 && info.height > 0, file);
  }
});

test('all authored assets have a design slot and all slots have finite rendered geometry', () => {
  const used = new Set(Object.values(manifest.goals).concat(Object.values(manifest.tutors), manifest.brand.layers.map(layer => layer.asset)));
  for (const [scene, definition] of Object.entries(manifest.scenes)) {
    assert.ok(definition.width > 0 && definition.height > 0, scene);
    assert.ok(definition.layers.length > 0, scene);
    for (const layer of definition.layers) {
      used.add(layer.asset);
      assert.ok(manifest.assets[layer.asset], `${scene}/${layer.asset}`);
      for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const) assert.ok(Number.isFinite(layer[key]), `${scene}/${layer.asset}/${key}`);
      assert.ok(layer.scaleX > 0 && layer.scaleY > 0, `${scene}/${layer.asset}`);
      // SVG dimensions are retained. Only the scene's external uniform scale is responsive.
      assert.ok(Math.abs(layer.scaleX - layer.scaleY) < 0.0002, `${scene}/${layer.asset} is stretched`);
    }
  }
  assert.deepEqual([...used].sort(), Object.keys(manifest.assets).sort(), 'no exported layer was silently omitted');
});

test('C2 goals, tutor catalogue, blue sphere sizes and ring preserve their exact design shapes', () => {
  assert.deepEqual(Object.keys(manifest.goals).sort(), ['because', 'family', 'food', 'moving', 'trip', 'work']);
  assert.deepEqual(Object.keys(manifest.tutors).sort(), ['alexandre', 'anatole', 'emilie', 'guillaume', 'marie', 'sarah']);
  for (const size of [64, 88, 112]) {
    const sphere = manifest.scenes[`orb-${size}`]!;
    const layer = sphere.layers[0]!;
    assert.equal(sphere.width, size);
    assert.equal(sphere.height, size);
    assert.equal(manifest.assets[layer.asset]!.width, size);
    assert.equal(manifest.assets[layer.asset]!.height, size);
  }
  assert.equal(manifest.brand.width, 270);
  assert.equal(manifest.brand.height, 64);
  assert.equal(manifest.brand.layers.filter(layer => layer.spin).length, 1, 'only the gold ring rotates');
  assert.equal(manifest.brand.layers.length, 3, 'red centre and wordmark remain separate static assets');
});

test('two differently sized orb exports cannot bind to one another’s gradient definitions', () => {
  const typing = c2SvgForInstance(bundled['595ce.svg']!, ':typing:');
  const keyboard = c2SvgForInstance(bundled['f4b66.svg']!, ':keyboard:');
  const ids = (xml: string) => [...xml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]!);
  const references = (xml: string) => [...xml.matchAll(/url\(#([^)]*)\)/g)].map(match => match[1]!);
  assert.equal(ids(typing).filter(id => ids(keyboard).includes(id)).length, 0);
  for (const xml of [typing, keyboard]) {
    assert.ok(references(xml).length > 0);
    for (const id of references(xml)) assert.ok(ids(xml).includes(id), id);
  }
  // Namespacing leaves the source's actual painting and root geometry intact.
  const withoutIds = (xml: string) => xml.replace(/\bid="[^"]+"/g, '').replace(/url\(#[^)]*\)/g, 'url(#definition)');
  assert.equal(withoutIds(typing), withoutIds(bundled['595ce.svg']!));
  assert.equal(withoutIds(keyboard), withoutIds(bundled['f4b66.svg']!));
  assert.equal(c2SvgForInstance(bundled['595ce.svg']!, ':typing:'), typing, 'ordinary rerenders keep stable definition IDs');
});
