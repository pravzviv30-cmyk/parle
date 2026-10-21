import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { c2SvgForInstance } from './flat/c2SvgNamespace.ts';

// The canvas art (DECISIONS.md UI-008, 2026-10-20), mirroring
// onboarding/motion/c2Assets.test.ts for the C2 layers.
const assets = new URL('../../assets/b-art/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', assets), 'utf8')) as Record<string, { width: number; height: number; sha256: string; source: string }>;
const bundled = JSON.parse(readFileSync(new URL('svg.json', assets), 'utf8')) as Record<string, string>;
const NAMES = [
  'alarm-clock', 'cafe-table', 'clock-calendar', 'cloud-cheer', 'cloud-heart', 'coffee-break', 'compass', 'flame',
  'flame-dance', 'friends-cheer', 'icon-briefcase', 'icon-cafe', 'icon-friends', 'icon-house', 'icon-suitcase',
  'map-route', 'paper-plane', 'phrasebook', 'star-jar', 'tutor-orb', 'voice-chat', 'watering-plant',
];

test('every canvas drawing is a complete, local, unmodified SVG with a manifest entry', () => {
  const files = readdirSync(new URL('svg/', assets)).sort();
  assert.equal(files.length, 22, 'the canvas uses exactly 22 drawings');
  assert.deepEqual(files, NAMES.map((name) => `${name}.svg`).sort(), 'a drawing is missing, extra or renamed');
  assert.deepEqual(Object.keys(manifest).sort(), NAMES, 'the manifest and the folder disagree');
  assert.deepEqual(Object.keys(bundled).sort(), NAMES, 'svg.json and the folder disagree');
  const sources = new Set<string>();
  for (const name of NAMES) {
    const original = readFileSync(new URL(`svg/${name}.svg`, assets), 'utf8');
    const info = manifest[name]!;
    assert.ok(original.length > 100, name);
    assert.equal(bundled[name], original, `the runtime copy of ${name} differs from the file`);
    assert.equal(createHash('sha256').update(original).digest('hex'), info.sha256, `${name} changed since it was brought in`);
    assert.match(info.source, /^[0-9a-f]{32}$/, `${name} does not record its canvas blob`);
    sources.add(info.source);
    assert.doesNotMatch(original, /(?:href|src)=["']https?:|api\/mcp\/asset|<image\b|<script\b|<foreignObject\b|javascript:/i, `${name} reaches outside itself`);
    const root = /<svg\b[^>]*>/.exec(original)?.[0] ?? '';
    assert.equal(Number(/\bwidth="([^"]+)"/.exec(root)?.[1]), info.width, `${name} root width`);
    assert.equal(Number(/\bheight="([^"]+)"/.exec(root)?.[1]), info.height, `${name} root height`);
    assert.ok(info.width > 0 && info.height > 0, name);
  }
  assert.equal(sources.size, 22, 'two names point at the same canvas blob');
});

test('two copies of one drawing never share definition IDs, and namespacing changes nothing else', () => {
  const name = NAMES.find((n) => /\bid="/.test(bundled[n]!) && /url\(#/.test(bundled[n]!));
  assert.ok(name, 'no drawing has definitions, so this test reads nothing');
  const one = c2SvgForInstance(bundled[name]!, `b-${name}-:a:`);
  const two = c2SvgForInstance(bundled[name]!, `b-${name}-:b:`);
  const ids = (xml: string) => [...xml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(ids(one).filter((id) => ids(two).includes(id)).length, 0, 'two copies share an ID');
  for (const xml of [one, two]) for (const ref of [...xml.matchAll(/url\(#([^)]*)\)/g)].map((m) => m[1]!)) assert.ok(ids(xml).includes(ref), ref);
  const plain = (xml: string) => xml.replace(/\bid="[^"]+"/g, '').replace(/url\(#[^)]*\)/g, 'url(#d)').replace(/\b((?:xlink:)?href)="#[^"]+"/g, '$1="#d"');
  assert.equal(plain(one), plain(bundled[name]!));
});

test('BArt draws through SvgXml, sizes from the aspect ratio, and is hidden from assistive tech', () => {
  const source = readFileSync(new URL('./BArt.tsx', import.meta.url), 'utf8');
  assert.match(source, /c2SvgForInstance\(svg\[name\], `b-\$\{name\}-\$\{instance\}`\)/, 'each copy is not namespaced');
  assert.match(source, /return \(width \* size\.height\) \/ size\.width;/, 'the height is not the drawing\'s own ratio');
  assert.match(source, /const drawn = height \?\? bArtHeight\(name, width\);/);
  assert.match(source, /<View \{\.\.\.decorative\}/, 'the frame reaches a screen reader');
  assert.match(source, /<SvgXml \{\.\.\.decorative\} xml=\{xml\}/, 'the drawing reaches a screen reader');
});

test('the C2 layers are untouched beside the canvas art', () => {
  assert.equal(readdirSync(new URL('../../assets/c2/svg/', import.meta.url)).length, 127);
});
