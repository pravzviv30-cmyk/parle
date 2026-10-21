import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { MAIN_ILLUSTRATION_MOTIFS, mainArtLayers, type MainArtLayer } from './MainIllustrationArt.ts';

/** Geometry and effective SVG ancestry, independent of formatting and group ids. */
function primitives(svg: string): string[] {
  const stack: { tag: string; transform?: string }[] = [];
  const result: string[] = [];
  for (const match of svg.matchAll(/<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g)) {
    const [, close, tag = '', raw = '', self] = match;
    if (close) { stack.pop(); continue; }
    const attrs = Object.fromEntries([...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map(x => [x[1]!, x[2]!]));
    if (tag === 'svg' || tag === 'g') {
      if (!self) stack.push({ tag, transform: attrs.transform });
      continue;
    }
    delete attrs.xmlns; delete attrs.id;
    const sorted = Object.fromEntries(Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b)));
    result.push(JSON.stringify({ tag, attrs: sorted, transforms: stack.map(x => x.transform).filter(Boolean) }));
    if (!self) stack.push({ tag });
  }
  return result.sort();
}

function flatten(layers: readonly MainArtLayer[]): string[] {
  return layers.flatMap(layer => [layer.svg, ...flatten(layer.children ?? [])]);
}

for (const motif of MAIN_ILLUSTRATION_MOTIFS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${motif} ${theme} uses every exact approved SVG primitive at its authored geometry`, () => {
      const path = new URL(`../../assets/main-illustrations/${motif}-${theme}.svg`, import.meta.url);
      assert.ok(statSync(path).size > 100);
      const source = readFileSync(path, 'utf8');
      assert.match(source, /viewBox="0 0 320 200"/);
      const native = flatten(mainArtLayers(motif, theme)).join('');
      assert.deepEqual(primitives(native), primitives(source));
    });
  }
}

test('every motif has its own illustration composition and bounded motion layers', () => {
  const compositions = MAIN_ILLUSTRATION_MOTIFS.map(motif => {
    const layers = mainArtLayers(motif, 'light');
    assert.ok(layers.length >= 4);
    assert.ok(layers.some(layer => layer.role !== 'still'));
    assert.equal(new Set(layers.map(layer => layer.id)).size, layers.length);
    return flatten(layers).join('');
  });
  assert.equal(new Set(compositions).size, MAIN_ILLUSTRATION_MOTIFS.length);
});
