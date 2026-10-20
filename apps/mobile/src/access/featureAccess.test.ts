/**
 * The access seam (B0, 2026-10-20): every D24 feature is listed, every one is
 * unlocked until D5, and the seam reads nothing from purchases/ or wall/ yet.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { featureAccess, LOCKED_FEATURES } from './featureAccess.ts';

describe('featureAccess, the one lock seam', () => {
  test('it lists exactly the D24 locked features', () => {
    assert.deepEqual([...LOCKED_FEATURES].sort(), [
      'continueArc', 'conversationPractice', 'fixes', 'fullJourney', 'realMoment', 'sounds', 'thenAndNow', 'tutorMemory',
    ]);
  });

  test('every feature is unlocked for everyone until D5', () => {
    for (const feature of LOCKED_FEATURES) assert.equal(featureAccess(feature), 'unlocked', `${feature} shows as locked before gating exists`);
  });

  test('the seam imports nothing from purchases/ or wall/ before D5', () => {
    const src = readFileSync(new URL('./featureAccess.ts', import.meta.url), 'utf8');
    const imports = [...src.matchAll(/^\s*import[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!);
    for (const spec of imports) assert.doesNotMatch(spec, /purchases\/|wall\//, `featureAccess imports ${spec}`);
    assert.doesNotMatch(src, /require\(|import\(/);
  });
});
