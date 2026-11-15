import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { countHits, isScanned, regressions, scanSource } from './unslop-scan.mjs';

const dir = mkdtempSync(join(tmpdir(), 'unslop-scan-'));
const REL = 'apps/mobile/src/home/Fixture.tsx';

/** Writes a fixture to the temp folder and scans it under an app path. */
function scan(name, source) {
  const path = join(dir, name);
  writeFileSync(path, source);
  return scanSource(REL, readFileSync(path, 'utf8'));
}
const rules = (hits) => hits.map((h) => h.rule);

test('a planted emoji in a label is flagged, one in a comment is not', () => {
  const hits = scan('emoji.tsx', "// 🔥 note\nconst title = 'Nice streak 🔥';\n");
  assert.deepEqual(rules(hits), ['emoji']);
  assert.equal(hits[0].line, 2);
});

test('a gradient outside the sky allowlist is flagged', () => {
  const src = "import { LinearGradient } from 'expo-linear-gradient';\n";
  assert.deepEqual(rules(scan('gradient.tsx', src)), ['gradient']);
  assert.deepEqual(scanSource('apps/mobile/src/art/sky/Sky.tsx', src), []);
});

test('a literal radius is flagged, a token radius is not', () => {
  const hits = scan('radius.tsx', 'const s = { a: { borderRadius: 12 }, b: { borderRadius: radius.card } };\n');
  assert.deepEqual(rules(hits), ['literal-radius']);
});

test('heavy weights, loops, glows and hype words are flagged', () => {
  const src = [
    'const t = { fontFamily: font.black };',
    'v.value = withRepeat(withTiming(1), -1);',
    "const g = { boxShadow: '0px 0px 24px #6357F2' };",
    "const key = 'unlocked';",
    "const ok = { boxShadow: '0px 12px 24px -16px ' + liftInk };",
    "const c = 'Unlock seamless French';",
  ].join('\n');
  assert.deepEqual(rules(scan('mixed.tsx', src)), ['heavy-weight', 'repeat-loop', 'glow-shadow', 'hype-word']);
});

test('a clean fixture passes', () => {
  const src = "export const s = { card: { borderRadius: radius.card, fontFamily: font.semiBold } };\nconst t = 'Your streak';\n";
  assert.deepEqual(scan('clean.tsx', src), []);
});

test('counts at or below the baseline pass, above it fail, and an unknown file fails', () => {
  const hits = scan('two.tsx', 'const a = { borderRadius: 4 };\nconst b = { borderRadius: 6 };\n');
  const counts = countHits(hits);
  assert.deepEqual(regressions(counts, { [REL]: { 'literal-radius': 2 } }), []);
  assert.deepEqual(regressions(counts, { [REL]: { 'literal-radius': 3 } }), []);
  assert.equal(regressions(counts, { [REL]: { 'literal-radius': 1 } }).length, 1);
  assert.equal(regressions(counts, {}).length, 1);
});

test('tests, dev previews and art are not scanned', () => {
  assert.equal(isScanned('apps/mobile/src/home/Home.tsx'), true);
  assert.equal(isScanned('apps/mobile/src/home/Home.test.ts'), false);
  assert.equal(isScanned('apps/mobile/src/dev/TodayPreview.tsx'), false);
  assert.equal(isScanned('apps/mobile/src/art/mascots/Cloud.tsx'), false);
  assert.equal(isScanned('packages/brain/src/x.ts'), false);
});
