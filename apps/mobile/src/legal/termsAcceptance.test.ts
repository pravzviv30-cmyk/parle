import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('./TermsAcceptance.tsx', import.meta.url), 'utf8');

// F1140, the F951 rule: a Voice Control user says the words on screen, so each
// control's spoken name is exactly its visible text.
test('the terms and privacy controls are spoken by their visible words', () => {
  const controls = [...source.matchAll(/<Press\b[^>]*accessibilityLabel="([^"]+)"[^>]*>\s*<Text[^>]*>([^<]+)<\/Text>/g)];
  assert.equal(controls.length, 2, 'expected the Terms and Privacy controls');
  for (const [, label, visible] of controls) assert.equal(label, visible?.trim());
});
