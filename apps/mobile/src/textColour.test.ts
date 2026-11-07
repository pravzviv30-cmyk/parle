/**
 * Every Text says its colour (2026-11-06, the founder's dark marks). The type
 * roles in theme.ts carry no colour, so a Text styled only by `type.x` draws
 * the platform's black, which is 1.35 on the dark card. Onboarding is pinned
 * light by rule (nav/darkReady.ts), so it is left out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url);
const BARE = /<Text\b[^>]*\bstyle=\{\s*(?:\[\s*)?type\.\w+\s*(?:\]\s*)?\}/g;

test('no Text is styled only by a type role, so none draws black in dark', () => {
  const found: string[] = [];
  const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
    .map((p) => p.split('\\').join('/'))
    .filter((p) => p.endsWith('.tsx') && !/\.test\.tsx$/.test(p) && !p.startsWith('onboarding/') && !p.startsWith('testing/'));
  for (const file of files) {
    const source = readFileSync(new URL(file, ROOT), 'utf8');
    for (const match of source.matchAll(BARE)) {
      found.push(`${file}:${source.slice(0, match.index).split('\n').length}`);
    }
  }
  assert.deepEqual(found, [], `a Text with no colour: ${found.join(', ')}`);
});
