import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { countHits, HEAVY_WEIGHT_ALLOW, isScanned, regressions, REPEAT_ALLOW, scanSource, stripComments } from './unslop-scan.mjs';

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

test('--update-baseline with --diff is refused', () => {
  const script = fileURLToPath(new URL('./unslop-scan.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script, '--diff', 'HEAD...HEAD', '--update-baseline'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /full scan/);
});

test('comment markers inside strings are not comments', () => {
  const src = "const glob = '**/*.tsx';\nconst a = { borderRadius: 4 };\nconst u = 'a // b'; // note\n/* x */ const t = `c // d`;\n";
  assert.equal(stripComments(src), "const glob = '**/*.tsx';\nconst a = { borderRadius: 4 };\nconst u = 'a // b';        \n        const t = `c // d`;\n");
  assert.deepEqual(rules(scan('strings.tsx', src)), ['literal-radius']);
  assert.equal(stripComments("const s = 'it\\'s // x';\n/* a\nb */ y"), "const s = 'it\\'s // x';\n    \n     y");
});

test('a pink glow is flagged; ink and liftInk are not', () => {
  assert.deepEqual(rules(scan('pink.tsx', 'const a = { shadowColor: palette.pink, shadowRadius: 16 };\n')), ['glow-shadow']);
  assert.deepEqual(scan('ink.tsx', 'const a = { shadowColor: ink, shadowRadius: 16 };\nconst b = { shadowColor: liftInk, shadowRadius: 16 };\n'), []);
  assert.deepEqual(scan('small.tsx', 'const a = { shadowColor: palette.pink, shadowRadius: 8 };\n'), []);
});

test('heavy weights are allowed only in HEAVY_WEIGHT_ALLOW', () => {
  const src = 'const t = { fontFamily: font.extraBold };\n';
  assert.deepEqual(scanSource(HEAVY_WEIGHT_ALLOW[0], src), []);
  assert.deepEqual(rules(scanSource(REL, src)), ['heavy-weight']);
});

test('withRepeat is allowed only in REPEAT_ALLOW', () => {
  const src = 'v.value = withRepeat(withTiming(1), -1);\n';
  assert.deepEqual(scanSource(REPEAT_ALLOW[0], src), []);
  assert.deepEqual(rules(scanSource(REL, src)), ['repeat-loop']);
});
