/**
 * The recap's dev preview (`?preview=recap-*`): every key is listed in order,
 * named, routed to RecapPreview and drawn without the preview badge. Read as
 * source, no renderer.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const WANTED = [
  'recap-full', 'recap-scrolled', 'recap-sound-sheet', 'recap-fix-sheet', 'recap-earned', 'recap-earned-first-stamp',
  'recap-no-reply', 'recap-not-saved', 'recap-settlement-not-charged', 'recap-left-early', 'recap-typed', 'recap-no-sound',
  'recap-progress-unreadable', 'recap-reminder',
];

describe("the recap's preview keys", () => {
  test('the fourteen keys, in order', () => {
    const src = strip(read('./RecapPreview.tsx'));
    const list = src.match(/export const RECAP_PREVIEW_KEYS = \[([\s\S]*?)\] as const/);
    assert.ok(list, 'RecapPreview does not export RECAP_PREVIEW_KEYS as a tuple');
    assert.deepEqual([...(list?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]), WANTED);
  });

  test('the screen list routes the keys to the recap preview and hides the badge for it', () => {
    const list = strip(read('./OnboardingPreview.tsx'));
    assert.match(list, /\.\.\.DRILL_PREVIEWS, \.\.\.RECAP_PREVIEW_KEYS, \.\.\.TODAY_PREVIEW_KEYS, 'select'\] as const/);
    assert.match(list, /\.\.\.Object\.fromEntries\(RECAP_PREVIEW_KEYS\.map\(/, 'the recap keys have no labels');
    assert.match(list, /recap !== null \? <RecapPreview key=\{recap\} preview=\{recap\} mode=\{yourFrenchMode\} \/>/);
    assert.match(list, /drill === null && recap === null && going === null/, 'the preview badge draws over the recap');
  });
});
