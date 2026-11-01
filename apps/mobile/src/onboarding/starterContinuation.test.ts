/**
 * Today's starter-line sheet (F948): the Sheet's panel is themed, so every
 * line inside it must be too, or dark mode draws near-black on #25203D.
 * Read as source, no renderer.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./StarterContinuation.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe("Today's starter sheet, F948", () => {
  test('the starter sheet draws every line on theme colours in dark', () => {
    const start = src.indexOf('<Sheet');
    const end = src.indexOf('</Sheet>');
    assert.ok(start > 0 && end > start, 'the sheet is not found');
    const sheet = src.slice(start, end);
    const texts = [...sheet.matchAll(/<Text\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(texts.length >= 7, `expected the sheet's lines, found ${texts.length}`);
    for (const tag of texts) assert.match(tag, /color: t\.(text|muted)/, `uncoloured line in the sheet: ${tag}`);
    const input = sheet.slice(sheet.indexOf('<TextInput'), sheet.indexOf('/>', sheet.indexOf('<TextInput')));
    assert.doesNotMatch(input, /paper\./, 'the reply field is drawn on light paper');
    for (const want of [/color: t\.text/, /backgroundColor: t\.card/, /borderColor: t\.field/, /borderRadius: radius\.field/, /placeholderTextColor=\{t\.muted\}/])
      assert.match(input, want);
  });

  test('the sheet says plainly what it checks', () => {
    const flat = src.replace(/\s+/g, ' ');
    assert.match(flat, /Offline phrase practice\. This checks your typed French, not your pronunciation\./);
    assert.doesNotMatch(flat, /authored replies/);
  });
});
